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
        
        now = datetime.utcnow()
        state["metrics"]["start_time"] = now
        state["metrics"]["stage_times"] = {
            "originator": now
        }

    @staticmethod
    def calculate_auction_metrics(state: SyndicationState) -> Dict[str, Any]:
        """Calculate metrics after auction completion"""
        negotiation = state.get("negotiation_state", {})
        pricing = state.get("pricing", {})
        
        initial_spread = pricing.get("initial_spread")
        final_spread = negotiation.get("current_spread")
        
        # Safe default if missing
        if initial_spread is None:
            initial_spread = 0
        if final_spread is None:
            final_spread = initial_spread
            
        bids = state.get("bids", [])
        total_bids = len(bids)
        unique_bidders = len(set(b.get("participant_agent_id") for b in bids if b.get("participant_agent_id")))
        
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
        
        # Dynamic documents signed ratio
        total_docs = len(allocations)
        signed_docs = sum(1 for a in allocations if a.get("status") == "signed" or a.get("signed", False))
        
        # Get actual settlement date if available, otherwise fallback to now
        settlement_date = state.get("settlement_state", {}).get("completed_at")
        if settlement_date:
            if isinstance(settlement_date, str):
                from dateutil.parser import isoparse
                settlement_date = isoparse(settlement_date)
        else:
            settlement_date = datetime.utcnow()
        
        return {
            "total_allocated": total_allocated,
            "participants_settled": len(allocations),
            "settlement_date": settlement_date,
            "documents_signed_ratio": (signed_docs / total_docs) if total_docs > 0 else 0
        }

    @staticmethod
    def calculate_payment_metrics(state: SyndicationState) -> Dict[str, Any]:
        """Calculate payment collection metrics"""
        payments = state.get("payments", [])
        
        total_expected = sum(p.get("amount_due", 0) for p in payments)
        total_collected = sum(p.get("amount_paid", 0) for p in payments if p.get("status") == "completed")
        
        # Strict fee detection
        fee_types = {"commitment_fee", "arrangement_fee", "admin_fee", "underwriting_fee"}
        fees_collected = sum(p.get("amount_paid", 0) for p in payments 
                           if p.get("status") == "completed" and p.get("type") in fee_types)
        
        return {
            "total_expected": total_expected,
            "total_collected": total_collected,
            "collection_rate": (total_collected / total_expected) if total_expected > 0 else 0,
            "total_fees_collected": fees_collected,
            "payment_count": len(payments),
            "failed_payments": sum(1 for p in payments if p.get("status") == "failed")
        }
