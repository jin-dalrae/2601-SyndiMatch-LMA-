"""
SyndiMatch - Negotiation Agent
Runs Dutch auction to find market clearing price
"""

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import json
import logging

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

from state import SyndicationState, AuctionDecision
from config import (
    ANTHROPIC_API_KEY, AGENT_MODEL, 
    MAX_AUCTION_ROUNDS, MIN_SUBSCRIPTION_RATE, EARLY_CLOSE_THRESHOLD
)
import db

logger = logging.getLogger(__name__)


class NegotiationAgent:
    """
    Agent that manages the Dutch auction process for a syndication.
    Responsible for:
    - Running auction rounds
    - Adjusting spread based on market response
    - Determining winners and allocations
    - Coordinating with participants
    """
    
    def __init__(self, syndication_id: str):
        self.syndication_id = syndication_id
        self.agent_id = f"NA-{syndication_id}"
        self.llm = ChatAnthropic(
            model=AGENT_MODEL,
            api_key=ANTHROPIC_API_KEY,
            temperature=0.3
        )
        self.config = None
    
    def _load_or_create_config(self, current_time_str: Optional[str] = None) -> Dict[str, Any]:
        """Load existing config or create new negotiation agent config"""
        existing = db.negotiation_agents().find_one({"_id": self.agent_id})
        if existing:
            return existing
        
        # Load syndication to create config
        synd = db.syndications().find_one({"_id": self.syndication_id})
        if not synd:
            raise ValueError(f"Syndication {self.syndication_id} not found")
        
        # Calculate urgency using simulated time if provided
        now = datetime.fromisoformat(current_time_str) if current_time_str else datetime.utcnow()
        target_close = datetime.fromisoformat(synd["timeline"]["target_close_date"].replace("Z", ""))
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
                "oversubscription_handling": "pro_rata_allocation"
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
    
    def run_auction(self, state: SyndicationState) -> SyndicationState:
        """
        Main auction loop. Runs rounds until target is met or max rounds reached.
        """
        logger.info(f"[{self.agent_id}] Starting auction for {self.syndication_id}")
        
        # Lazy load config with simulation time
        if not self.config:
            self.config = self._load_or_create_config(state.get("current_time"))
        
        state["status"] = "negotiating"
        state["negotiation_agent_id"] = self.agent_id
        
        auction_config = self.config["auction_config"]
        target = auction_config["target_subscription"]
        max_rounds = auction_config["max_rounds"]
        spread_decrement = auction_config["spread_decrement"]
        min_spread = auction_config["minimum_spread"]
        
        while state["current_round"] < max_rounds:
            state["current_round"] += 1
            
            # Collect all active bids for this round
            bids = list(db.bids().find({
                "syndication_id": self.syndication_id,
                "bid_status": "active",
                "spread_bid": {"$lte": state["current_spread"]}
            }))
            
            # Calculate commitment
            total_committed = sum(b["bid_amount"] for b in bids)
            subscription_rate = total_committed / target if target > 0 else 0
            
            state["total_committed"] = total_committed
            state["subscription_rate"] = subscription_rate
            
            # Log auction round
            round_record = {
                "round": state["current_round"],
                "spread": state["current_spread"],
                "total_committed": total_committed,
                "subscription_rate": subscription_rate,
                "bids_count": len(bids),
                "timestamp": datetime.utcnow().isoformat()
            }
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
                "bid_status": "active"
            }))
            return self._close_auction(state, bids, "max_rounds_reached")
        else:
            return self._fail_auction(state, "max_rounds_insufficient_subscription")
    
    def _close_auction(self, state: SyndicationState, bids: List[Dict], 
                       reason: str) -> SyndicationState:
        """
        Close auction and determine final allocations.
        Handles oversubscription with pro-rata allocation.
        """
        logger.info(f"[{self.agent_id}] Closing auction: {reason}")
        
        target = self.config["auction_config"]["target_subscription"]
        total_bids = sum(b["bid_amount"] for b in bids)
        
        allocations = []
        final_spread = state["current_spread"]
        
        if total_bids <= target:
            # All bids get full allocation
            for bid in bids:
                alloc = self._create_allocation(bid, bid["bid_amount"], final_spread, "full_allocation")
                allocations.append(alloc)
        else:
            # Pro-rata allocation
            pro_rata_factor = target / total_bids
            for bid in bids:
                alloc_amount = int(bid["bid_amount"] * pro_rata_factor)
                # Respect minimum allocation
                if alloc_amount >= bid.get("min_allocation", 0):
                    alloc = self._create_allocation(bid, alloc_amount, final_spread, "pro_rata")
                    alloc["pro_rata_haircut"] = round(1 - pro_rata_factor, 4)
                    allocations.append(alloc)
                else:
                    # Unable to meet minimum, reject
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
                {"$set": {"bid_status": "provisional_winner"}}
            )
        
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
                    "winners_count": len(allocations)
                }
            }
        )
        
        # Store allocations in MongoDB
        allocation_doc = {
            "_id": f"ALLOC-{self.syndication_id}",
            "syndication_id": self.syndication_id,
            "allocation_status": "provisional",
            "negotiation_agent_id": self.agent_id,
            "allocations": allocations,
            "auction_results": {
                "total_rounds": state["current_round"],
                "final_spread": final_spread,
                "total_bids_received": len(bids),
                "winning_bids": len(allocations),
                "close_reason": reason
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
                          method: str) -> Dict[str, Any]:
        """Create an allocation record from a bid"""
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
            "allocation_percentage": 0,  # Will be calculated
            "final_spread": spread,
            "allocation_method": method,
            "commitment_status": "pending",
            "commitment_letter_signed": False,
            "fees": fees,
            "settlement_stage": "allocation_confirmation",
            "created_at": datetime.utcnow().isoformat()
        }
    
    def _calculate_fees(self, amount: int) -> Dict[str, Any]:
        """Calculate fees for an allocation"""
        synd = db.syndications().find_one({"_id": self.syndication_id})
        commitment_fee_pct = synd.get("pricing", {}).get("commitment_fee", 0.5)
        arrangement_fee_pct = 2.0  # Standard
        
        return {
            "commitment_fee": int(amount * commitment_fee_pct / 100),
            "commitment_fee_percentage": commitment_fee_pct,
            "arrangement_fee": int(amount * arrangement_fee_pct / 100),
            "arrangement_fee_percentage": arrangement_fee_pct,
            "total_fees": int(amount * (commitment_fee_pct + arrangement_fee_pct) / 100)
        }
    
    def _fail_auction(self, state: SyndicationState, reason: str) -> SyndicationState:
        """Handle auction failure"""
        logger.warning(f"[{self.agent_id}] Auction failed: {reason}")
        
        state["status"] = "failed"
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
        """Update syndication document in MongoDB"""
        state["updated_at"] = datetime.utcnow().isoformat()
        db.syndications().update_one(
            {"_id": self.syndication_id},
            {"$set": {
                "status": state["status"],
                "current_round": state["current_round"],
                "current_spread": state["current_spread"],
                "total_committed": state["total_committed"],
                "subscription_rate": state["subscription_rate"],
                "auction_history": state["auction_history"],
                "allocations": state["allocations"],
                "rejected_bids": state["rejected_bids"],
                "updated_at": state["updated_at"]
            }}
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
                "performance_tracking.current_round": state["current_round"],
                "performance_tracking.current_spread": state["current_spread"],
                "performance_tracking.total_committed": state["total_committed"],
                "performance_tracking.subscription_rate": state["subscription_rate"],
                "performance_tracking.last_updated": datetime.utcnow()
            }}
        )
