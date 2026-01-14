"""
SyndiMatch Agent Orchestration - Enhanced State Definitions
Defines the complete state schema for LangGraph workflow
"""

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
    OUTBID = "outbid"
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
    RETRY = "retry"


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
    
    # Phase 4 Controls
    step_mode: Optional[bool]
    paused: Optional[bool]
    next_node: Optional[str]


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
    # Rankings
    rank_by_amount: Optional[int] = None
    rank_by_spread: Optional[int] = None
    overall_rank: Optional[int] = None
    # Update tracking
    is_update: bool = False
    previous_amount: Optional[int] = None
    previous_spread: Optional[int] = None


class Allocation(BaseModel):
    allocation_id: str
    bid_id: str
    participant_agent_id: str
    institution_name: str
    institution_type: Optional[str] = None
    original_bid_amount: int
    original_spread_bid: int
    final_allocation: int
    allocation_percentage: float
    final_spread: int
    allocation_method: str = "full_allocation"  # "full_allocation", "pro_rata"
    pro_rata_haircut: Optional[float] = None
    commitment_status: str = "pending"
    commitment_letter_signed: bool = False
    commitment_letter_signed_at: Optional[datetime] = None
    settlement_stage: str = "allocation_confirmation"
    fees: Dict[str, Any] = Field(default_factory=dict)
    # Wallet addresses
    wallet_address: Optional[str] = None
    escrow_wallet: Optional[str] = None
    # Rankings
    rank_by_amount: Optional[int] = None
    rank_by_spread: Optional[int] = None
    created_at: Optional[str] = None


class Payment(BaseModel):
    payment_id: str
    payment_agent_id: str
    syndication_id: str
    allocation_id: Optional[str] = None
    payer_agent_id: str
    payer_institution: str
    recipient_type: str
    payment_type: str
    recipient_agent_id: Optional[str] = None
    amount_due: int
    amount_paid: int = 0
    currency: str = "USD"
    due_date: datetime
    payment_status: PaymentStatus = PaymentStatus.PENDING
    transaction_hash: Optional[str] = None
    # Timing tracking
    initiated_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    payment_delay_hours: Optional[float] = None
    is_on_time: bool = True
    late_fee: float = 0.0
    retry_count: int = 0
    # Wallet info
    from_wallet: Optional[str] = None
    to_wallet: Optional[str] = None


class BidDecision(BaseModel):
    """Output from ParticipantAgent evaluation"""
    decision: str = Field(description="'bid' or 'pass'")
    amount: int = Field(default=0, description="Bid amount in currency units")
    spread: int = Field(default=0, description="Spread willing to accept in bps")
    reasoning: str = Field(description="Explanation for decision")
    portfolio_fit_score: float = Field(default=0.0, ge=0, le=1)
    risk_adjusted_return: Optional[float] = None
    constraints_violated: List[str] = Field(default_factory=list)
    # Decision context
    participant_agent_id: Optional[str] = None
    institution_name: Optional[str] = None
    evaluated_at: Optional[datetime] = None
    # For bid updates
    is_update: bool = False
    previous_amount: Optional[int] = None
    previous_spread: Optional[int] = None


class AuctionDecision(BaseModel):
    """Output from NegotiationAgent auction round"""
    action: str = Field(description="'continue', 'close', or 'fail'")
    new_spread: int = Field(default=0, description="New spread for next round")
    winners: List[str] = Field(default_factory=list)
    reasoning: str = Field(description="Explanation for decision")
    round_number: int = Field(default=0)
    subscription_rate: float = Field(default=0.0)


class SettlementDecision(BaseModel):
    """Output from SettlementAgent stage completion"""
    stage_completed: int
    stage_name: Optional[str] = None
    next_stage: int
    tasks_completed: List[str]
    tasks_pending: List[str]
    issues: List[str] = Field(default_factory=list)
    # Participant status
    participants_ready: int = 0
    participants_pending: int = 0
    reasoning: str = ""


class PaymentDecision(BaseModel):
    """Output from PaymentAgent transaction"""
    payment_id: str
    status: str
    transaction_hash: Optional[str] = None
    amount_processed: int
    amount_due: int = 0
    penalties_applied: float = 0.0
    is_on_time: bool = True
    delay_hours: float = 0.0
    retry_count: int = 0
    reasoning: str = ""
