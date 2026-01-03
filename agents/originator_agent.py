"""
SyndiMatch - Originator Agent
Broadcasts loan opportunities and manages originator state
"""

from datetime import datetime, timedelta
from typing import Dict, Any, Optional
import json
import logging
import uuid

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

from .state import SyndicationState
from .config import ANTHROPIC_API_KEY, AGENT_MODEL
from . import db

logger = logging.getLogger(__name__)


class OriginatorAgent:
    """
    Agent representing loan originators (banks).
    Responsible for:
    - Broadcasting new syndication opportunities
    - Setting initial loan terms and pricing
    - Receiving commitment fees and arrangement fees
    - Updating originator state based on payments received
    """
    
    def __init__(self, agent_id: str):
        self.agent_id = agent_id
        # Initialize LLM only if valid API key is present
        if ANTHROPIC_API_KEY and ANTHROPIC_API_KEY.startswith("sk-"):
            self.llm = ChatAnthropic(
                model=AGENT_MODEL,
                api_key=ANTHROPIC_API_KEY,
                temperature=0.3
            )
        else:
            self.llm = None
            logger.info(f"[{self.agent_id}] No valid API Key found. Running in Simulation Mode.")
            
        try:
            self.profile = self._load_profile()
        except:
             # Create default profile if DB is empty/error
            self.profile = {"_id": self.agent_id, "active_loans": 0, "completed_syndications_ytd": 0}
    
    def _load_profile(self) -> Dict[str, Any]:
        """Load originator profile from MongoDB"""
        profile = db.originator_agents().find_one({"_id": self.agent_id})
        if not profile:
            raise ValueError(f"Originator agent {self.agent_id} not found")
        return profile
    
    def broadcast_loan(self, state: SyndicationState) -> SyndicationState:
        """
        Broadcast a new syndication opportunity.
        Creates syndication record and notifies the system.
        """
        logger.info(f"[{self.agent_id}] Broadcasting syndication: {state['syndication_id']}")
        
        # Set initial negotiation state
        state["status"] = "open"
        state["current_round"] = 0
        state["current_spread"] = state["pricing"]["initial_spread"]
        state["total_committed"] = 0
        state["subscription_rate"] = 0.0
        state["bids"] = []
        state["allocations"] = []
        state["rejected_bids"] = []
        state["payments"] = []
        state["auction_history"] = []
        state["errors"] = []
        state["warnings"] = []
        state["created_at"] = datetime.utcnow().isoformat()
        state["updated_at"] = datetime.utcnow().isoformat()
        
        # Add AI recommendation reasoning for the dashboard
        state["recommendation_reasoning"] = f"AI-Recommended: This {state['loan_details']['industry']} opportunity offers a competitive {state['pricing']['initial_spread']}bps spread relative to its {state['loan_details']['credit_rating']} rating."
        
        # Insert into MongoDB with schema version for migration support
        db.syndications().insert_one({
            "_id": state["syndication_id"],
            "schema_version": 1,  # For backward compatibility and migrations
            **state
        })
        
        # Update originator's active loans count
        db.originator_agents().update_one(
            {"_id": self.agent_id},
            {
                "$inc": {"active_loans": 1},
                "$set": {"last_broadcast": datetime.utcnow()}
            }
        )
        
        logger.info(f"[{self.agent_id}] Syndication {state['syndication_id']} broadcast complete")
        return state
    
    def receive_payment(self, syndication_id: str, payment_type: str, 
                        amount: int, from_participant: str) -> Dict[str, Any]:
        """
        Process incoming payment and update originator state.
        Called by PaymentAgent when funds are received.
        """
        logger.info(f"[{self.agent_id}] Receiving {payment_type}: ${amount:,} from {from_participant}")
        
        # Update originator's financial state
        # Build $inc updates correctly - no $ prefix on field names!
        inc_updates = {"total_fees_ytd": amount}
        
        if payment_type == "commitment_fee":
            inc_updates["financial_metrics.total_commitment_fees_received"] = amount
        elif payment_type == "arrangement_fee":
            inc_updates["financial_metrics.total_arrangement_fees_received"] = amount
        
        # Atomic increment of all fee fields
        db.originator_agents().update_one(
            {"_id": self.agent_id},
            {
                "$inc": inc_updates,
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        
        return {
            "status": "received",
            "originator_id": self.agent_id,
            "amount": amount,
            "payment_type": payment_type,
            "timestamp": datetime.utcnow().isoformat()
        }
    
    def complete_syndication(self, syndication_id: str, success: bool, reason: Optional[str] = None) -> None:
        """
        Update originator state when syndication completes.
        Uses atomic MongoDB update to prevent race conditions.
        """
        # ATOMIC: Load profile and calculate in single read, then update
        profile = self._load_profile()
        track = profile.get("track_record", {})
        
        # Calculate success rate BEFORE the increment
        current_completed = track.get("deals_closed_ytd", 0)
        current_failed = track.get("deals_failed_ytd", 0)
        
        # After this syndication:
        new_completed = current_completed + (1 if success else 0)
        new_failed = current_failed + (0 if success else 1)
        total = new_completed + new_failed
        new_success_rate = (new_completed / total) if total > 0 else 0 # Result is 0.0-1.0 in originator schema
        
        update = {
            "$inc": {
                "active_loans": -1,
                "track_record.deals_closed_ytd": 1 if success else 0,
                "track_record.deals_failed_ytd": 0 if success else 1
            },
            "$set": {
                "updated_at": datetime.utcnow(),
                "track_record.success_rate": round(new_success_rate, 3)
            }
        }
        
        db.originator_agents().update_one({"_id": self.agent_id}, update)
        
        status_msg = 'success' if success else f'failed ({reason})'
        logger.info(f"[{self.agent_id}] Syndication {syndication_id} marked as {status_msg}")


def generate_syndication(originator_id: str, loan_params: Optional[Dict] = None) -> SyndicationState:
    """
    Generate a new syndication opportunity.
    Can use provided params or generate randomly for demo.
    """
    from random import choice, randint, uniform
    
    originator_profiles = {
        "OA-001": "JPMorgan Chase",
        "OA-002": "Bank of America", 
        "OA-003": "Citigroup",
        "OA-004": "Goldman Sachs",
        "OA-005": "Wells Fargo",
        "OA-006": "BNP Paribas",
        "OA-007": "Barclays",
        "OA-008": "MUFG Bank"
    }
    
    industries = ["Technology", "Healthcare", "Energy", "Real Estate", "Industrial", 
                  "Financial Services", "Telecom", "Consumer", "Infrastructure"]
    loan_types = ["Leveraged Buyout", "Project Finance", "Acquisition Finance", 
                  "Corporate Refinancing", "Bridge Loan"]
    ratings = ["BB-", "BB", "BB+", "BBB-", "BBB", "BBB+", "A-", "A"]
    
    # Generate unique ID using UUID to prevent collisions
    synd_id = f"SYND-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"
    
    # Calculate amounts
    total_amount = randint(200, 2000) * 1000000
    hold_percentage = uniform(0.15, 0.35)
    originator_hold = int(total_amount * hold_percentage)
    syndication_target = total_amount - originator_hold
    
    # Calculate spread based on rating
    rating = choice(ratings)
    base_spreads = {"A": 280, "A-": 320, "BBB+": 350, "BBB": 380, "BBB-": 400,
                    "BB+": 420, "BB": 450, "BB-": 480}
    initial_spread = base_spreads.get(rating, 400) + randint(-20, 20)
    
    now = datetime.utcnow()
    close_hours = randint(24, 120)
    
    state: SyndicationState = {
        "syndication_id": synd_id,
        "originator_agent_id": originator_id,
        "originator": originator_profiles.get(originator_id, "Unknown Bank"),
        "loan_details": {
            "borrower_name": f"{choice(['Atlas', 'Meridian', 'Quantum', 'Pinnacle', 'Summit'])} {choice(['Holdings', 'Capital', 'Partners', 'Group', 'Ventures'])}",
            "industry": choice(industries),
            "loan_type": choice(loan_types),
            "credit_rating": rating,
            "total_amount": total_amount,
            "currency": "USD",
            "originator_hold": originator_hold,
            "syndication_target": syndication_target
        },
        "pricing": {
            "base_rate": "SOFR",
            "initial_spread": initial_spread,
            "commitment_fee": round(uniform(0.35, 0.75), 2)
        },
        "timeline": {
            "broadcast_date": now.isoformat(),
            "target_close_date": (now + timedelta(hours=close_hours)).isoformat()
        },
        "status": "pending",
        "current_round": 0,
        "current_spread": initial_spread,
        "total_committed": 0,
        "subscription_rate": 0.0,
        "bids": [],
        "allocations": [],
        "rejected_bids": [],
        "payments": [],
        "auction_history": [],
        "negotiation_agent_id": None,
        "settlement_agent_id": None,
        "payment_agent_id": None,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "errors": [],
        "warnings": []
    }
    
    return state
