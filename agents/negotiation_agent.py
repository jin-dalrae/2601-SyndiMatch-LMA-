"""
SyndiMatch - Enhanced Negotiation Agent
Runs multi-round Dutch auction with participant re-evaluation
"""

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import json
import logging

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

from .state import SyndicationState, AuctionDecision
from .config import (
    ANTHROPIC_API_KEY, AGENT_MODEL, 
    MAX_AUCTION_ROUNDS, MIN_SUBSCRIPTION_RATE, EARLY_CLOSE_THRESHOLD
)
from . import db

logger = logging.getLogger(__name__)


class NegotiationAgent:
    """
    Enhanced Dutch Auction Agent with:
    - Multi-round execution with participant re-evaluation
    - Bid ranking and competitive intelligence
    - Market clearing price logic
    - Detailed event logging for dashboard
    - Error handling and recovery
    """
    
    def __init__(self, syndication_id: str):
        self.syndication_id = syndication_id
        self.agent_id = f"NA-{syndication_id}"
        if ANTHROPIC_API_KEY and ANTHROPIC_API_KEY.startswith("sk-"):
            self.llm = ChatAnthropic(
                model=AGENT_MODEL,
                api_key=ANTHROPIC_API_KEY,
                temperature=0.3
            )
        else:
            self.llm = None
        self.config = None
    
    def _load_or_create_config(self, current_time_str: Optional[str] = None) -> Dict[str, Any]:
        """Load existing config or create new negotiation agent config"""
        existing = db.negotiation_agents().find_one({"_id": self.agent_id})
        if existing:
            return existing
        
        synd = db.syndications().find_one({"_id": self.syndication_id})
        if not synd:
            raise ValueError(f"Syndication {self.syndication_id} not found")
        
        now = datetime.fromisoformat(current_time_str) if current_time_str else datetime.utcnow()
        
        # Use robust parsing
        from dateutil.parser import isoparse
        target_close = isoparse(synd["timeline"]["target_close_date"])
        hours_remaining = (target_close - now).total_seconds() / 3600
        
        if hours_remaining < 48:
            urgency = "high"
            spread_decrement = 15
            round_duration = 15
        elif hours_remaining < 96:
            urgency = "medium"
            spread_decrement = 10
            round_duration = 30
        else:
            urgency = "low"
            spread_decrement = 5
            round_duration = 60
        
        starting_spread = synd["pricing"]["initial_spread"]
        min_spread = starting_spread - 50
        
        config = {
            "_id": self.agent_id,
            "agent_type": "negotiation",
            "syndication_id": self.syndication_id,
            "originator_agent_id": synd["originator_agent_id"],
            "originator": synd["originator"],
            "created_at": now,
            "status": "active",
            "auction_config": {
                "auction_type": "dutch",
                "starting_spread": starting_spread,
                "minimum_spread": min_spread,
                "spread_decrement": spread_decrement,
                "round_duration_minutes": round_duration,
                "max_rounds": MAX_AUCTION_ROUNDS,
                "target_subscription": synd["loan_details"]["syndication_target"],
                "min_subscription_rate": MIN_SUBSCRIPTION_RATE,
                "oversubscription_handling": "pro_rata_allocation",
                "pricing_type": "uniform"  # All winners pay clearing spread
            },
            "negotiation_strategy": {
                "urgency_level": urgency,
                "spread_flexibility": "moderate",
                "originator_mandate": "maximize_subscription_minimize_spread"
            },
            "performance_tracking": {
                "bids_received": 0,
                "unique_bidders": 0,
                "current_round": 0,
                "current_spread": starting_spread,
                "total_committed": 0,
                "subscription_rate": 0.0,
                "last_updated": now
            }
        }
        
        db.negotiation_agents().insert_one(config)
        return config

    def calculate_max_rounds(self, state: SyndicationState) -> int:
        if not self.config:
            self.config = self._load_or_create_config(state.get("current_time"))
        return self.config["auction_config"]["max_rounds"]

    def get_round_duration(self, state: SyndicationState) -> int:
        if not self.config:
            self.config = self._load_or_create_config(state.get("current_time"))
        return self.config["auction_config"]["round_duration_minutes"]

    def run_auction_round(self, state: SyndicationState, round_num: int) -> SyndicationState:
        """Run a single auction round"""
        # Lazy load config
        if not self.config:
            self.config = self._load_or_create_config(state.get("current_time"))
        
        # Ensure state contains required keys
        state.setdefault("rejected_bids", [])
        state.setdefault("allocations", [])
        state.setdefault("auction_history", [])
        
        state["status"] = "negotiating"
        state["negotiation_agent_id"] = self.agent_id
        state["current_round"] = round_num
        
        # Collect bids
        bids = list(db.bids().find({
            "syndication_id": self.syndication_id,
            "bid_status": "active",
            "spread_bid": {"$lte": state["current_spread"]}
        }))
        
        # Calculate stats
        target = self.config["auction_config"]["target_subscription"]
        total_committed = sum(b["bid_amount"] for b in bids)
        subscription_rate = total_committed / target if target > 0 else 0
        
        state["total_committed"] = total_committed
        state["subscription_rate"] = subscription_rate
        
        # Initialize negotiation_state if needed (orchestrator uses this)
        if "negotiation_state" not in state:
             state["negotiation_state"] = {}
        state["negotiation_state"]["current_spread"] = state["current_spread"]
        state["negotiation_state"]["total_committed"] = total_committed
        state["negotiation_state"]["subscription_rate"] = subscription_rate
        state["negotiation_state"]["auction_round"] = round_num
        
        # Log round
        round_record = {
            "round": round_num,
            "spread": state["current_spread"],
            "total_committed": total_committed,
            "subscription_rate": subscription_rate,
            "bids_count": len(bids),
            "timestamp": datetime.utcnow().isoformat()
        }
        if "auction_history" not in state:
            state["auction_history"] = []
        state["auction_history"].append(round_record)
        
        # Update DB
        self._update_syndication(state)
        self._update_tracking(state, len(bids))
        
        logger.info(f"[{self.agent_id}] Round {round_num}: "
                   f"${total_committed:,} ({subscription_rate*100:.1f}%) @ {state['current_spread']} bps")
        
        # Prepare spread for next round (decrement)
        # But only if not closing? Orchestrator loop controls flow.
        # We decrement here so next round uses lower spread.
        spread_decrement = self.config["auction_config"]["spread_decrement"]
        min_spread = self.config["auction_config"]["minimum_spread"]
        
        new_spread = state["current_spread"] - spread_decrement
        # Don't go below min spread (logic handled in is_auction_failing or next checking)
        # Just update state for next iteration
        state["current_spread"] = max(new_spread, min_spread)
        
        return state

    def should_close_auction(self, state: SyndicationState) -> bool:
        """Check if auction should close successfully"""
        sub_rate = state["negotiation_state"]["subscription_rate"]
        round_num = state["negotiation_state"]["auction_round"]
        
        if sub_rate >= 1.0:
            return True
        
        if sub_rate >= EARLY_CLOSE_THRESHOLD and round_num >= 3:
            return True
            
        # Check min spread reached logic - if we hit min spread and have min subscription
        min_spread = self.config["auction_config"]["minimum_spread"]
        current_spread = state["negotiation_state"]["current_spread"]
        
        if current_spread <= min_spread and sub_rate >= MIN_SUBSCRIPTION_RATE:
            return True
            
        return False

    def is_auction_failing(self, state: SyndicationState, round_num: int, max_rounds: int) -> bool:
        """Check if auction is failing"""
        min_spread = self.config["auction_config"]["minimum_spread"]
        current_spread = state["negotiation_state"]["current_spread"]
        sub_rate = state["negotiation_state"]["subscription_rate"]
        
        # Hit min spread without enough subscription
        if current_spread <= min_spread and sub_rate < MIN_SUBSCRIPTION_RATE:
            return True
            
        return False

    def finalize_auction(self, state: SyndicationState) -> SyndicationState:
        """Finalize auction based on final state"""
        bids = list(db.bids().find({
            "syndication_id": self.syndication_id,
            "bid_status": "active"
        }))
        
        sub_rate = state["negotiation_state"]["subscription_rate"]
        
        if sub_rate >= MIN_SUBSCRIPTION_RATE:
            if sub_rate >= 1.0:
                reason = "fully_subscribed"
            elif sub_rate >= EARLY_CLOSE_THRESHOLD:
                reason = "early_close"
            else:
                reason = "max_rounds_reached" # or min spread reached
                
            return self._close_auction(state, bids, reason)
        else:
            return self._fail_auction(state, "insufficient_subscription")
    
    def calculate_max_rounds(self, state: SyndicationState) -> int:
        """Calculate maximum rounds based on syndication parameters"""
        if not self.config:
            self.config = self._load_or_create_config(state.get("current_time"))
        return self.config["auction_config"].get("max_rounds", MAX_AUCTION_ROUNDS)
    
    def should_close_auction(self, state: SyndicationState) -> bool:
        """Check if auction should close early"""
        subscription = state.get("subscription_rate", 0)
        if subscription >= 1.0:
            return True
        if subscription >= EARLY_CLOSE_THRESHOLD and state.get("current_round", 0) >= 3:
            return True
        return False
    
    def is_auction_failing(self, state: SyndicationState, current_round: int, max_rounds: int) -> bool:
        """Check if auction is failing and should be terminated"""
        subscription = state.get("subscription_rate", 0)
        
        # If at max rounds with insufficient subscription
        if current_round >= max_rounds and subscription < MIN_SUBSCRIPTION_RATE:
            return True
        
        # If no bids after multiple rounds
        if current_round >= 3 and subscription == 0:
            return True
        
        return False
    
    def get_round_duration(self, state: SyndicationState) -> int:
        """Get duration for current round in minutes"""
        if not self.config:
            self.config = self._load_or_create_config(state.get("current_time"))
        return self.config["auction_config"].get("round_duration_minutes", 30)
    
    def run_auction_round(self, state: SyndicationState, round_num: int) -> SyndicationState:
        """Execute a single auction round with bid updates"""
        if not self.config:
            self.config = self._load_or_create_config(state.get("current_time"))
        
        logger.info(f"[{self.agent_id}] Running round {round_num}")
        
        state["current_round"] = round_num
        target = self.config["auction_config"]["target_subscription"]
        
        # Get active bids that meet current spread
        bids = list(db.bids().find({
            "syndication_id": self.syndication_id,
            "bid_status": {"$in": ["active", "provisional_winner"]},
            "spread_bid": {"$lte": state["current_spread"]}
        }))
        
        # Update bid statuses - mark bids above current spread as "outbid"
        db.bids().update_many(
            {
                "syndication_id": self.syndication_id,
                "bid_status": "active",
                "spread_bid": {"$gt": state["current_spread"]}
            },
            {"$set": {"bid_status": "outbid"}}
        )
        
        # Calculate rankings
        self._calculate_bid_rankings(bids)
        
        # Calculate commitment
        total_committed = sum(b["bid_amount"] for b in bids)
        subscription_rate = total_committed / target if target > 0 else 0
        
        state["total_committed"] = total_committed
        state["subscription_rate"] = subscription_rate
        
        # Store negotiation state
        state["negotiation_state"] = {
            "current_spread": state["current_spread"],
            "total_committed": total_committed,
            "subscription_rate": subscription_rate,
            "auction_round": round_num,
            "active_bids": len(bids)
        }
        
        # Log auction round
        round_record = {
            "round": round_num,
            "spread": state["current_spread"],
            "total_committed": total_committed,
            "subscription_rate": subscription_rate,
            "bids_count": len(bids),
            "timestamp": datetime.utcnow().isoformat()
        }
        
        if "auction_history" not in state:
            state["auction_history"] = []
        state["auction_history"].append(round_record)
        
        # Publish event for dashboard
        self._publish_round_event(state, round_num, bids)
        
        # Update MongoDB
        self._update_syndication(state)
        self._update_tracking(state, len(bids))
        
        logger.info(f"[{self.agent_id}] Round {round_num}: "
                   f"${total_committed:,} ({subscription_rate*100:.1f}%) @ {state['current_spread']} bps")
        
        return state
    
    def _calculate_bid_rankings(self, bids: List[Dict]) -> None:
        """Calculate and update bid rankings for competitive intelligence"""
        if not bids:
            return
        
        # Sort by amount (descending)
        by_amount = sorted(bids, key=lambda b: b["bid_amount"], reverse=True)
        
        # Sort by spread (ascending - lower spread = better)
        by_spread = sorted(bids, key=lambda b: b["spread_bid"])
        
        for i, bid in enumerate(by_amount):
            amount_rank = i + 1
            spread_rank = next((j + 1 for j, b in enumerate(by_spread) if b["_id"] == bid["_id"]), 0)
            
            # Update bid with rankings
            db.bids().update_one(
                {"_id": bid["_id"]},
                {
                    "$set": {
                        "rank_by_amount": amount_rank,
                        "rank_by_spread": spread_rank,
                        "overall_rank": (amount_rank + spread_rank) // 2
                    }
                }
            )
    
    def _publish_round_event(self, state: SyndicationState, round_num: int, bids: List[Dict]) -> None:
        """Publish detailed round event for dashboard"""
        event = {
            "syndication_id": self.syndication_id,
            "event_type": "AUCTION_ROUND",
            "timestamp": datetime.utcnow().isoformat(),
            "data": {
                "round": round_num,
                "current_spread": state["current_spread"],
                "total_committed": state["total_committed"],
                "subscription_rate": state["subscription_rate"],
                "active_bids": len(bids),
                "spread_distribution": self._get_spread_distribution(bids),
                "amount_distribution": self._get_amount_distribution(bids)
            }
        }
        
        try:
            db.get_collection("syndication_events").insert_one(event)
        except Exception as e:
            logger.warning(f"Failed to publish round event: {e}")
    
    def _get_spread_distribution(self, bids: List[Dict]) -> Dict[str, int]:
        """Get anonymized spread distribution for competitive intelligence"""
        if not bids:
            return {}
        
        spreads = [b["spread_bid"] for b in bids]
        return {
            "min": min(spreads),
            "max": max(spreads),
            "avg": int(sum(spreads) / len(spreads)),
            "count": len(spreads)
        }
    
    def _get_amount_distribution(self, bids: List[Dict]) -> Dict[str, int]:
        """Get anonymized amount distribution"""
        if not bids:
            return {}
        
        amounts = [b["bid_amount"] for b in bids]
        return {
            "min": min(amounts),
            "max": max(amounts),
            "avg": int(sum(amounts) / len(amounts)),
            "total": sum(amounts)
        }
    
    def run_auction(self, state: SyndicationState) -> SyndicationState:
        """Main auction loop with multi-round support"""
        logger.info(f"[{self.agent_id}] Starting auction for {self.syndication_id}")
        
        if not self.config:
            self.config = self._load_or_create_config(state.get("current_time"))
        
        state["status"] = "negotiating"
        state["negotiation_agent_id"] = self.agent_id
        
        auction_config = self.config["auction_config"]
        target = auction_config["target_subscription"]
        max_rounds = auction_config["max_rounds"]
        spread_decrement = auction_config["spread_decrement"]
        min_spread = auction_config["minimum_spread"]
        
        # Handle case of no bids at all
        initial_bids = db.bids().count_documents({"syndication_id": self.syndication_id})
        if initial_bids == 0:
            logger.warning(f"[{self.agent_id}] No bids received for auction")
            return self._fail_auction(state, "no_bids_received")
        
        while state["current_round"] < max_rounds:
            state["current_round"] += 1
            
            # Collect active bids for this round
            bids = list(db.bids().find({
                "syndication_id": self.syndication_id,
                "bid_status": {"$in": ["active", "provisional_winner"]},
                "spread_bid": {"$lte": state["current_spread"]}
            }))
            
            # Update outbid status
            db.bids().update_many(
                {
                    "syndication_id": self.syndication_id,
                    "bid_status": "active",
                    "spread_bid": {"$gt": state["current_spread"]}
                },
                {"$set": {"bid_status": "outbid"}}
            )
            
            # Calculate rankings
            self._calculate_bid_rankings(bids)
            
            # Calculate commitment
            total_committed = sum(b["bid_amount"] for b in bids)
            subscription_rate = total_committed / target if target > 0 else 0
            
            state["total_committed"] = total_committed
            state["subscription_rate"] = subscription_rate
            
            # Update negotiation state
            state["negotiation_state"] = {
                "current_spread": state["current_spread"],
                "total_committed": total_committed,
                "subscription_rate": subscription_rate,
                "auction_round": state["current_round"],
                "active_bids": len(bids)
            }
            
            # Log auction round
            round_record = {
                "round": state["current_round"],
                "spread": state["current_spread"],
                "total_committed": total_committed,
                "subscription_rate": subscription_rate,
                "bids_count": len(bids),
                "timestamp": datetime.utcnow().isoformat()
            }
            
            if "auction_history" not in state:
                state["auction_history"] = []
            state["auction_history"].append(round_record)
            
            # Update MongoDB
            self._update_syndication(state)
            self._update_tracking(state, len(bids))
            
            logger.info(f"[{self.agent_id}] Round {state['current_round']}: "
                       f"${total_committed:,} ({subscription_rate*100:.1f}%) @ {state['current_spread']} bps")
            
            # Check if we should close
            if subscription_rate >= 1.0:
                logger.info(f"[{self.agent_id}] Fully subscribed, closing auction")
                return self._close_auction(state, bids, "fully_subscribed")
            
            if subscription_rate >= EARLY_CLOSE_THRESHOLD and state["current_round"] >= 3:
                logger.info(f"[{self.agent_id}] Early close threshold met")
                return self._close_auction(state, bids, "early_close")
            
            # Lower spread for next round
            new_spread = state["current_spread"] - spread_decrement
            if new_spread < min_spread:
                logger.info(f"[{self.agent_id}] Minimum spread reached")
                if subscription_rate >= MIN_SUBSCRIPTION_RATE:
                    return self._close_auction(state, bids, "min_spread_reached")
                else:
                    return self._fail_auction(state, "below_minimum_subscription")
            
            state["current_spread"] = new_spread
        
        # Max rounds reached
        if state["subscription_rate"] >= MIN_SUBSCRIPTION_RATE:
            bids = list(db.bids().find({
                "syndication_id": self.syndication_id,
                "bid_status": {"$in": ["active", "provisional_winner"]}
            }))
            return self._close_auction(state, bids, "max_rounds_reached")
        else:
            return self._fail_auction(state, "max_rounds_insufficient_subscription")
    
    def finalize_auction(self, state: SyndicationState) -> SyndicationState:
        """Finalize auction after all rounds complete"""
        bids = list(db.bids().find({
            "syndication_id": self.syndication_id,
            "bid_status": {"$in": ["active", "provisional_winner"]}
        }))
        
        if state.get("subscription_rate", 0) >= MIN_SUBSCRIPTION_RATE:
            return self._close_auction(state, bids, "auction_complete")
        else:
            return self._fail_auction(state, "insufficient_subscription")
    
    def _close_auction(self, state: SyndicationState, bids: List[Dict], 
                       reason: str) -> SyndicationState:
        """Close auction with uniform price (all pay clearing spread)"""
        logger.info(f"[{self.agent_id}] Closing auction: {reason}")

        if not self.config:
            self.config = self._load_or_create_config(state.get("current_time"))
        # Ensure collections exist
        state.setdefault("rejected_bids", [])
        
        target = self.config["auction_config"]["target_subscription"]
        total_bids = sum(b["bid_amount"] for b in bids)
        
        allocations = []
        final_spread = state["current_spread"]  # Uniform price - all pay this
        
        # Sort bids by spread then amount for pro-rata
        sorted_bids = sorted(bids, key=lambda b: (b["spread_bid"], -b["bid_amount"]))
        
        if total_bids <= target:
            # All bids get full allocation at clearing spread
            for bid in sorted_bids:
                alloc = self._create_allocation(bid, bid["bid_amount"], final_spread, "full_allocation", target)
                allocations.append(alloc)
        else:
            # Pro-rata allocation
            pro_rata_factor = target / total_bids if total_bids > 0 else 0
            for bid in sorted_bids:
                alloc_amount = int(bid["bid_amount"] * pro_rata_factor)
                if alloc_amount >= bid.get("min_allocation", 0):
                    alloc = self._create_allocation(bid, alloc_amount, final_spread, "pro_rata", target)
                    alloc["pro_rata_haircut"] = round(1 - pro_rata_factor, 4)
                    allocations.append(alloc)
                else:
                    db.bids().update_one(
                        {"_id": bid["_id"]},
                        {"$set": {"bid_status": "rejected"}}
                    )
                    state["rejected_bids"].append({
                        "bid_id": bid["_id"],
                        "participant": bid["institution_name"],
                        "reason": "below_minimum_allocation"
                    })
        
        # Mark winning bids
        for alloc in allocations:
            db.bids().update_one(
                {"_id": alloc["bid_id"]},
                {"$set": {"bid_status": "provisional_winner", "final_spread": final_spread}}
            )
        
        # Calculate allocation percentages for analytics
        total_allocated = sum(a["final_allocation"] for a in allocations)
        for a in allocations:
            a["allocation_percentage"] = round(a["final_allocation"] / total_allocated * 100, 2) if total_allocated > 0 else 0

        state["allocations"] = allocations
        state["status"] = "closing"
        
        # Update negotiation agent
        db.negotiation_agents().update_one(
            {"_id": self.agent_id},
            {
                "$set": {
                    "status": "completed",
                    "completed_at": datetime.utcnow(),
                    "close_reason": reason,
                    "final_spread": final_spread,
                    "winners_count": len(allocations),
                    "clearing_price": final_spread
                }
            }
        )
        
        # Store allocations
        allocation_doc = {
            "_id": f"ALLOC-{self.syndication_id}",
            "syndication_id": self.syndication_id,
            "allocation_status": "provisional",
            "negotiation_agent_id": self.agent_id,
            "allocations": allocations,
            "auction_results": {
                "total_rounds": state["current_round"],
                "final_spread": final_spread,
                "clearing_spread": final_spread,
                "total_bids_received": len(bids),
                "winning_bids": len(allocations),
                "close_reason": reason,
                "subscription_rate": state["subscription_rate"]
            },
            "created_at": datetime.utcnow()
        }
        db.allocations().replace_one(
            {"_id": allocation_doc["_id"]},
            allocation_doc,
            upsert=True
        )
        
        self._update_syndication(state)
        return state
    
    def _create_allocation(self, bid: Dict, amount: int, spread: int, 
                          method: str, total_syndicated: int) -> Dict[str, Any]:
        """Create allocation with proper percentage calculation"""
        fees = self._calculate_fees(amount)
        
        return {
            "_id": f"ALLOC-{bid['_id']}",
            "bid_id": bid["_id"],
            "participant_agent_id": bid["participant_agent_id"],
            "institution_name": bid["institution_name"],
            "institution_type": bid["institution_type"],
            "original_bid_amount": bid["bid_amount"],
            "original_spread_bid": bid["spread_bid"],
            "final_allocation": amount,
            "allocation_percentage": round(amount / total_syndicated, 4) if total_syndicated > 0 else 0,
            "final_spread": spread,
            "allocation_method": method,
            "commitment_status": "pending",
            "commitment_letter_signed": False,
            "fees": fees,
            "settlement_stage": "allocation_confirmation",
            "rank_by_amount": bid.get("rank_by_amount", 0),
            "rank_by_spread": bid.get("rank_by_spread", 0),
            "created_at": datetime.utcnow().isoformat()
        }
    
    def _calculate_fees(self, amount: int) -> Dict[str, Any]:
        """Calculate fees for an allocation"""
        synd = db.syndications().find_one({"_id": self.syndication_id})
        pricing = synd.get("pricing", {}) if synd else {}
        commitment_fee_pct = pricing.get("commitment_fee", 0.5)
        arrangement_fee_pct = pricing.get("arrangement_fee", 2.0)
        upfront_fee_pct = pricing.get("upfront_fee", 1.0)
        
        return {
            "commitment_fee": int(amount * commitment_fee_pct / 100),
            "commitment_fee_percentage": commitment_fee_pct,
            "arrangement_fee": int(amount * arrangement_fee_pct / 100),
            "arrangement_fee_percentage": arrangement_fee_pct,
            "upfront_fee": int(amount * upfront_fee_pct / 100),
            "upfront_fee_percentage": upfront_fee_pct,
            "total_fees": int(amount * (commitment_fee_pct + arrangement_fee_pct + upfront_fee_pct) / 100)
        }
    
    def _fail_auction(self, state: SyndicationState, reason: str) -> SyndicationState:
        """Handle auction failure"""
        logger.warning(f"[{self.agent_id}] Auction failed: {reason}")
        
        state["status"] = "failed"
        state["failure_reason"] = reason
        if "errors" not in state:
            state["errors"] = []
        state["errors"].append(f"Auction failed: {reason}")
        
        db.negotiation_agents().update_one(
            {"_id": self.agent_id},
            {
                "$set": {
                    "status": "failed",
                    "failed_at": datetime.utcnow(),
                    "failure_reason": reason
                }
            }
        )
        
        self._update_syndication(state)
        return state
    
    def _update_syndication(self, state: SyndicationState) -> None:
        """Update syndication document"""
        state["updated_at"] = datetime.utcnow().isoformat()
        
        update_fields = {
            "status": state["status"],
            "current_round": state.get("current_round", 0),
            "current_spread": state.get("current_spread", 0),
            "total_committed": state.get("total_committed", 0),
            "subscription_rate": state.get("subscription_rate", 0),
            "updated_at": state["updated_at"]
        }
        
        if "auction_history" in state:
            update_fields["auction_history"] = state["auction_history"]
        if "allocations" in state:
            update_fields["allocations"] = state["allocations"]
        if "rejected_bids" in state:
            update_fields["rejected_bids"] = state["rejected_bids"]
        if "negotiation_state" in state:
            update_fields["negotiation_state"] = state["negotiation_state"]
        
        db.syndications().update_one(
            {"_id": self.syndication_id},
            {"$set": update_fields}
        )
    
    def _update_tracking(self, state: SyndicationState, bid_count: int) -> None:
        """Update negotiation agent tracking"""
        unique_bidders = db.bids().distinct(
            "participant_agent_id",
            {"syndication_id": self.syndication_id}
        )
        
        db.negotiation_agents().update_one(
            {"_id": self.agent_id},
            {"$set": {
                "performance_tracking.bids_received": bid_count,
                "performance_tracking.unique_bidders": len(unique_bidders),
                "performance_tracking.current_round": state.get("current_round", 0),
                "performance_tracking.current_spread": state.get("current_spread", 0),
                "performance_tracking.total_committed": state.get("total_committed", 0),
                "performance_tracking.subscription_rate": state.get("subscription_rate", 0),
                "performance_tracking.last_updated": datetime.utcnow()
            }}
        )
    
    def get_competitive_intelligence(self) -> Dict[str, Any]:
        """Get anonymized competitive data for participants"""
        bids = list(db.bids().find({
            "syndication_id": self.syndication_id,
            "bid_status": {"$in": ["active", "provisional_winner"]}
        }))
        
        if not bids:
            return {"message": "No active bids"}
        
        spreads = [b["spread_bid"] for b in bids]
        amounts = [b["bid_amount"] for b in bids]
        
        return {
            "total_bidders": len(bids),
            "spread_stats": {
                "min": min(spreads),
                "max": max(spreads),
                "avg": int(sum(spreads) / len(spreads)),
                "median": sorted(spreads)[len(spreads) // 2]
            },
            "amount_stats": {
                "min": min(amounts),
                "max": max(amounts),
                "avg": int(sum(amounts) / len(amounts)),
                "total": sum(amounts)
            }
        }
