"""
Event Handlers - Side effects triggered by domain events

Each handler class is responsible for one concern (Single Responsibility):
- DashboardHandler: Real-time UI updates
- MetricsHandler: Aggregated metrics storage
- AlertHandler: Operator notifications
- AuditHandler: Immutable event log

These handlers are registered with the EventBus at application startup.
They should NOT contain business logic — only side effects.
"""

import logging
from datetime import datetime
from typing import Any, Dict

from . import db
from .events import (
    DomainEvent,
    BiddingCompleted,
    AuctionCompleted,
    AuctionFailed,
    SettlementFailed,
    PaymentProcessed,
    PaymentFailed,
    LowParticipationAlert,
    IncompletePaymentAlert,
    ConcentrationRiskAlert,
    Severity  # Import the new Enum
)

logger = logging.getLogger(__name__)


class DashboardHandler:
    """
    Publishes events to real-time dashboard.
    
    Stores events in MongoDB for dashboard polling.
    In production, this could also push to WebSocket connections.
    """
    
    @staticmethod
    def handle_event(event: DomainEvent) -> None:
        """Store event for dashboard consumption"""
        message = event.to_dict()
        message["status"] = "active"  # For dashboard display
        
        try:
            db.get_collection("syndication_events").insert_one(message)
            logger.debug(f"[DASHBOARD] {type(event).__name__}: {event.syndication_id}")
        except Exception as e:
            logger.error(f"Failed to store dashboard event: {e}")


class MetricsHandler:
    """
    Calculates and stores aggregated metrics.
    
    Metrics are stored with timestamps for time-window queries.
    This enables historical analysis and audit-friendly reporting.
    """
    
    @staticmethod
    def on_bidding_complete(event: BiddingCompleted) -> None:
        """Update bidding metrics after all bids collected"""
        try:
            db.get_collection("syndication_metrics").update_one(
                {"syndication_id": event.syndication_id},
                {
                    "$set": {
                        "bidding.total_bids": event.total_bids,
                        "bidding.rejected_bids": event.rejected_bids,
                        "bidding.total_amount": event.total_amount,
                        "bidding.subscription_rate": event.subscription_rate,
                        "bidding.spread_range": {
                            "min": event.spread_range_min,
                            "max": event.spread_range_max,
                            "avg": event.spread_range_avg
                        },
                        "bidding.completed_at": event.timestamp,
                        "updated_at": datetime.utcnow()
                    }
                },
                upsert=True
            )
            logger.debug(f"[METRICS] Bidding complete: {event.syndication_id}")
        except Exception as e:
            logger.error(f"Failed to update bidding metrics: {e}")
    
    @staticmethod
    def on_auction_complete(event: AuctionCompleted) -> None:
        """Update auction metrics after auction closes"""
        try:
            db.get_collection("syndication_metrics").update_one(
                {"syndication_id": event.syndication_id},
                {
                    "$set": {
                        "auction.final_spread": event.final_spread,
                        "auction.spread_improvement": event.spread_improvement,
                        "auction.final_subscription": event.final_subscription,
                        "auction.total_rounds": event.total_rounds,
                        "auction.winning_bids": event.winning_bids,
                        "auction.completed_at": event.timestamp,
                        "updated_at": datetime.utcnow()
                    }
                },
                upsert=True
            )
            logger.debug(f"[METRICS] Auction complete: {event.syndication_id}")
        except Exception as e:
            logger.error(f"Failed to update auction metrics: {e}")
    
    @staticmethod
    def on_payment_processed(event: PaymentProcessed) -> None:
        """Update payment metrics after each payment batch"""
        try:
            db.get_collection("syndication_metrics").update_one(
                {"syndication_id": event.syndication_id},
                {
                    "$inc": {
                        f"payments.{event.payment_type}.processed_count": event.payments_processed,
                        f"payments.{event.payment_type}.amount_collected": event.amount_collected
                    },
                    "$set": {
                        f"payments.{event.payment_type}.total_count": event.total_payments,
                        f"payments.{event.payment_type}.completion_rate": event.completion_rate,
                        f"payments.{event.payment_type}.last_updated_at": event.timestamp,
                        "updated_at": datetime.utcnow()
                    }
                },
                upsert=True
            )
            logger.debug(f"[METRICS] Payment processed: {event.payment_type} for {event.syndication_id}")
        except Exception as e:
            logger.error(f"Failed to update payment metrics: {e}")


