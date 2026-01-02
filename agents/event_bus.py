"""
Event Bus - Pub/Sub infrastructure for domain events

Enables loose coupling between business logic and side effects.
Handlers can subscribe to specific event types or all events.

Usage:
    from event_bus import EventBus
    from events import BidReceived
    
    # Subscribe
    EventBus.subscribe(BidReceived, my_handler)
    
    # Emit
    EventBus.emit(BidReceived(syndication_id="S-001", ...))
"""

from typing import Dict, List, Callable, Type, Any
import logging

from events import DomainEvent

logger = logging.getLogger(__name__)


class EventBus:
    """
    Simple in-process event bus with type-safe subscriptions.
    
    For production scaling, this can be replaced with:
    - Redis pub/sub for distributed systems
    - Kafka for event streaming at scale
    - AWS SNS/SQS for cloud-native deployments
    
    The interface remains the same — only emit() implementation changes.
    """
    
    _handlers: Dict[Type[DomainEvent], List[Callable]] = {}
    _global_handlers: List[Callable] = []
    _enabled: bool = True
    
    @classmethod
    def subscribe(cls, event_type: Type[DomainEvent], handler: Callable[[Any], None]) -> None:
        """
        Subscribe to a specific event type.
        
        Args:
            event_type: The event class to subscribe to
            handler: Callable that takes the event as its only argument
        """
        if event_type not in cls._handlers:
            cls._handlers[event_type] = []
            
        if handler not in cls._handlers[event_type]:
            cls._handlers[event_type].append(handler)
            logger.debug(f"Subscribed {getattr(handler, '__name__', 'handler')} to {event_type.__name__}")
        else:
            logger.debug(f"Handler {getattr(handler, '__name__', 'handler')} already subscribed to {event_type.__name__}")
    
    @classmethod
    def subscribe_all(cls, handler: Callable[[DomainEvent], None]) -> None:
        """
        Subscribe to all events (useful for logging, auditing, dashboard).
        
        Args:
            handler: Callable that takes any DomainEvent as its argument
        """
        if handler not in cls._global_handlers:
            cls._global_handlers.append(handler)
            logger.debug(f"Subscribed {getattr(handler, '__name__', 'handler')} to ALL events")
        else:
            logger.debug(f"Global handler {getattr(handler, '__name__', 'handler')} already subscribed to ALL events")
    
    @classmethod
    def emit(cls, event: DomainEvent) -> None:
        """
        Emit an event to all subscribed handlers.
        
        Handlers are called synchronously. Exceptions in handlers are logged
        but do not interrupt other handlers or the main workflow.
        
        Args:
            event: The domain event to emit
        """
        if not cls._enabled:
            return
            
        event_class = type(event)
        event_name = event_class.__name__
        # Safe attribute access
        synd_id = getattr(event, "syndication_id", "N/A")
        
        logger.debug(f"Emitting {event_name} for {synd_id}")
        
        # Combine type-specific and global handlers to iterate once
        handlers = cls._handlers.get(event_class, []) + cls._global_handlers
        
        for handler in handlers:
            try:
                handler(event)
            except Exception as e:
                handler_name = getattr(handler, '__name__', str(handler))
                logger.error(f"Handler {handler_name} failed for {event_name} ({synd_id}): {e}")
    
    @classmethod
    def clear(cls) -> None:
        """Clear all handlers. Useful for testing."""
        cls._handlers = {}
        cls._global_handlers = []
    
    @classmethod
    def disable(cls) -> None:
        """Disable event emission. Useful for testing or batch operations."""
        cls._enabled = False
    
    @classmethod
    def enable(cls) -> None:
        """Re-enable event emission."""
        cls._enabled = True
    
    @classmethod
    def handler_count(cls) -> int:
        """Return total number of registered handlers."""
        type_handlers = sum(len(h) for h in cls._handlers.values())
        return type_handlers + len(cls._global_handlers)


def setup_event_handlers() -> None:
    """
    Register all event handlers at application startup.
    
    Call this once when the application starts, before any events are emitted.
    This wires up the dashboard, metrics, alerts, and audit handlers.
    """
    from event_handlers import (
        DashboardHandler,
        MetricsHandler,
        AlertHandler,
        AuditHandler
    )
    from events import (
        BiddingCompleted,
        AuctionCompleted,
        AuctionFailed,
        SettlementFailed,
        PaymentProcessed,
        PaymentFailed,
        LowParticipationAlert,
        IncompletePaymentAlert,
        ConcentrationRiskAlert
    )
    
    # Clear any existing handlers (important for testing)
    EventBus.clear()
    
    # Dashboard: receives ALL events for real-time display
    EventBus.subscribe_all(DashboardHandler.handle_event)
    
    # Metrics: specific events that update aggregated metrics
    EventBus.subscribe(BiddingCompleted, MetricsHandler.on_bidding_complete)
    EventBus.subscribe(AuctionCompleted, MetricsHandler.on_auction_complete)
    EventBus.subscribe(PaymentProcessed, MetricsHandler.on_payment_processed)
    
    # Alerts: critical events that require operator attention
    EventBus.subscribe(AuctionFailed, AlertHandler.on_auction_failed)
    EventBus.subscribe(SettlementFailed, AlertHandler.on_settlement_failed)
    EventBus.subscribe(PaymentFailed, AlertHandler.on_payment_failed)
    EventBus.subscribe(LowParticipationAlert, AlertHandler.on_low_participation)
    EventBus.subscribe(IncompletePaymentAlert, AlertHandler.on_incomplete_payment)
    EventBus.subscribe(ConcentrationRiskAlert, AlertHandler.on_concentration_risk)
    
    # Audit: immutable log of all events (subscribe_all)
    EventBus.subscribe_all(AuditHandler.log_event)
    
    logger.info(f"Event handlers registered: {EventBus.handler_count()} handlers")
