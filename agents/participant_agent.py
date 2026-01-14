"""
SyndiMatch - Enhanced Participant Agent
Evaluates loan opportunities and makes bidding decisions with comprehensive validation
"""

from datetime import datetime
from typing import Dict, Any, List, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import logging
import uuid

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

from .state import SyndicationState, BidDecision, Bid
from .config import ANTHROPIC_API_KEY, AGENT_MODEL
from . import db

logger = logging.getLogger(__name__)


# Credit rating hierarchy for comparison
CREDIT_RATING_ORDER = ['AAA', 'AA+', 'AA', 'AA-', 'A+', 'A', 'A-', 
                       'BBB+', 'BBB', 'BBB-', 'BB+', 'BB', 'BB-', 
                       'B+', 'B', 'B-', 'CCC+', 'CCC', 'CCC-', 'CC', 'C', 'D']


def rating_to_numeric(rating: str) -> int:
    """Convert credit rating to numeric value (higher = better)"""
    rating = rating.upper().strip()
    if rating in CREDIT_RATING_ORDER:
        return len(CREDIT_RATING_ORDER) - CREDIT_RATING_ORDER.index(rating)
    return 10  # Default to BBB level


class ParticipantAgent:
    """
    Agent representing institutional investors (banks, funds, CLOs, etc.)
    Enhanced with:
    - Credit rating validation
    - ESG score filtering
    - Sector concentration checks
    - Geographic preferences
    - Multi-round bid updates
    - Payment reliability tracking
    """
    
    def __init__(self, agent_id: str):
        self.agent_id = str(agent_id)
        
        # Initialize LLM only if API key is present
        if ANTHROPIC_API_KEY and ANTHROPIC_API_KEY.startswith("sk-"):
            self.llm = ChatAnthropic(
                model=AGENT_MODEL,
                api_key=ANTHROPIC_API_KEY,
                temperature=0.7
            )
        else:
            self.llm = None
            logger.info(f"[{self.agent_id}] No valid API Key found. Running in Simulation Mode (Rule-Based).")
            
        try:
            self.profile = self._load_profile()
        except Exception as e:
            logger.warning(f"[{self.agent_id}] Profile load failed: {e}. Using default.")
            self.profile = {
                "institution": {"name": "Default Investor", "type": "Bank"},
                "risk_appetite": {
                    "available_capacity": 100000000, 
                    "min_ticket": 1000000, 
                    "max_single_ticket": 20000000,
                    "min_acceptable_yield": 4.0
                },
                "strategy": {"investment_style": "balanced"}
            }
        self._cached_capacity = None
    
    def _load_profile(self) -> Dict[str, Any]:
        """Load participant profile from MongoDB"""
        profile = db.participant_agents().find_one({"_id": self.agent_id})
        if not profile:
            raise ValueError(f"Participant agent {self.agent_id} not found")
        return profile
    
    def _refresh_capacity(self):
        """Efficiently refresh only capacity-related fields"""
        result = db.participant_agents().find_one(
            {"_id": self.agent_id},
            {"risk_appetite.available_capacity": 1, "risk_appetite.current_deployed": 1}
        )
        if result:
            self._cached_capacity = result.get("risk_appetite", {}).get("available_capacity", 0)
            if "risk_appetite" in self.profile:
                self.profile["risk_appetite"]["available_capacity"] = self._cached_capacity
    
    def _refresh_profile(self):
        """Refresh profile from database to get latest state"""
        try:
            self.profile = self._load_profile()
        except Exception as e:
            # Log warning instead of silently swallowing
            logger.warning(f"[{self.agent_id}] Profile refresh failed: {e}. Keeping existing.")
    
    def evaluate_opportunity(self, state: SyndicationState) -> Optional[Dict[str, Any]]:
        """
        Evaluate opportunity and return bid if decision is positive.
        Used by orchestrator for parallel evaluation.
        """
        decision = self.evaluate_loan(state)
        if decision and decision.decision == "bid":
            return self.submit_bid(state, decision)
        return None
    
    def evaluate_loan(self, state: SyndicationState) -> Optional[BidDecision]:
        """
        Use LLM to evaluate loan opportunity and decide whether to bid.
        Returns BidDecision with reasoning.
        """
        self._refresh_capacity()
        
        # Check hard constraints first
        violations = self._check_all_constraints(state)
        if violations:
            return BidDecision(
                decision="pass",
                amount=0,
                spread=0,
                reasoning=f"Failed constraints: {', '.join(violations)}",
                portfolio_fit_score=0.0,
                constraints_violated=violations
            )
        
        # Build prompt for LLM evaluation
        if self.llm:
            try:
                system_message = SystemMessage(content="""
You are an AI investment analyst for a financial institution participating in loan syndications.
Analyze the loan opportunity and decide whether to bid based on your institution's profile.

Respond ONLY with valid JSON in this exact format:
{
    "decision": "bid" or "pass",
    "amount": <integer amount in USD, 0 if passing>,
    "spread": <integer basis points, 0 if passing>,
    "reasoning": "<1-2 sentence explanation>",
    "portfolio_fit_score": <float 0.0-1.0>,
    "risk_adjusted_return": <float percentage or null>
}
""")
                prompt = self._build_evaluation_prompt(state)
                response = self.llm.invoke([system_message, HumanMessage(content=prompt)])
                decision_data = json.loads(response.content)
                
                return BidDecision(
                    decision=decision_data["decision"],
                    amount=decision_data.get("amount", 0),
                    spread=decision_data.get("spread", state.get("current_spread", 0)),
                    reasoning=decision_data["reasoning"],
                    portfolio_fit_score=decision_data.get("portfolio_fit_score", 0.5),
                    risk_adjusted_return=decision_data.get("risk_adjusted_return")
                )
            except json.JSONDecodeError as e:
                logger.error(f"[{self.agent_id}] LLM returned invalid JSON: {e}")
                logger.debug(f"[{self.agent_id}] Raw LLM response: {response.content}")
            except KeyError as e:
                logger.error(f"[{self.agent_id}] LLM response missing required field: {e}")
                logger.debug(f"[{self.agent_id}] Parsed data: {decision_data}")
            except Exception as e:
                logger.error(f"[{self.agent_id}] LLM evaluation failed: {e}")
            # Fallback to rule-based decision
        
        # Fallback / Simulation Mode
        return self._rule_based_evaluation(state)
    
    def _check_all_constraints(self, state: SyndicationState) -> List[str]:
        """Comprehensive constraint checking - returns list of violations"""
        violations = []
        risk = self.profile.get("risk_appetite", {})
        sector_prefs = self.profile.get("sector_preferences", {})
        constraints = self.profile.get("constraints", {})
        geo_prefs = self.profile.get("geographic_preferences", {})
        
        loan_details = state.get("loan_details", {})
        
        # 1. Capacity check (with fee buffer)
        available_cap = risk.get("available_capacity", 0)
        min_ticket = risk.get("min_ticket", 0)
        fee_buffer = available_cap * 0.02
        if (available_cap - fee_buffer) < min_ticket:
            violations.append("insufficient_capacity")
        
        # 2. Sector exclusion check
        industry = loan_details.get("industry", "")
        if industry in sector_prefs.get("avoid", []):
            violations.append("sector_excluded")
        
        # 3. Credit rating check
        loan_rating = loan_details.get("credit_rating", "BB")
        rating_range = risk.get("credit_rating_range", {})
        min_rating = rating_range.get("minimum", "CCC")
        max_rating = rating_range.get("maximum", "AAA")
        
        loan_score = rating_to_numeric(loan_rating)
        min_score = rating_to_numeric(min_rating)
        max_score = rating_to_numeric(max_rating)
        
        if loan_score < min_score:
            violations.append(f"credit_rating_too_low ({loan_rating} < {min_rating})")
        if loan_score > max_score:
            violations.append(f"credit_rating_too_high ({loan_rating} > {max_rating})")
        
        # 4. ESG score check
        esg_requirements = constraints.get("esg_requirements", False)
        if esg_requirements:
            min_esg = constraints.get("min_esg_score", 0)
            loan_esg = state.get("esg_rating", state.get("loan_details", {}).get("esg_score", 100))
            if loan_esg < min_esg:
                violations.append(f"esg_score_too_low ({loan_esg} < {min_esg})")
        
        # 5. Sector concentration check
        sector_limits = self.profile.get("portfolio_limits", {}).get("sector_concentration", {})
        if industry in sector_limits:
            current_exposure = self._get_sector_exposure(industry)
            max_exposure = sector_limits[industry]
            potential_exposure = current_exposure + loan_details.get("syndication_target", 0) * 0.10
            if potential_exposure > max_exposure:
                violations.append(f"sector_concentration_exceeded ({industry})")
        
        # 6. Geographic preference check
        loan_geography = loan_details.get("geography", state.get("geography", "US"))
        if loan_geography in geo_prefs.get("avoid", []):
            violations.append(f"geography_excluded ({loan_geography})")
        
        if geo_prefs.get("required", []) and loan_geography not in geo_prefs.get("required", []):
            violations.append(f"geography_not_preferred ({loan_geography})")
        
        return violations
    
    def _get_sector_exposure(self, sector: str) -> float:
        """Get current sector exposure from portfolio"""
        portfolio = self.profile.get("current_portfolio", {})
        sector_allocations = portfolio.get("sector_allocations", {})
        return sector_allocations.get(sector, 0)
    
    def _passes_hard_constraints(self, state: SyndicationState) -> bool:
        """Legacy method - use _check_all_constraints instead"""
        return len(self._check_all_constraints(state)) == 0
    
    def _get_violated_constraints(self, state: SyndicationState) -> List[str]:
        """Legacy method - use _check_all_constraints instead"""
        return self._check_all_constraints(state)
    
    def _build_evaluation_prompt(self, state: SyndicationState) -> str:
        """Build detailed prompt for LLM evaluation"""
        risk = self.profile.get("risk_appetite", {})
        strategy = self.profile.get("strategy", {})
        
        return f"""
## Your Institution Profile
- Name: {self.profile.get('institution', {}).get('name', 'Unknown')}
- Type: {self.profile.get('institution', {}).get('type', 'Unknown')}
- Available Capital: ${risk.get('available_capacity', 0):,}
- Max Single Ticket: ${risk.get('max_single_ticket', 0):,}
- Min Ticket Size: ${risk.get('min_ticket', 0):,}
- Target Credit Rating: {risk.get('credit_rating_range', {}).get('sweet_spot', 'BBB')}
- Acceptable Rating Range: {risk.get('credit_rating_range', {}).get('minimum', 'B-')} to {risk.get('credit_rating_range', {}).get('maximum', 'AAA')}
- Min Acceptable Yield: {risk.get('min_acceptable_yield', 0)}%
- Target Yield: {risk.get('target_all_in_yield', 0)}%
- Investment Style: {strategy.get('investment_style', 'moderate')}
- Preferred Sectors: {self.profile.get('sector_preferences', {}).get('preferred', [])}
- Sectors to Avoid: {self.profile.get('sector_preferences', {}).get('avoid', [])}
- Geographic Preference: {self.profile.get('geographic_preferences', {}).get('preferred', ['US'])}

## Loan Opportunity
- Syndication ID: {state['syndication_id']}
- Borrower: {state['loan_details']['borrower_name']}
- Industry: {state['loan_details']['industry']}
- Loan Type: {state['loan_details']['loan_type']}
- Credit Rating: {state['loan_details']['credit_rating']}
- Total Amount: ${state['loan_details']['total_amount']:,}
- Syndication Target: ${state['loan_details']['syndication_target']:,}
<<<<<<< HEAD
- Current Spread: {state.get('current_spread', state.get('pricing', {}).get('initial_spread', 0))} bps
- Base Rate: {state.get('pricing', {}).get('base_rate', 'SOFR')}
- All-in Yield (estimated): {4.5 + state.get('current_spread', 0)/100:.2f}%
- Current Subscription: {state.get('subscription_rate', 0)*100:.1f}%
- Auction Round: {state.get('current_round', 1)}
=======
- Current Spread: {state['current_spread']} bps
- Base Rate: {state['pricing']['base_rate']}
- All-in Yield (estimated): {self._calculate_yield(state):.2f}%
- Current Subscription: {state['subscription_rate']*100:.1f}%
- Auction Round: {state['current_round']}
>>>>>>> syndication-change
- Originator: {state['originator']}

## Decision Required
Based on your institution's profile and this loan opportunity:
1. Should you bid? Consider rating, yield, sector fit, available capital
2. If bidding, what amount? (between min ticket and available capacity)
3. What spread are you willing to accept?

Remember: Your available capital is ${risk.get('available_capacity', 0):,}. 
Do not bid more than you have available.
"""
    
