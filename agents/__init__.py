"""
SyndiMatch - AI-Powered Loan Syndication Platform

This package provides AI agents for automating loan syndication workflows:

Main Agents:
    - OriginatorAgent: Creates and manages syndication deals
    - ParticipantAgent: Evaluates deals and places bids
    - NegotiationAgent: Runs multi-round Dutch auctions
    - SettlementAgent: Handles allocation and documentation
    - PaymentAgent: Manages x402 payments and fee collection

Orchestration:
    - run_syndication(originator_id): Run complete workflow
    - build_syndication_graph(): Get the LangGraph workflow

State & Models:
    - SyndicationState: Main workflow state
    - Bid, Allocation, Payment: Pydantic models

Utilities:
    - get_database(): MongoDB connection
    - X402Client: Coinbase payment client
    - report_generator: AI report generation

Example:
    >>> from agents import run_syndication
    >>> result = run_syndication("OA-001")
    
    >>> from agents import ParticipantAgent
    >>> agent = ParticipantAgent("PA-001")
    >>> decision = agent.evaluate_opportunity(state)
"""

import logging
from typing import TYPE_CHECKING

# Package metadata
__version__ = "0.1.0"
__author__ = "SyndiMatch Team"

# Set up null handler to avoid "No handler found" warnings
logging.getLogger(__name__).addHandler(logging.NullHandler())

# ============== Core Agents ==============
from .originator_agent import OriginatorAgent
from .participant_agent import ParticipantAgent
from .negotiation_agent import NegotiationAgent
from .settlement_agent import SettlementAgent
from .payment_agent import PaymentAgent

# ============== Orchestration ==============
from .orchestrator import run_syndication, build_syndication_graph

# ============== State & Models ==============
from .state import (
    SyndicationState,
    Bid,
    Allocation,
    Payment,
    BidDecision,
    AuctionDecision,
    SettlementDecision,
    PaymentDecision,
    SyndicationStatus,
    BidStatus,
    PaymentStatus,
)

# ============== Database ==============
from .db import (
    get_database,
    get_collection,
    health_check as db_health_check,
    get_active_syndications,
    get_participant_bids,
    get_pending_payments,
)

# ============== Configuration ==============
from .config import (
    ENVIRONMENT,
    IS_PRODUCTION,
    IS_DEVELOPMENT,
    ENABLE_X402_PAYMENTS,
    ENABLE_AI_REPORTS,
)

# ============== Utilities (lazy loaded for heavy imports) ==============
# These are imported on demand to avoid slow startup

def get_x402_client():
    """Get X402 payment client instance"""
    from .x402_client import X402Client
    return X402Client()

def get_report_generator():
    """Get AI report generator instance"""
    from .report_generator import ReportGenerator
    return ReportGenerator()

def get_metrics_calculator():
    """Get metrics calculator instance"""
    from .metrics_calculator import MetricsCalculator
    return MetricsCalculator

def get_alert_manager():
    """Get alert manager instance"""
    from .alert_manager import AlertManager
    return AlertManager

# ============== All Exports ==============
__all__ = [
    # Package info
    "__version__",
    "__author__",
    
    # Agents
    "OriginatorAgent",
    "ParticipantAgent",
    "NegotiationAgent",
    "SettlementAgent",
    "PaymentAgent",
    
    # Orchestration
    "run_syndication",
    "build_syndication_graph",
    
    # State & Models
    "SyndicationState",
    "Bid",
    "Allocation",
    "Payment",
    "BidDecision",
    "AuctionDecision",
    "SettlementDecision",
    "PaymentDecision",
    "SyndicationStatus",
    "BidStatus",
    "PaymentStatus",
    
    # Database
    "get_database",
    "get_collection",
    "db_health_check",
    "get_active_syndications",
    "get_participant_bids",
    "get_pending_payments",
    
    # Config
    "ENVIRONMENT",
    "IS_PRODUCTION",
    "IS_DEVELOPMENT",
    "ENABLE_X402_PAYMENTS",
    "ENABLE_AI_REPORTS",
    
    # Lazy-loaded utilities
    "get_x402_client",
    "get_report_generator",
    "get_metrics_calculator",
    "get_alert_manager",
]
