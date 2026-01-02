from typing import TypedDict, List, Optional, Dict, Any, Union
from datetime import datetime
from pydantic import BaseModel, Field
from enum import Enum


class SyndicationStatus(str, Enum):
    """Workflow status for a syndication"""
    OPEN = "open"
    BIDDING = "bidding"
    NEGOTIATING = "negotiating"
    CLOSING = "closing"
    SETTLEMENT = "settlement"
    SETTLEMENT_FAILED = "settlement_failed"
    FUNDING = "funding"
    PAYMENT_FAILED = "payment_failed"
    COMPLETED = "completed"
    FAILED = "failed"


class BidStatus(str, Enum):
    """Status for individual bids"""
    ACTIVE = "active"
    WITHDRAWN = "withdrawn"
    REJECTED = "rejected"
    PROVISIONAL_WINNER = "provisional_winner"
    LOSER = "loser"


class PaymentStatus(str, Enum):
    """Status for payment transactions"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    LATE = "late"
    DISPUTED = "disputed"


# === Typed Sub-States for Orchestrator ===

class LoanDetails(TypedDict):
    borrower_name: str
    industry: str
    loan_type: str
    credit_rating: str
    total_amount: int
    currency: str
    originator_hold: int
    syndication_target: int


class Pricing(TypedDict):
    base_rate: str  # SOFR, EURIBOR, etc.
    initial_spread: int
    commitment_fee: float
    arrangement_fee: float


class Timeline(TypedDict):
    broadcast_date: str  # ISO string
    target_close_date: str
    funding_date: Optional[str]
    completed_at: Optional[str]


class NegotiationState(TypedDict):
    current_spread: int
    subscription_rate: float
    total_committed: int
    auction_round: int
    winning_bids: List[str]
    status: str


class BidStatistics(TypedDict):
    total_bids: int
    unique_bidders: int
    total_bid_amount: int
    subscription_rate: float
    spread_range: Dict[str, float]  # min, max, avg, median
    bid_coverage_ratio: float


class PaymentMetrics(TypedDict):
    total_expected: int
    total_collected: int
    collection_rate: float
    total_fees_collected: int
    payments_completed: int
    payments_failed: int


class SettlementMetrics(TypedDict):
    stages_completed: int
    total_stages: int
    documents_signed: int
    compliance_verified: bool


class AuctionMetrics(TypedDict):
    total_rounds: int
    spread_improvement: int
    final_subscription: float
    winning_bidder_count: int


# === Main Syndication State ===

class SyndicationState(TypedDict):
    """Main state object passed through LangGraph workflow"""
    
    # Identifiers
    syndication_id: str
    originator_agent_id: str
    originator: str
    
    # Nested Models
    loan_details: LoanDetails
    pricing: Pricing
    timeline: Timeline
    
    # Current State
    status: Union[SyndicationStatus, str]
    current_round: int
    current_spread: int
    total_committed: int
    subscription_rate: float
    
    # Collections
    bids: List[Dict[str, Any]]
    allocations: List[Dict[str, Any]]
    rejected_bids: List[Dict[str, Any]]
    payments: List[Dict[str, Any]]
    auction_history: List[Dict[str, Any]]
    
    # Agent References
    negotiation_agent_id: Optional[str]
    settlement_agent_id: Optional[str]
    payment_agent_id: Optional[str]
    
    # Metadata & Timestamps
    created_at: str
    updated_at: str
    current_time: Optional[str]  # Simulated time ISO string
    
    # Error handling
    errors: List[str]
    warnings: List[str]
    failure_reason: Optional[str]
    
    # Orchestrator Enhanced State
    negotiation_state: NegotiationState
    bid_statistics: BidStatistics
    auction_metrics: AuctionMetrics
    settlement_metrics: SettlementMetrics
    payment_metrics: PaymentMetrics
    metrics: Dict[str, Any]


# === Agent Decision Models (Stays as Pydantic for LLM integration) ===

class Bid(BaseModel):
    bid_id: str
    syndication_id: str
    participant_agent_id: str
    institution_name: str
    institution_type: str = "Bank"
    bid_amount: int
    spread_bid: int  # basis points
    all_in_yield: float
    min_allocation: int
    max_allocation: int
    partial_fill_acceptable: bool = True
    pro_rata_acceptance: bool = True
    submitted_at: datetime
    valid_until: datetime
    auction_round: int = 1
    is_competitive: bool = True
    bid_status: BidStatus = BidStatus.ACTIVE
    portfolio_fit_score: float = 0.0
    risk_adjusted_return: Optional[float] = None
    reasoning: Optional[str] = None


class Allocation(BaseModel):
    allocation_id: str
    participant_agent_id: str
    institution_name: str
    original_bid_amount: int
    final_allocation: int
    allocation_percentage: float
    final_spread: int
    commitment_status: str = "pending"
    fees: Dict[str, Any] = Field(default_factory=dict)


class Payment(BaseModel):
    payment_id: str
    payment_agent_id: str
    syndication_id: str
    payer_agent_id: str
    payer_institution: str
    recipient_type: str
    payment_type: str
    amount_due: int
    amount_paid: int = 0
    currency: str = "USD"
    due_date: datetime
    payment_status: PaymentStatus = PaymentStatus.PENDING
    transaction_hash: Optional[str] = None


class BidDecision(BaseModel):
    """Output from ParticipantAgent evaluation"""
    decision: str = Field(description="'bid' or 'pass'")
    amount: int = Field(default=0, description="Bid amount in currency units")
    spread: int = Field(default=0, description="Spread willing to accept in bps")
    reasoning: str = Field(description="Explanation for decision")
    portfolio_fit_score: float = Field(default=0.0, ge=0, le=1)
    risk_adjusted_return: Optional[float] = None
    constraints_violated: List[str] = Field(default_factory=list)


class AuctionDecision(BaseModel):
    """Output from NegotiationAgent auction round"""
    action: str = Field(description="'continue', 'close', or 'fail'")
    new_spread: int = Field(default=0, description="New spread for next round")
    winners: List[str] = Field(default_factory=list)
    reasoning: str = Field(description="Explanation for decision")


class SettlementDecision(BaseModel):
    """Output from SettlementAgent stage completion"""
    stage_completed: int
    next_stage: int
    tasks_completed: List[str]
    tasks_pending: List[str]
    issues: List[str] = Field(default_factory=list)


class PaymentDecision(BaseModel):
    """Output from PaymentAgent transaction"""
    payment_id: str
    status: str
    transaction_hash: Optional[str] = None
    amount_processed: int
    penalties_applied: float = 0.0
    reasoning: str = ""
