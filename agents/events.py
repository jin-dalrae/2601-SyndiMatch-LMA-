"""
SyndiMatch Domain Events
Decouples business logic from side effects (dashboard, metrics, alerts)

These events represent significant occurrences in the syndication workflow.
Handlers subscribe to these events to perform side effects without coupling
the core business logic to specific implementations.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Any
from enum import Enum


class Severity(str, Enum):
    """Event/Alert severity levels"""
    INFO = "info"
    WARNING = "warning"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class DomainEvent:
    """Base class for all domain events"""
    syndication_id: str
    timestamp: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> dict:
        """Convert event to dictionary for storage/serialization"""
        return {
            "event_type": self.__class__.__name__,
            "syndication_id": self.syndication_id,
            "timestamp": self.timestamp.isoformat(),
            "data": {
                k: v for k, v in self.__dict__.items()
                if k not in ('syndication_id', 'timestamp')
            }
        }


# === Syndication Lifecycle Events ===

@dataclass
class SyndicationOpened(DomainEvent):
    """Emitted when originator broadcasts a new syndication opportunity"""
    originator: str
    borrower: str
    amount: int  # Principal amount in currency units
    spread: int  # Initial spread in basis points (bps)
    target_close: datetime  # Expected bidding end date
    industry: str
    credit_rating: str


@dataclass
class BidReceived(DomainEvent):
    """Emitted when a participant submits a bid"""
    participant_id: str
    institution_name: str
    amount: int
    spread: int
    cumulative_subscription: float
    time_offset_minutes: int = 0


@dataclass
class BidRejected(DomainEvent):
    """Emitted when a bid is rejected (late, exceeds capacity, etc.)"""
    participant_id: str
    institution_name: str
    reason: str  # 'syndication_closed', 'exceeds_capacity', etc.
    amount: Optional[int] = None


@dataclass
class BiddingCompleted(DomainEvent):
    """Emitted when all bids have been collected"""
    total_bids: int
    rejected_bids: int
    total_amount: int
    subscription_rate: float
    spread_range_min: int
    spread_range_max: int
    spread_range_avg: float


# === Auction Events ===

@dataclass
class AuctionRoundCompleted(DomainEvent):
    """Emitted after each auction round"""
    round_number: int
    max_rounds: int
    current_spread: int
    total_committed: int
    subscription_rate: float


@dataclass
class AuctionCompleted(DomainEvent):
    """Emitted when auction closes successfully"""
    final_spread: int
    spread_improvement: int
    final_subscription: float
    total_rounds: int
    winning_bids: int
    allocations: List[str]  # List of allocation IDs (e.g., ALLOC-SYND-ID-PART-ID)


@dataclass
class AuctionFailed(DomainEvent):
    """Emitted when auction fails (insufficient subscription, etc.)"""
    reason: str
    final_subscription: float
    bids_received: int
    round_reached: int


# === Settlement Events ===

@dataclass
class SettlementStageCompleted(DomainEvent):
    """Emitted when a settlement stage completes"""
    stage_name: str
    stage_number: int
    total_stages: int
    completion_rate: float


@dataclass
class SettlementCompleted(DomainEvent):
    """Emitted when all settlement stages complete"""
    allocations_confirmed: int
    documents_signed: int
    ready_for_funding: bool


@dataclass
class SettlementFailed(DomainEvent):
    """Emitted when settlement fails at any stage"""
    stage_name: str
    reason: str


# === Payment Events ===

@dataclass
class PaymentProcessed(DomainEvent):
    """Emitted when a payment type batch is processed"""
    payment_type: str  # 'commitment_fee', 'arrangement_fee', 'principal'
    payments_processed: int  # Number of successful payments in this batch
    total_payments: int      # Total number of payments expected in this batch
    amount_collected: int    # Cumulative amount collected in this batch
    completion_rate: float   # Percentage of total expected count (0.0 to 1.0)


@dataclass
class PaymentFailed(DomainEvent):
    """Emitted when a payment fails after retries"""
    payment_id: str
    payer_institution: str
    amount: int
    reason: str


@dataclass
class SyndicationCompleted(DomainEvent):
    """Emitted when entire syndication workflow completes successfully"""
    final_status: str
    total_syndicated: int
    total_fees_collected: int
    total_payments: int
    duration_seconds: float


# === Alert-Triggering Events ===

@dataclass
class LowParticipationAlert(DomainEvent):
    """Emitted when bid count is below minimum threshold"""
    bids_received: int
    minimum_required: int
    severity: Severity = Severity.WARNING


@dataclass 
class IncompletePaymentAlert(DomainEvent):
    """Emitted when payment collection rate is below threshold"""
    collection_rate: float
    expected_amount: int
    collected_amount: int
    severity: Severity = Severity.HIGH


@dataclass
class ConcentrationRiskAlert(DomainEvent):
    """Emitted when single participant exceeds concentration limit"""
    participant_id: str
    institution_name: str
    concentration_percentage: float
    threshold_percentage: float
    severity: Severity = Severity.WARNING
