"""
SyndiMatch Agent Orchestration - State Definitions
Defines the state schema for LangGraph workflow
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


class BidStatus(str, Enum):
    ACTIVE = "active"
    WITHDRAWN = "withdrawn"
    REJECTED = "rejected"
    PROVISIONAL_WINNER = "provisional_winner"
    LOSER = "loser"


class PaymentStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    LATE = "late"
    DISPUTED = "disputed"


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


# === Allocation Model ===
class Allocation(BaseModel):
    allocation_id: str
    participant_agent_id: str
    institution_name: str
    original_bid_amount: int
    final_allocation: int
    allocation_percentage: float
    final_spread: int
    commitment_status: str = "pending"
    fees: Dict[str, Any] = {}


# === Payment Model ===
class Payment(BaseModel):
    payment_id: str
    payment_agent_id: str
    syndication_id: str
    payer_agent_id: str
    payer_institution: str
    recipient_type: str  # originator, escrow, borrower
    payment_type: str  # commitment_fee, arrangement_fee, principal
    amount_due: int
    amount_paid: int = 0
    currency: str = "USD"
    due_date: datetime
    payment_status: PaymentStatus = PaymentStatus.PENDING
    transaction_hash: Optional[str] = None


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
    """
    
    # Pricing
    pricing: Dict[str, Any]
    """
    Contains:
    - base_rate: str (SOFR, EURIBOR, SONIA)
    - initial_spread: int (bps)
    - commitment_fee: float (percentage)
    """
    
    # Timeline
    timeline: Dict[str, Any]
    """
    Contains:
    - broadcast_date: datetime
    - target_close_date: datetime
    - funding_date: datetime (set by settlement)
    """
    
    # Current State
    status: str
    current_round: int
    current_spread: int
    total_committed: int
    subscription_rate: float
    
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
    
    # Timestamps
    created_at: str
    updated_at: str
    current_time: Optional[str]  # Simulated time ISO string
    
    # Error handling
    errors: List[str]
    warnings: List[str]
    
    # === Orchestrator Enhanced State ===
    negotiation_state: Dict[str, Any]
    bid_statistics: Dict[str, Any]
    auction_metrics: Dict[str, Any]
    settlement_metrics: Dict[str, Any]
    payment_metrics: Dict[str, Any]
    metrics: Dict[str, Any]
    failure_reason: Optional[str]


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


class AuctionDecision(BaseModel):
    """Output from NegotiationAgent auction round"""
    action: str = Field(description="'continue', 'close', or 'fail'")
    new_spread: int = Field(description="New spread for next round")
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