<<<<<<< HEAD
=======
    def _passes_hard_constraints(self, state: SyndicationState) -> bool:
        """Check if loan passes basic eligibility"""
        risk = self.profile.get("risk_appetite", {})
        sector_prefs = self.profile.get("sector_preferences", {})
        rating_pref = risk.get("credit_rating_range", {})
        
        # Check available capacity with 2% buffer for fees
        available_cap = risk.get("available_capacity", 0) - risk.get("reserved_for_bids", 0)
        fee_buffer = available_cap * 0.02
        if (available_cap - fee_buffer) < risk.get("min_ticket", 0):
            return False
        
        # Check if sector is avoided
        if state["loan_details"]["industry"] in sector_prefs.get("avoid", []):
            return False

        # Check rating against range if provided
        loan_rating = state["loan_details"].get("credit_rating")
        if loan_rating and rating_pref:
            # Simple lexical check for min/max buckets if present
            min_rating = rating_pref.get("min")
            max_rating = rating_pref.get("max")
            # If min/max exist and loan outside, fail
            if min_rating and loan_rating < min_rating:
                return False
            if max_rating and loan_rating > max_rating:
                return False
        
        return True
    
    def _get_violated_constraints(self, state: SyndicationState) -> List[str]:
        """Get list of violated constraints"""
        violations = []
        risk = self.profile.get("risk_appetite", {})
        sector_prefs = self.profile.get("sector_preferences", {})
        
        if risk.get("available_capacity", 0) < risk.get("min_ticket", 0):
            violations.append("insufficient_capacity")
        
        if state["loan_details"]["industry"] in sector_prefs.get("avoid", []):
            violations.append("sector_excluded")
        
        return violations
    
    def _calculate_yield(self, state: SyndicationState, spread: Optional[int] = None) -> float:
        """
        Calculate all-in yield using actual base rate from state.
        
        Args:
            state: Syndication state containing pricing info
            spread: Optional spread override (bps), defaults to current_spread
        
        Returns:
            All-in yield as percentage (e.g., 7.5 for 7.5%)
        """
        # Get base rate - handle both numeric and string (e.g., "SOFR")
        base_rate = state["pricing"].get("base_rate", 4.5)
        
        # If base_rate is a string like "SOFR", use current SOFR approximation
        # In production, this would fetch from a rate service
        if isinstance(base_rate, str):
            # Current market approximations (should be fetched from rate service)
            rate_lookup = {
                "SOFR": 4.35,
                "LIBOR": 4.50,  # Deprecated but may exist in legacy
                "PRIME": 7.50,
                "T-BILL": 4.25
            }
            base_rate = rate_lookup.get(base_rate.upper(), 4.5)
        
        spread_bps = spread if spread is not None else state.get("current_spread", 0)
        return float(base_rate) + (spread_bps / 100)
    