class AlertHandler:
    """
    Creates alerts for critical events that require operator attention.
    
    Alerts are stored with full context for debugging and audit.
    """
    
    @staticmethod
    def _create_alert(
        syndication_id: str,
        alert_type: str,
        severity: Severity,
        message: str,
        context: Dict[str, Any] = None
    ) -> None:
        """Helper to create standardized alert documents"""
        try:
            db.get_collection("alerts").insert_one({
                "syndication_id": syndication_id,
                "alert_type": alert_type,
                "severity": severity.value, # Use string value
                "message": message,
                "context": context or {},
                "created_at": datetime.utcnow(),
                "acknowledged": False,
                "acknowledged_by": None,
                "acknowledged_at": None
            })
            logger.warning(f"[ALERT] {severity.value.upper()}: {message}")
        except Exception as e:
            logger.error(f"Failed to create alert: {e}")
    
    @staticmethod
    def on_auction_failed(event: AuctionFailed) -> None:
        AlertHandler._create_alert(
            syndication_id=event.syndication_id,
            alert_type="auction_failed",
            severity=Severity.CRITICAL,
            message=f"Auction failed: {event.reason}",
            context={
                "final_subscription": event.final_subscription,
                "bids_received": event.bids_received,
                "round_reached": event.round_reached
            }
        )
    
    @staticmethod
    def on_settlement_failed(event: SettlementFailed) -> None:
        AlertHandler._create_alert(
            syndication_id=event.syndication_id,
            alert_type="settlement_failed",
            severity=Severity.CRITICAL,
            message=f"Settlement failed at {event.stage_name}: {event.reason}",
            context={"stage_name": event.stage_name}
        )
    
    @staticmethod
    def on_payment_failed(event: PaymentFailed) -> None:
        AlertHandler._create_alert(
            syndication_id=event.syndication_id,
            alert_type="payment_failed",
            severity=Severity.CRITICAL,
            message=f"Payment failed: {event.payer_institution} - ${event.amount:,}",
            context={
                "payment_id": event.payment_id,
                "payer": event.payer_institution,
                "amount": event.amount,
                "reason": event.reason
            }
        )
    
    @staticmethod
    def on_low_participation(event: LowParticipationAlert) -> None:
        AlertHandler._create_alert(
            syndication_id=event.syndication_id,
            alert_type="low_participation",
            severity=event.severity,
            message=f"Low participation: {event.bids_received} bids (minimum: {event.minimum_required})",
            context={
                "bids_received": event.bids_received,
                "minimum_required": event.minimum_required
            }
        )
    
    @staticmethod
    def on_incomplete_payment(event: IncompletePaymentAlert) -> None:
        AlertHandler._create_alert(
            syndication_id=event.syndication_id,
            alert_type="incomplete_payment",
            severity=event.severity,
            message=f"Payment collection at {event.collection_rate*100:.1f}% (${event.collected_amount:,}/${event.expected_amount:,})",
            context={
                "collection_rate": event.collection_rate,
                "expected": event.expected_amount,
                "collected": event.collected_amount
            }
        )
    
    @staticmethod
    def on_concentration_risk(event: ConcentrationRiskAlert) -> None:
        AlertHandler._create_alert(
            syndication_id=event.syndication_id,
            alert_type="concentration_risk",
            severity=event.severity,
            message=f"Concentration limit exceeded: {event.institution_name} at {event.concentration_percentage:.1f}% (limit: {event.threshold_percentage:.1f}%)",
            context={
                "participant_id": event.participant_id,
                "institution": event.institution_name,
                "concentration": event.concentration_percentage,
                "threshold": event.threshold_percentage
            }
        )


class AuditHandler:
    """
    Maintains immutable audit trail of all events.
    
    Every event is logged with full payload for compliance and debugging.
    This collection should have write-once semantics in production.
    """
    
    @staticmethod
    def log_event(event: DomainEvent) -> None:
        """Log event to immutable audit trail"""
        try:
            db.get_collection("audit_log").insert_one({
                "event_type": type(event).__name__,
                "syndication_id": event.syndication_id,
                "timestamp": event.timestamp,
                "payload": event.__dict__
            })
        except Exception as e:
            # Audit logging should never fail silently
            logger.critical(f"AUDIT LOG FAILURE: {e} - Event: {event}")
