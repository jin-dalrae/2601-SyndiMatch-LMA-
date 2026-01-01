"""
SyndiMatch - Metrics Calculator
Calculates performance metrics for syndication stages
"""

from typing import Dict, Any, List
from state import SyndicationState
from datetime import datetime

class MetricsCalculator:
    @staticmethod
    def initialize_syndication_metrics(state: SyndicationState):
        """Initialize metrics tracking in state"""
        if "metrics" not in state:
            state["metrics"] = {}
        
        state["metrics"]["start_time"] = datetime.utcnow()
        state["metrics"]["stage_times"] = {
            "originator": datetime.utcnow()
        }

    @staticmethod
    def calculate_auction_metrics(state: SyndicationState) -> Dict[str, Any]:
        """Calculate metrics after auction completion"""
        negotiation = state.get("negotiation_state", {})
        initial_spread = state.get("pricing", {}).get("initial_spread", 0)
        final_spread = negotiation.get("current_spread", 0)
        
        bids = state.get("bids", [])
        total_bids = len(bids)
        unique_bidders = len(set(b.get("participant_agent_id") for b in bids))
        
        return {
            "final_spread": final_spread,
            "spread_tightening": initial_spread - final_spread,
            "subscription_rate": negotiation.get("subscription_rate", 0),
            "rounds_count": negotiation.get("auction_round", 0),
            "total_bids": total_bids,
            "unique_bidders": unique_bidders,
            "bid_coverage_ratio": (total_bids / unique_bidders) if unique_bidders > 0 else 0
        }

    @staticmethod
    def calculate_settlement_metrics(state: SyndicationState) -> Dict[str, Any]:
        """Calculate settlement efficiency metrics"""
        allocations = state.get("allocations", [])
        total_allocated = sum(a.get("amount", 0) for a in allocations)
        
        # Calculate time derived metrics if timestamps available
        # simplified for now
        
        return {
            "total_allocated": total_allocated,
            "participants_settled": len(allocations),
            "settlement_date": datetime.utcnow(),
            "documents_signed_ratio": 1.0  # Assuming complete if we reached here
        }

    @staticmethod
    def calculate_payment_metrics(state: SyndicationState) -> Dict[str, Any]:
        """Calculate payment collection metrics"""
        payments = state.get("payments", [])
        
        total_expected = sum(p.get("amount_due", 0) for p in payments)
        total_collected = sum(p.get("amount_paid", 0) for p in payments if p.get("status") == "completed")
        
        fees_collected = sum(p.get("amount_paid", 0) for p in payments 
                           if p.get("status") == "completed" and "fee" in p.get("type", ""))
        
        return {
            "total_expected": total_expected,
            "total_collected": total_collected,
            "collection_rate": (total_collected / total_expected) if total_expected > 0 else 0,
            "total_fees_collected": fees_collected,
            "payment_count": len(payments),
            "failed_payments": len([p for p in payments if p.get("status") == "failed"])
        }
