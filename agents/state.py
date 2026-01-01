"""
SyndiMatch Agent Orchestration - Enhanced State Definitions
Defines the complete state schema for LangGraph workflow
"""

from typing import TypedDict, List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field
from enum import Enum


class SyndicationStatus(str, Enum):
    OPEN = "open"
    NEGOTIATING = "negotiating"
    CLOSING = "closing"
    SETTLEMENT = "settlement"
    FUNDING = "funding"
    COMPLETED = "completed"
    FAILED = "failed"
    SETTLEMENT_FAILED = "settlement_failed"


class BidStatus(str, Enum):
    ACTIVE = "active"
    WITHDRAWN = "withdrawn"
    REJECTED = "rejected"
    OUTBID = "outbid"
    PROVISIONAL_WINNER = "provisional_winner"
    LOSER = "loser"


class PaymentStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    LATE = "late"
    DISPUTED = "disputed"
    RETRY = "retry"


# === Bid Model ===
class Bid(BaseModel):
    bid_id: str
    syndication_id: str
    participant_agent_id: str
    institution_name: str
    institution_type: str
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


# === Allocation Model ===
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
    fees: Dict[str, Any] = {}
    # Wallet addresses
    wallet_address: Optional[str] = None
    escrow_wallet: Optional[str] = None
    # Rankings
    rank_by_amount: Optional[int] = None
    rank_by_spread: Optional[int] = None
    created_at: Optional[str] = None


# === Payment Model ===
class Payment(BaseModel):
    payment_id: str
    payment_agent_id: str
    syndication_id: str
    allocation_id: Optional[str] = None
    payer_agent_id: str
    payer_institution: str
    recipient_type: str  # originator, escrow, borrower
    recipient_agent_id: Optional[str] = None
    payment_type: str  # commitment_fee, arrangement_fee, principal, upfront_fee
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


# === Main Syndication State ===
class SyndicationState(TypedDict):
    """Main state object passed through LangGraph workflow"""
    
    # Identifiers
    syndication_id: str
    originator_agent_id: str
    originator: str
    
    # Loan Details
    loan_details: Dict[str, Any]
    """
    Contains:
    - borrower_name: str
    - industry: str
    - loan_type: str
    - credit_rating: str
    - total_amount: int
    - currency: str
    - originator_hold: int
    - syndication_target: int
    - geography: str  # "North America", "Europe", "Asia Pacific", etc.
    - esg_score: int  # 0-100
    - maturity_years: int
    - seniority: str  # "Senior Secured First Lien", "Second Lien", etc.
    - amortization: str  # "Bullet", "1% p.a.", "Sculpted"
    - call_protection: str  # "None", "101 (Y1-2)", "Make-whole"
    """
    
    # ESG and Geography at top level for easy access
    esg_rating: Optional[int]
    geography: Optional[str]
    
    # Pricing
    pricing: Dict[str, Any]
    """
    Contains:
    - base_rate: str (SOFR, EURIBOR, SONIA)
    - initial_spread: int (bps)
    - commitment_fee: float (percentage)
    - arrangement_fee: float (percentage)
    - upfront_fee: float (percentage)
    """
    
    # Timeline
    timeline: Dict[str, Any]
    """
    Contains:
    - broadcast_date: str
    - target_close_date: str
    - funding_date: str (set by settlement)
    - first_funding_date: str
    """
    
    # Current State
    status: str
    current_round: int
    current_spread: int
    total_committed: int
    subscription_rate: float
    
    # Negotiation State (nested for detailed tracking)
    negotiation_state: Optional[Dict[str, Any]]
    """
    Contains:
    - current_round: int
    - current_spread: int
    - total_committed: int
    - subscription_rate: float
    - active_bids: int
    - last_round_improvement: float
    """
    
    # Bid Statistics
    bid_statistics: Optional[Dict[str, Any]]
    """
    Contains:
    - total_bids: int
    - unique_bidders: int
    - total_bid_amount: int
    - subscription_rate: float
    - spread_range: {min, max, avg, median}
    """
    
    # Bids & Allocations
    bids: List[Dict[str, Any]]
    allocations: List[Dict[str, Any]]
    rejected_bids: List[Dict[str, Any]]
    
    # Payments
    payments: List[Dict[str, Any]]
    
    # Auction History
    auction_history: List[Dict[str, Any]]
    
    # Agent References
    negotiation_agent_id: Optional[str]
    settlement_agent_id: Optional[str]
    payment_agent_id: Optional[str]
    
    # Pre-qualified participants
    target_participants: Optional[List[str]]
    
    # Metrics (calculated by MetricsCalculator)
    auction_metrics: Optional[Dict[str, Any]]
    """
    Contains:
    - spread_improvement: int (bps)
    - oversubscription_ratio: float
    - auction_duration_hours: float
    - participant_diversity_score: float
    - total_rounds: int
    - final_spread: int
    """
    
    settlement_metrics: Optional[Dict[str, Any]]
    """
    Contains:
    - documents_signed_rate: float
    - avg_signature_time_hours: float
    - allocations_confirmed: int
    """
    
    payment_metrics: Optional[Dict[str, Any]]
    """
    Contains:
    - total_expected: int
    - total_collected: int
    - collection_rate: float
    - on_time_rate: float
    - avg_delay_hours: float
    - total_fees_collected: int
    """
    
    # Market Intelligence
    market_intel: Optional[Dict[str, Any]]
    """
    Contains:
    - comparable_count: int
    - avg_market_spread: int
    - market_demand: str  # "high", "moderate", "low"
    - recent_success_rate: float
    """
    
    # Alerts
    alerts: Optional[List[Dict[str, Any]]]
    """
    List of:
    - alert_id: str
    - type: str  # "payment_overdue", "low_subscription"
    - severity: str  # "critical", "warning", "info"
    - message: str
    - created_at: str
    - resolved: bool
    """
    
    # Timestamps
    created_at: str
    updated_at: str
    current_time: Optional[str]  # Simulated time ISO string
    
    # Time tracking
    time_elapsed_hours: Optional[float]
    time_to_close_hours: Optional[float]
    
    # Error handling
    errors: List[str]
    warnings: List[str]
    
    # Failure tracking
    failure_reason: Optional[str]
    failed_at: Optional[str]
    failed_stage: Optional[str]


# === Agent Decision Models ===
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
    new_spread: int = Field(description="New spread for next round")
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
