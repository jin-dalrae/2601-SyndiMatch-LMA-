"""
SyndiMatch - Participant Agent
Evaluates loan opportunities and makes bidding decisions
"""

from datetime import datetime
from typing import Dict, Any, List, Optional
import json
import logging
import uuid

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

from state import SyndicationState, BidDecision, Bid
from config import ANTHROPIC_API_KEY, AGENT_MODEL
import db

logger = logging.getLogger(__name__)


class ParticipantAgent:
    """
    Agent representing institutional investors (banks, funds, CLOs, etc.)
    Responsible for:
    - Evaluating loan opportunities against risk appetite
    - Making autonomous bidding decisions
    - Managing capital allocation
    - Paying fees and updating state after allocations
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
    
    def _load_profile(self) -> Dict[str, Any]:
        """Load participant profile from MongoDB"""
        profile = db.participant_agents().find_one({"_id": self.agent_id})
        if not profile:
            raise ValueError(f"Participant agent {self.agent_id} not found")
        return profile
    
    def _refresh_profile(self):
        """Refresh profile from database to get latest state"""
        try:
            self.profile = self._load_profile()
        except Exception as e:
            # Log warning instead of silently swallowing
            logger.warning(f"[{self.agent_id}] Profile refresh failed: {e}. Keeping existing.")

    def evaluate_opportunity(self, state: SyndicationState) -> Optional[Dict[str, Any]]:
        """
        Evaluate opportunity and submit bid if applicable.
        Used by the enhanced orchestrator for parallel execution.
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
        self._refresh_profile()
        
        # Check basic eligibility first
        if not self._passes_hard_constraints(state):
            return BidDecision(
                decision="pass",
                amount=0,
                spread=0,
                reasoning="Failed hard constraints check",
                portfolio_fit_score=0.0,
                constraints_violated=self._get_violated_constraints(state)
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
                    spread=decision_data.get("spread", state["current_spread"]),
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
- Min Acceptable Yield: {risk.get('min_acceptable_yield', 0)}%
- Target Yield: {risk.get('target_all_in_yield', 0)}%
- Investment Style: {strategy.get('investment_style', 'moderate')}
- Preferred Sectors: {self.profile.get('sector_preferences', {}).get('preferred', [])}
- Sectors to Avoid: {self.profile.get('sector_preferences', {}).get('avoid', [])}

## Loan Opportunity
- Syndication ID: {state['syndication_id']}
- Borrower: {state['loan_details']['borrower_name']}
- Industry: {state['loan_details']['industry']}
- Loan Type: {state['loan_details']['loan_type']}
- Credit Rating: {state['loan_details']['credit_rating']}
- Total Amount: ${state['loan_details']['total_amount']:,}
- Syndication Target: ${state['loan_details']['syndication_target']:,}
- Current Spread: {state['current_spread']} bps
- Base Rate: {state['pricing']['base_rate']}
- All-in Yield (estimated): {self._calculate_yield(state):.2f}%
- Current Subscription: {state['subscription_rate']*100:.1f}%
- Auction Round: {state['current_round']}
- Originator: {state['originator']}

## Decision Required
Based on your institution's profile and this loan opportunity:
1. Should you bid? Consider rating, yield, sector fit, available capital
2. If bidding, what amount? (between min ticket and available capacity)
3. What spread are you willing to accept?

Remember: Your available capital is ${risk.get('available_capacity', 0):,}. 
Do not bid more than you have available.
"""
    
    def _passes_hard_constraints(self, state: SyndicationState) -> bool:
        """Check if loan passes basic eligibility"""
        risk = self.profile.get("risk_appetite", {})
        sector_prefs = self.profile.get("sector_preferences", {})
        
        # Check available capacity with 2% buffer for fees
        available_cap = risk.get("available_capacity", 0)
        fee_buffer = available_cap * 0.02
        if (available_cap - fee_buffer) < risk.get("min_ticket", 0):
            return False
        
        # Check if sector is avoided
        if state["loan_details"]["industry"] in sector_prefs.get("avoid", []):
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
    
    def _rule_based_evaluation(self, state: SyndicationState) -> BidDecision:
        """Fallback rule-based evaluation if LLM fails"""
        risk = self.profile.get("risk_appetite", {})
        
        # Calculate yield using ACTUAL base rate, not hardcoded 4.5
        estimated_yield = self._calculate_yield(state)
        min_yield = risk.get("min_acceptable_yield", 0)
        
        if estimated_yield >= min_yield:
            amount = min(
                risk.get("max_single_ticket", 50000000),
                risk.get("available_capacity", 0),
                state["loan_details"]["syndication_target"] * 0.15
            )
            return BidDecision(
                decision="bid",
                amount=int(amount),
                spread=state["current_spread"],
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
    
    def submit_bid(self, state: SyndicationState, decision: BidDecision) -> Dict[str, Any]:
        """
        Submit a bid to the syndication.
        Updates MongoDB and returns bid record.
        """
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
            "valid_until": state["timeline"]["target_close_date"],
            "auction_round": state["current_round"],
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
        db.bids().insert_one(bid)
        
        # Update participant stats
        db.participant_agents().update_one(
            {"_id": self.agent_id},
            {
                "$inc": {"performance_history.bids_submitted_ytd": 1},
                "$set": {"last_bid_at": now}
            }
        )
        
        logger.info(f"[{self.agent_id}] Submitted bid: ${decision.amount:,} @ {decision.spread} bps")
        return bid
    
    def receive_allocation(self, syndication_id: str, allocation: Dict[str, Any]) -> None:
        """
        Process winning allocation and update participant state.
        Called when syndication closes with a winning bid.
        """
        amount = allocation["final_allocation"]
        
        # Update deployed capital and available capacity
        db.participant_agents().update_one(
            {"_id": self.agent_id},
            {
                "$inc": {
                    "risk_appetite.current_deployed": amount,
                    "risk_appetite.available_capacity": -amount,
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
    
    def make_payment(self, syndication_id: str, payment_type: str, amount: int) -> Dict[str, Any]:
        """
        Record payment made by participant.
        Updates capital state and payment history.
        """
        # This is tracked via PaymentAgent, but updates participant state
        now = datetime.utcnow()
        
        # For fees, don't reduce capacity (already counted in allocation)
        # Just track the payment
        db.participant_agents().update_one(
            {"_id": self.agent_id},
            {
                "$inc": {f"fees_paid.{payment_type}": amount},
                "$set": {"last_payment_at": now}
            }
        )
        
        logger.info(f"[{self.agent_id}] Made payment: ${amount:,} ({payment_type}) for {syndication_id}")
        return {
            "status": "paid",
            "participant": self.agent_id,
            "amount": amount,
            "payment_type": payment_type,
            "timestamp": now.isoformat()
        }

    def notify_auction_failed(self, syndication_id: str, reason: str):
        """Handle notification of failed auction"""
        logger.info(f"[{self.agent_id}] Auction failed for {syndication_id}: {reason}")
        # Release capital reservations if any (not implemented in this simplified version)

    def notify_settlement_failed(self, syndication_id: str):
        """Handle notification of failed settlement"""
        logger.warning(f"[{self.agent_id}] Settlement failed for {syndication_id}")


def evaluate_all_participants(state: SyndicationState) -> List[Dict[str, Any]]:
    """
    Fan-out function to evaluate all active participant agents in parallel.
    Returns list of bid decisions.
    """
    # Get all active participants
    participants = list(db.participant_agents().find({"status": "active"}))
    
    all_bids = []
    for p in participants:
        try:
            agent = ParticipantAgent(p["_id"])
            decision = agent.evaluate_loan(state)
            
            if decision and decision.decision == "bid":
                bid = agent.submit_bid(state, decision)
                all_bids.append(bid)
            else:
                logger.info(f"[{p['_id']}] Passed on {state['syndication_id']}: {decision.reasoning if decision else 'No decision'}")
        except Exception as e:
            logger.error(f"[{p['_id']}] Error evaluating: {e}")
    
    return all_bids
