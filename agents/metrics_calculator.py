"""
SyndiMatch Metrics Calculator
Computes KPIs for syndication workflows
"""

from typing import Dict, Any
from datetime import datetime
import logging

from . import db

logger = logging.getLogger(__name__)


class MetricsCalculator:
    """Calculate and track syndication metrics for dashboard KPIs"""
    
    @staticmethod
    def initialize_syndication_metrics(state: Dict[str, Any]) -> None:
        """Initialize metrics tracking for a new syndication"""
        metrics = {
            "syndication_id": state["syndication_id"],
            "created_at": datetime.utcnow(),
            "originator": state.get("originator"),
            "borrower": state.get("loan_details", {}).get("borrower_name"),
            "total_amount": state.get("loan_details", {}).get("total_amount", 0),
            "syndication_target": state.get("loan_details", {}).get("syndication_target", 0),
            "initial_spread": state.get("pricing", {}).get("initial_spread", 0),
            "status": "initialized",
            
            # Will be populated as workflow progresses
            "bidding": {},
            "auction": {},
            "settlement": {},
            "payment": {}
        }
        
        db.get_collection("syndication_metrics").update_one(
            {"syndication_id": state["syndication_id"]},
            {"$set": metrics},
            upsert=True
        )
        logger.info(f"Initialized metrics for {state['syndication_id']}")
    
    @staticmethod
    def calculate_bid_statistics(bids: list, state: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate bidding statistics"""
        if not bids:
            return {
                "total_bids": 0,
                "total_bid_amount": 0,
                "subscription_rate": 0,
                "spread_range": {"min": 0, "max": 0, "avg": 0, "median": 0}
            }
        
        total_bid_amount = sum(b.get("bid_amount", 0) for b in bids)
        syndication_target = state.get("loan_details", {}).get("syndication_target", 1)
        
        spreads = [b.get("spread_bid", 0) for b in bids if b.get("spread_bid")]
        sorted_spreads = sorted(spreads) if spreads else [0]
        
        return {
            "total_bids": len(bids),
            "unique_bidders": len(set(b.get("participant_agent_id") for b in bids)),
            "total_bid_amount": total_bid_amount,
            "subscription_rate": total_bid_amount / syndication_target if syndication_target > 0 else 0,
            "spread_range": {
                "min": min(spreads) if spreads else 0,
                "max": max(spreads) if spreads else 0,
                "avg": sum(spreads) / len(spreads) if spreads else 0,
                "median": sorted_spreads[len(sorted_spreads) // 2]
            }
        }
    
    @staticmethod
    def calculate_auction_metrics(state: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate auction performance metrics"""
        negotiation = state.get("negotiation_state", {})
        pricing = state.get("pricing", {})
        
        initial_spread = pricing.get("initial_spread", 0)
        final_spread = negotiation.get("current_spread", initial_spread)
        
        metrics = {
            "calculated_at": datetime.utcnow(),
            "total_rounds": negotiation.get("auction_round", 0),
            "initial_spread": initial_spread,
            "final_spread": final_spread,
            "spread_improvement": initial_spread - final_spread,
            "final_subscription_rate": negotiation.get("subscription_rate", 0),
            "total_committed": negotiation.get("total_committed", 0),
            "winning_bids": len(state.get("allocations", [])),
            "auction_success": negotiation.get("subscription_rate", 0) >= 1.0
        }
        
        # Update database
        db.get_collection("syndication_metrics").update_one(
            {"syndication_id": state["syndication_id"]},
            {"$set": {"auction": metrics}}
        )
        
        return metrics
    
    @staticmethod
    def calculate_settlement_metrics(state: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate settlement efficiency metrics"""
        allocations = state.get("allocations", [])
        
        confirmed = len([a for a in allocations if a.get("status") == "confirmed"])
        
        metrics = {
            "calculated_at": datetime.utcnow(),
            "total_allocations": len(allocations),
            "confirmed_allocations": confirmed,
            "confirmation_rate": confirmed / len(allocations) if allocations else 0,
            "documents_generated": len(state.get("documents", [])),
            "signatures_collected": state.get("signatures_collected", 0)
        }
        
        # Update database
        db.get_collection("syndication_metrics").update_one(
            {"syndication_id": state["syndication_id"]},
            {"$set": {"settlement": metrics}}
        )
        
        return metrics
    
    @staticmethod
    def calculate_payment_metrics(state: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate payment collection metrics"""
        payments = state.get("payments", [])
        
        completed = [p for p in payments if p.get("status") == "completed"]
        failed = [p for p in payments if p.get("status") == "failed"]
        
        total_expected = sum(p.get("amount_due", 0) for p in payments)
        total_collected = sum(p.get("amount_paid", 0) for p in completed)
        
        # Group by payment type
        by_type = {}
        for p in payments:
            ptype = p.get("payment_type", "unknown")
            if ptype not in by_type:
                by_type[ptype] = {"expected": 0, "collected": 0, "count": 0}
            by_type[ptype]["expected"] += p.get("amount_due", 0)
            by_type[ptype]["count"] += 1
            if p.get("status") == "completed":
                by_type[ptype]["collected"] += p.get("amount_paid", 0)
        
        metrics = {
            "calculated_at": datetime.utcnow(),
            "total_payments": len(payments),
            "completed_payments": len(completed),
            "failed_payments": len(failed),
            "total_expected": total_expected,
            "total_collected": total_collected,
            "collection_rate": total_collected / total_expected if total_expected > 0 else 0,
            "by_type": by_type,
            "total_fees_collected": sum(
                p.get("amount_paid", 0) for p in completed 
                if p.get("payment_type") in ["commitment_fee", "arrangement_fee"]
            )
        }
        
        # Update database
        db.get_collection("syndication_metrics").update_one(
            {"syndication_id": state["syndication_id"]},
            {"$set": {"payment": metrics}}
        )
        
        return metrics
    
    @staticmethod
    def get_platform_metrics() -> Dict[str, Any]:
        """Get aggregated platform-level metrics"""
        syndications = list(db.syndications().find({}))
        
        total_volume = sum(s.get("loan_details", {}).get("total_amount", 0) for s in syndications)
        completed = [s for s in syndications if s.get("status") == "completed"]
        
        return {
            "total_syndications": len(syndications),
            "completed_syndications": len(completed),
            "total_volume": total_volume,
            "success_rate": len(completed) / len(syndications) if syndications else 0,
            "avg_deal_size": total_volume / len(syndications) if syndications else 0
        }