>>>>>>> syndication-change
    def _rule_based_evaluation(self, state: SyndicationState) -> BidDecision:
        """Fallback rule-based evaluation if LLM fails"""
        risk = self.profile.get("risk_appetite", {})
        
<<<<<<< HEAD
        # Simple yield check
        current_spread = state.get("current_spread", state.get("pricing", {}).get("initial_spread", 0))
        estimated_yield = 4.5 + current_spread / 100
=======
        # Calculate yield using ACTUAL base rate, not hardcoded 4.5
        estimated_yield = self._calculate_yield(state)
>>>>>>> syndication-change
        min_yield = risk.get("min_acceptable_yield", 0)
        
        if estimated_yield >= min_yield:
            available = max(0, risk.get("available_capacity", 0) - risk.get("reserved_for_bids", 0))
            capacity_after_fees = max(0, available - available * 0.02)
            amount = min(
                risk.get("max_single_ticket", 50000000),
                capacity_after_fees,
                state["loan_details"]["syndication_target"] * 0.15
            )
            if amount < risk.get("min_ticket", 0):
                return BidDecision(
                    decision="pass",
                    amount=0,
                    spread=0,
                    reasoning="Rule-based: Insufficient available capacity for min ticket",
                    portfolio_fit_score=0.2
                )
            return BidDecision(
                decision="bid",
                amount=int(amount),
                spread=current_spread,
                reasoning="Rule-based: Yield meets minimum threshold",
                portfolio_fit_score=0.7
            )
        
        return BidDecision(
            decision="pass",
            amount=0,
            spread=0,
            reasoning="Rule-based: Yield below minimum threshold",
            portfolio_fit_score=0.3
        )
    
    def update_bid_for_round(self, state: SyndicationState, previous_bid: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Update bid for subsequent auction rounds as spread improves.
        Called by negotiation agent during multi-round auctions.
        """
        current_spread = state.get("current_spread", 0)
        previous_spread = previous_bid.get("spread_bid", 0)
        
        # If spread improved (lower), consider increasing bid
        spread_improvement = previous_spread - current_spread
        
        if spread_improvement > 0:
            risk = self.profile.get("risk_appetite", {})
            available = risk.get("available_capacity", 0)
            
            # Increase bid by up to 20% if spread improved significantly
            increase_factor = min(1.0 + (spread_improvement / 50) * 0.2, 1.2)
            new_amount = min(
                int(previous_bid["bid_amount"] * increase_factor),
                available,
                risk.get("max_single_ticket", available)
            )
            
            if new_amount > previous_bid["bid_amount"]:
                # Update bid in database
                now = datetime.utcnow()
                db.bids().update_one(
                    {"_id": previous_bid["_id"]},
                    {
                        "$set": {
                            "bid_amount": new_amount,
                            "spread_bid": current_spread,
                            "auction_round": state.get("current_round", 1)
                        },
                        "$push": {
                            "modification_history": {
                                "modified_at": now,
                                "new_amount": new_amount,
                                "new_spread": current_spread,
                                "reason": "spread_improvement"
                            }
                        }
                    }
                )
                
                logger.info(f"[{self.agent_id}] Updated bid: ${previous_bid['bid_amount']:,} → ${new_amount:,}")
                
                previous_bid["bid_amount"] = new_amount
                previous_bid["spread_bid"] = current_spread
                return previous_bid
        
        return previous_bid  # No change
    
    def submit_bid(self, state: SyndicationState, decision: BidDecision) -> Dict[str, Any]:
        """Submit a bid to the syndication."""
        if decision.decision != "bid":
            return {"status": "passed", "participant": self.agent_id}
        
        # Generate unique bid ID using UUID to prevent collisions across rounds
        bid_id = f"BID-{uuid.uuid4().hex[:12].upper()}"
        now_str = state.get("current_time")
        now = datetime.fromisoformat(now_str) if now_str else datetime.utcnow()
        
        bid = {
            "_id": bid_id,
            "syndication_id": state["syndication_id"],
            "bid_status": "active",
            "participant_agent_id": self.agent_id,
            "institution_name": self.profile.get("institution", {}).get("name", "Unknown"),
            "institution_type": self.profile.get("institution", {}).get("type", "Unknown"),
            "bid_amount": decision.amount,
            "spread_bid": decision.spread,
            "all_in_yield": self._calculate_yield(state, decision.spread),
            "min_allocation": int(decision.amount * 0.5),
            "max_allocation": decision.amount,
            "partial_fill_acceptable": True,
            "pro_rata_acceptance": True,
            "submitted_at": now,
            "valid_until": state.get("timeline", {}).get("target_close_date"),
            "auction_round": state.get("current_round", 1),
            "is_competitive": True,
            "portfolio_fit_score": decision.portfolio_fit_score,
            "risk_adjusted_return": decision.risk_adjusted_return,
            "reasoning": decision.reasoning,
            "modification_history": [{
                "modified_at": now,
                "new_amount": decision.amount,
                "new_spread": decision.spread,
                "reason": "initial_bid"
            }]
        }
        
        # Insert bid into MongoDB
        try:
            db.bids().update_one({"_id": bid_id}, {"$set": bid}, upsert=True)
        except Exception as e:
            logger.error(f"[{self.agent_id}] Failed to submit bid: {e}")
            return {"status": "error", "participant": self.agent_id, "error": str(e)}
        
        # Update participant stats
        db.participant_agents().update_one(
            {"_id": self.agent_id},
            {
                "$inc": {"performance_history.bids_submitted_ytd": 1},
                "$set": {"last_bid_at": now},
                "$inc": {
                    "risk_appetite.available_capacity": -decision.amount,
                    "risk_appetite.reserved_for_bids": decision.amount
                }
            }
        )
        
        logger.info(f"[{self.agent_id}] Submitted bid: ${decision.amount:,} @ {decision.spread} bps")
        return bid
    
    def receive_allocation(self, syndication_id: str, allocation: Dict[str, Any]) -> None:
        """Process winning allocation and update participant state."""
        amount = allocation["final_allocation"]
        
        # Update deployed capital and available capacity
        db.participant_agents().update_one(
            {"_id": self.agent_id},
            {
                "$inc": {
                    "risk_appetite.current_deployed": amount,
                    "risk_appetite.available_capacity": -amount,
                    "risk_appetite.reserved_for_bids": -min(amount, self.profile.get("risk_appetite", {}).get("reserved_for_bids", 0)),
                    "performance_history.allocations_won": 1
                },
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        
        # Recalculate win rate
        self._refresh_profile()
        perf = self.profile.get("performance_history", {})
        bids = perf.get("bids_submitted_ytd", 1)
        wins = perf.get("allocations_won", 0)
        new_win_rate = wins / bids if bids > 0 else 0
        
        db.participant_agents().update_one(
            {"_id": self.agent_id},
            {"$set": {"performance_history.win_rate": round(new_win_rate, 3)}}
        )
        
        logger.info(f"[{self.agent_id}] Received allocation: ${amount:,} for {syndication_id}")
    
    def make_payment(self, syndication_id: str, payment_type: str, amount: int, 
                     due_date: datetime = None) -> Dict[str, Any]:
        """Record payment with reliability tracking."""
        now = datetime.utcnow()
        
        # Track payment timing for reliability score
        is_on_time = True
        delay_hours = 0
        if due_date:
            if now > due_date:
                is_on_time = False
                delay_hours = (now - due_date).total_seconds() / 3600
        
        # Update payment stats
        db.participant_agents().update_one(
            {"_id": self.agent_id},
            {
                "$inc": {
                    f"fees_paid.{payment_type}": amount,
                    "payment_stats.total_payments": 1,
                    "payment_stats.on_time_payments": 1 if is_on_time else 0,
                    "payment_stats.total_delay_hours": delay_hours
                },
                "$set": {"last_payment_at": now}
            }
        )
        
        # Recalculate reliability score
        self._update_reliability_score()
        
        logger.info(f"[{self.agent_id}] Made payment: ${amount:,} ({payment_type}) for {syndication_id}" +
                   (f" [LATE by {delay_hours:.1f}h]" if not is_on_time else ""))
        
        return {
            "status": "paid",
            "participant": self.agent_id,
            "amount": amount,
            "payment_type": payment_type,
            "timestamp": now.isoformat(),
            "on_time": is_on_time,
            "delay_hours": delay_hours
        }
    
    def _update_reliability_score(self):
        """Update payment reliability score based on payment history"""
        self._refresh_profile()
        stats = self.profile.get("payment_stats", {})
        
        total = stats.get("total_payments", 0)
        on_time = stats.get("on_time_payments", 0)
        avg_delay = stats.get("total_delay_hours", 0) / total if total > 0 else 0
        
        # Score: 100 base, -10 per late payment, -1 per hour average delay
        reliability_score = max(0, min(100, 
            100 - (total - on_time) * 10 - avg_delay
        ))
        
        db.participant_agents().update_one(
            {"_id": self.agent_id},
            {"$set": {"payment_stats.reliability_score": round(reliability_score, 1)}}
        )
    
    def notify_auction_failed(self, syndication_id: str, reason: str = None):
        """Handle notification that auction failed"""
        logger.info(f"[{self.agent_id}] Auction failed for {syndication_id}: {reason}")
        # Could send webhook, email, or update internal tracking
    
    def notify_settlement_failed(self, syndication_id: str):
        """Handle notification that settlement failed"""
        logger.info(f"[{self.agent_id}] Settlement failed for {syndication_id}")

    def notify_auction_failed(self, syndication_id: str, reason: str):
        """Handle notification of failed auction"""
        logger.info(f"[{self.agent_id}] Auction failed for {syndication_id}: {reason}")
        # Release capital reservations if any (not implemented in this simplified version)

    def notify_settlement_failed(self, syndication_id: str):
        """Handle notification of failed settlement"""
        logger.warning(f"[{self.agent_id}] Settlement failed for {syndication_id}")


def evaluate_all_participants(state: SyndicationState) -> List[Dict[str, Any]]:
    """
    Fan-out function to evaluate all active participant agents IN PARALLEL.
    Uses ThreadPoolExecutor for concurrent evaluation.
    """
    participants = list(db.participant_agents().find({"status": "active"}))
    
    logger.info(f"Evaluating {len(participants)} participants in parallel...")
    
    all_bids = []
    
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {}
        for p in participants:
            agent = ParticipantAgent(p["_id"])
            future = executor.submit(agent.evaluate_opportunity, state)
            futures[future] = p["_id"]
        
        for future in as_completed(futures, timeout=60):
            participant_id = futures[future]
            try:
                result = future.result()
                if result:
                    all_bids.append(result)
                else:
                    logger.info(f"[{participant_id}] Passed on {state['syndication_id']}")
            except Exception as e:
                logger.error(f"[{participant_id}] Error evaluating: {e}")
    
    logger.info(f"Received {len(all_bids)} bids from {len(participants)} participants")
    return all_bids
