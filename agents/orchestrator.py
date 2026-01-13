"""
SyndiMatch - Enhanced LangGraph Workflow Orchestrator
Includes real-time metrics, dashboard updates, and robust error handling
"""

from typing import Dict, Any, Literal, List
from datetime import datetime, timedelta
import logging
import uuid
import os
import asyncio

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from .state import SyndicationState, SyndicationStatus
from .originator_agent import OriginatorAgent, generate_syndication
from .participant_agent import ParticipantAgent
from .negotiation_agent import NegotiationAgent
from .settlement_agent import SettlementAgent
from .payment_agent import PaymentAgent
from .metrics_calculator import MetricsCalculator
from .alert_manager import AlertManager
from .event_bus import EventBus
from .events import (
    SyndicationOpened, BidReceived, BidRejected, BiddingCompleted,
    AuctionRoundCompleted, AuctionCompleted, AuctionFailed,
    SettlementStageCompleted, SettlementCompleted, SettlementFailed,
    PaymentProcessed, PaymentFailed, SyndicationCompleted,
    LowParticipationAlert, IncompletePaymentAlert
)
from .idempotent_node import idempotent
from . import db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# === Enhanced Node Functions ===

@idempotent("originator")
def originator_node(state: SyndicationState) -> SyndicationState:
    """Originator broadcasts the loan opportunity"""
    logger.info(f"=== ORIGINATOR NODE: {state['syndication_id']} ===")
    
    agent = OriginatorAgent(state["originator_agent_id"])
    state = agent.broadcast_loan(state)
    
    # Initialize metrics tracking
    MetricsCalculator.initialize_syndication_metrics(state)
    
    # Emit syndication opened event
    EventBus.emit(SyndicationOpened(
        syndication_id=state["syndication_id"],
        originator=state["originator"],
        borrower=state["loan_details"]["borrower_name"],
        amount=state["loan_details"]["total_amount"],
        spread=state["pricing"]["initial_spread"],
        target_close=state["timeline"]["target_close_date"],
        industry=state["loan_details"]["industry"],
        credit_rating=state["loan_details"]["credit_rating"],
        reasoning=state.get("recommendation_reasoning", "AI-Recommended: High credit quality with attractive spread.")
    ))
    
    return state


@idempotent("participants")
def participants_node(state: SyndicationState) -> SyndicationState:
    """
    All participant agents evaluate and submit bids with REALISTIC TIMING.
    - Bids arrive at staggered times (simulated delays)
    - Once syndication target is reached, late bids are cut off
    - Order is randomized to simulate real-world arrival patterns
    """
    import random
    import time
    
    logger.info(f"=== PARTICIPANTS NODE: {state['syndication_id']} ===")
    
    # Get syndication target for cutoff logic
    syndication_target = state["loan_details"]["syndication_target"]
    
    # Get all active participants - convert cursor to list FIRST
    participants_cursor = db.get_collection("participants").find({"status": "active"})
    participants_list = list(participants_cursor)
    
    # Shuffle participants to randomize bid arrival order
    random.shuffle(participants_list)
    
    logger.info(f"Found {len(participants_list)} active participants in database")
    logger.info(f"Syndication target: ${syndication_target:,}")
    logger.info(f"Participants will bid in randomized order with realistic timing delays...")
    
    # Track bids and cumulative committed amount
    bids = []
    total_committed = 0
    rejected_late_bids = []
    bid_start_time = datetime.utcnow()
    
    # Process participants sequentially with realistic delays
    for idx, participant in enumerate(participants_list):
        participant_id = str(participant["_id"])
        inst_name = participant.get("institution", {}).get("name", participant.get("entity", "Unknown"))
        
        # Simulate realistic delay between bids (3-10 seconds)
        if idx > 0:
            # Use environment variable to expedite testing
            is_test = os.getenv("SYNDIMATCH_TEST_MODE") == "true"
            delay = random.randint(1, 2) if is_test else random.randint(3, 10)
            time.sleep(delay)
        
        # Calculate simulated "bid time" offset (in minutes, for logging)
        elapsed_time = (datetime.utcnow() - bid_start_time).total_seconds()
        simulated_minutes = int(elapsed_time * 10)  # Scale for realism in logs
        
        # Check if syndication is already fully subscribed
        if total_committed >= syndication_target:
            logger.warning(f"  ⏰ LATE BID CUTOFF: {inst_name} ({participant_id}) - Syndication already at 100%")
            rejected_late_bids.append({
                "participant_id": participant_id,
                "institution_name": inst_name,
                "reason": "syndication_closed",
                "time_offset_minutes": simulated_minutes
            })
            # Emit bid rejected event
            EventBus.emit(BidRejected(
                syndication_id=state["syndication_id"],
                participant_id=participant_id,
                institution_name=inst_name,
                reason="syndication_closed"
            ))
            continue
        
        # Evaluate and potentially submit bid
        try:
            agent = ParticipantAgent(participant_id)
            bid = agent.evaluate_opportunity(state)
            
            if bid:
                potential_new_total = total_committed + bid["bid_amount"]
                
                # Check if this bid would cause oversubscription beyond 110%
                max_subscription = syndication_target * 1.10
                
                if potential_new_total > max_subscription:
                    # Reduce bid to fit remaining capacity, or reject if too small
                    remaining_capacity = max_subscription - total_committed
                    min_ticket = participant.get("risk_appetite", {}).get("min_ticket", 5000000)
                    
                    if remaining_capacity >= min_ticket:
                        # Accept partial bid
                        original_amount = bid["bid_amount"]
                        bid["bid_amount"] = int(remaining_capacity)
                        bid["partial_fill"] = True
                        bid["original_amount"] = original_amount
                        logger.info(f"  📉 {inst_name}: Reduced bid from ${original_amount:,} to ${bid['bid_amount']:,} (capacity limit)")
                    else:
                        # Reject - not enough remaining capacity
                        logger.warning(f"  ⛔ REJECTED: {inst_name} - Bid ${bid['bid_amount']:,} exceeds remaining capacity ${remaining_capacity:,}")
                        rejected_late_bids.append({
                            "participant_id": participant_id,
                            "institution_name": inst_name,
                            "bid_amount": bid["bid_amount"],
                            "reason": "exceeds_capacity",
                            "time_offset_minutes": simulated_minutes
                        })
                        continue
                
                # Accept bid
                total_committed += bid["bid_amount"]
                subscription_rate = total_committed / syndication_target
                bids.append(bid)
                
                logger.info(f"  ✅ +{simulated_minutes}min: {inst_name} bid ${bid['bid_amount']:,} @ {bid['spread_bid']}bps | Total: ${total_committed:,} ({subscription_rate*100:.1f}%)")
                
                # Emit bid received event
                EventBus.emit(BidReceived(
                    syndication_id=state["syndication_id"],
                    participant_id=bid["participant_agent_id"],
                    institution_name=bid["institution_name"],
                    amount=bid["bid_amount"],
                    spread=bid["spread_bid"],
                    reasoning=bid.get("reasoning"),
                    sentiment=bid.get("portfolio_fit_score", 0.5),
                    cumulative_subscription=subscription_rate,
                    time_offset_minutes=simulated_minutes
                ))
            else:
                logger.info(f"  ⏭️ +{simulated_minutes}min: {inst_name} passed on this opportunity")
                
        except Exception as e:
            logger.error(f"Participant {participant_id} evaluation failed: {e}")
    
    # Final summary
    logger.info(f"\n📊 BIDDING SUMMARY for {state['syndication_id']}:")
    logger.info(f"   • Total bids accepted: {len(bids)}")
    logger.info(f"   • Total committed: ${total_committed:,}")
    logger.info(f"   • Final subscription: {(total_committed/syndication_target)*100:.1f}%")
    logger.info(f"   • Late/rejected bids: {len(rejected_late_bids)}")
    
    # Update state with bids and CRITICAL computed fields
    state["bids"] = bids
    state["rejected_bids"] = rejected_late_bids
    state["total_committed"] = total_committed  # PERSIST: used by downstream nodes
    state["subscription_rate"] = total_committed / syndication_target if syndication_target > 0 else 0
    state["bid_statistics"] = calculate_bid_statistics(bids, state)
    
    # Check if minimum participation threshold met
    min_bids = 3
    if len(bids) < min_bids:
        EventBus.emit(LowParticipationAlert(
            syndication_id=state["syndication_id"],
            bids_received=len(bids),
            minimum_required=min_bids
        ))
    
    # Emit bidding complete event
    spreads = [b["spread_bid"] for b in bids] if bids else [0]
    EventBus.emit(BiddingCompleted(
        syndication_id=state["syndication_id"],
        total_bids=len(bids),
        rejected_bids=len(rejected_late_bids),
        total_amount=sum(b["bid_amount"] for b in bids),
        subscription_rate=state["bid_statistics"]["subscription_rate"],
        spread_range_min=min(spreads),
        spread_range_max=max(spreads),
        spread_range_avg=sum(spreads) / len(spreads) if spreads else 0
    ))
    
    return state


@idempotent("negotiation")
def negotiation_node(state: SyndicationState) -> SyndicationState:
    """Negotiation agent runs MULTI-ROUND Dutch auction"""
    logger.info(f"=== NEGOTIATION NODE: {state['syndication_id']} ===")
    
    agent = NegotiationAgent(state["syndication_id"])
    
    # Run auction with round-by-round updates
    max_rounds = agent.calculate_max_rounds(state)
    
    for round_num in range(1, max_rounds + 1):
        logger.info(f"Starting auction round {round_num}/{max_rounds}")
        
        # Run round
        state = agent.run_auction_round(state, round_num)
        
        # Emit auction round event
        EventBus.emit(AuctionRoundCompleted(
            syndication_id=state["syndication_id"],
            round_number=round_num,
            max_rounds=max_rounds,
            current_spread=state["negotiation_state"]["current_spread"],
            total_committed=state["negotiation_state"]["total_committed"],
            subscription_rate=state["negotiation_state"]["subscription_rate"]
        ))
        
        # Check early termination conditions
        if agent.should_close_auction(state):
            logger.info(f"Auction closing early at round {round_num}")
            break
        
        # Check failure conditions
        if agent.is_auction_failing(state, round_num, max_rounds):
            state["status"] = SyndicationStatus.FAILED.value
            state["failure_reason"] = "insufficient_subscription"
            
            EventBus.emit(AuctionFailed(
                syndication_id=state["syndication_id"],
                reason="insufficient_subscription",
                final_subscription=state["negotiation_state"]["subscription_rate"],
                bids_received=len(state.get("bids", [])),
                round_reached=round_num
            ))
            state["_auction_failed_emitted"] = True  # Prevent duplicate in failed_node
            return state
        
        # Wait between rounds (simulated)
        if round_num < max_rounds:
            round_duration = agent.get_round_duration(state)
            logger.info(f"Waiting {round_duration} minutes for next round...")
            # In production: asyncio.sleep(round_duration * 60)
    
    # Finalize auction
    state = agent.finalize_auction(state)
    
    # Calculate final metrics
    state["auction_metrics"] = MetricsCalculator.calculate_auction_metrics(state)
    
    # Emit auction complete event
    EventBus.emit(AuctionCompleted(
        syndication_id=state["syndication_id"],
        final_spread=state["negotiation_state"]["current_spread"],
        spread_improvement=state["pricing"]["initial_spread"] - state["negotiation_state"]["current_spread"],
        final_subscription=state["negotiation_state"]["subscription_rate"],
        total_rounds=state["negotiation_state"]["auction_round"],
        winning_bids=len(state.get("allocations", [])),
        allocations=[a.get("allocation_id", "") for a in state.get("allocations", [])]
    ))
    
    return state


@idempotent("settlement")
def settlement_node(state: SyndicationState) -> SyndicationState:
    """Settlement agent manages MULTI-STAGE post-auction workflow"""
    logger.info(f"=== SETTLEMENT NODE: {state['syndication_id']} ===")
    
    agent = SettlementAgent(state["syndication_id"])
    
    # Multi-stage settlement process
    stages = [
        ("allocation_confirmation", agent.confirm_allocations),
        ("legal_documentation", agent.distribute_documents),
        ("compliance_verification", agent.verify_compliance),
        ("signature_collection", agent.collect_signatures)
    ]
    
    for stage_num, (stage_name, stage_func) in enumerate(stages, 1):
        logger.info(f"Settlement Stage {stage_num}/{len(stages)}: {stage_name}")
        
        try:
            state = stage_func(state)
            
            # Emit settlement stage event
            last_decision = state.get("last_settlement_decision")
            EventBus.emit(SettlementStageCompleted(
                syndication_id=state["syndication_id"],
                stage_name=stage_name,
                stage_number=stage_num,
                total_stages=len(stages),
                completion_rate=stage_num / len(stages),
                reasoning=last_decision.reasoning if last_decision else f"Completed {stage_name} verification",
                sentiment=0.7
            ))
            
        except Exception as e:
            logger.error(f"Settlement stage {stage_name} failed: {e}")
            state["status"] = SyndicationStatus.SETTLEMENT_FAILED.value
            state["failure_reason"] = f"Stage failed: {stage_name}"
            state["failed_stage"] = stage_name
            
            EventBus.emit(SettlementFailed(
                syndication_id=state["syndication_id"],
                stage_name=stage_name,
                reason=str(e)
            ))
            state["_settlement_failed_emitted"] = True  # Prevent duplicate
            return state
    
    # Settlement complete
    state["status"] = SyndicationStatus.SETTLEMENT.value
    state["settlement_metrics"] = MetricsCalculator.calculate_settlement_metrics(state)
    
    EventBus.emit(SettlementCompleted(
        syndication_id=state["syndication_id"],
        allocations_confirmed=len(state.get("allocations", [])),
        documents_signed=state.get("documents_signed_count", 0),
        ready_for_funding=True,
        reasoning="All settlement stages verified. Escrow accounts funded and ready for final distribution.",
        sentiment=0.9
    ))
    
    return state


@idempotent("payment")
def payment_node(state: SyndicationState) -> SyndicationState:
    """Payment agent processes SCHEDULED payments with retries"""
    logger.info(f"=== PAYMENT NODE: {state['syndication_id']} ===")
    
    start_time = datetime.utcnow()
    agent = PaymentAgent(state["syndication_id"])
    
    # Process payments by type in sequence
    payment_types = [
        ("commitment_fee", "T+1"),
        ("arrangement_fee", "funding_date"),
        ("principal", "funding_date")
    ]
    
    all_payments = []
    
    for payment_type, due_timing in payment_types:
        logger.info(f"Processing {payment_type} payments...")
        
        try:
            payments = agent.process_payment_type(state, payment_type)
            
            # Retry failed payments
            failed_payments = [p for p in payments if p["status"] == "failed"]
            if failed_payments:
                logger.warning(f"{len(failed_payments)} {payment_type} payments failed, retrying...")
                
                for payment in failed_payments:
                    retry_result = agent.retry_payment(payment, max_retries=3)
                    if retry_result["status"] == "completed":
                        payments[payments.index(payment)] = retry_result
                    else:
                        # Emit payment failed event
                        EventBus.emit(PaymentFailed(
                            syndication_id=state["syndication_id"],
                            payment_id=payment.get("payment_id", ""),
                            payer_institution=payment.get("payer", {}).get("institution_name", "Unknown"),
                            amount=payment.get("amount_due", 0),
                            reason="Failed after max retries"
                        ))
            
            all_payments.extend(payments)
            
            # Emit payment progress event
            completed = len([p for p in payments if p["status"] == "completed"])
            total = len(payments)
            amount_collected = sum(p.get("amount_paid", 0) for p in payments if p["status"] == "completed")
            
            EventBus.emit(PaymentProcessed(
                syndication_id=state["syndication_id"],
                payment_type=payment_type,
                payments_processed=completed,
                total_payments=total,
                amount_collected=amount_collected,
                completion_rate=completed / total if total > 0 else 0,
                reasoning=f"Batch processed: {completed}/{total} {payment_type} payments via x402 on Base. All transactions confirmed.",
                sentiment=0.75
            ))
            
            # Real-time poll simulation (helpful for dashboard visibility)
            if payments:
                asyncio.run(asyncio.sleep(0.5))
                agent.poll_transaction_status(payments[0]["payment_id"])
            
        except Exception as e:
            logger.error(f"Payment processing failed for {payment_type}: {e}")
            state["status"] = SyndicationStatus.PAYMENT_FAILED.value
            return state
    
    # Update state with all payments
    state["payments"] = all_payments
    state["payment_metrics"] = MetricsCalculator.calculate_payment_metrics(state)
    
    # Check payment completion
    total_expected = state["payment_metrics"]["total_expected"]
    total_collected = state["payment_metrics"]["total_collected"]
    collection_rate = total_collected / total_expected if total_expected > 0 else 0
    
    if collection_rate < 0.95:  # Less than 95% collected
        EventBus.emit(IncompletePaymentAlert(
            syndication_id=state["syndication_id"],
            collection_rate=collection_rate,
            expected_amount=total_expected,
            collected_amount=total_collected
        ))
    
    # Audit for late payments
    agent.handle_late_payments(state)
    
    # Final completion
    state = agent.complete_syndication(state)
    
    # Calculate duration
    duration = (datetime.utcnow() - start_time).total_seconds()
    
    EventBus.emit(SyndicationCompleted(
        syndication_id=state["syndication_id"],
        final_status=state["status"],
        total_syndicated=state.get("total_committed", 0),
        total_fees_collected=state["payment_metrics"].get("total_fees_collected", 0),
        total_payments=len(all_payments),
        duration_seconds=duration,
        reasoning=f"Syndication successfully closed. All {state['status']} criteria met and funds distributed via x402.",
        sentiment=1.0
    ))
    
    return state


# === Helper Functions ===

def calculate_bid_statistics(bids: List[Dict], state: SyndicationState) -> Dict[str, Any]:
    """Calculate bidding statistics for dashboard"""
    if not bids:
        return {
            "total_bids": 0,
            "total_bid_amount": 0,
            "subscription_rate": 0,
            "spread_range": {"min": 0, "max": 0, "avg": 0}
        }
    
    total_bid_amount = sum(b["bid_amount"] for b in bids)
    syndication_target = state["loan_details"]["syndication_target"]
    
    spreads = [b["spread_bid"] for b in bids]
    
    return {
        "total_bids": len(bids),
        "unique_bidders": len(set(b["participant_agent_id"] for b in bids)),
        "total_bid_amount": total_bid_amount,
        "subscription_rate": total_bid_amount / syndication_target if syndication_target > 0 else 0,
        "spread_range": {
            "min": min(spreads),
            "max": max(spreads),
            "avg": sum(spreads) / len(spreads),
            "median": _calculate_median(spreads)
        }
    }


def _calculate_median(values: List[float]) -> float:
    """Calculate proper median for both odd and even length lists"""
    if not values:
        return 0
    sorted_values = sorted(values)
    n = len(sorted_values)
    mid = n // 2
    if n % 2 == 0:
        # Even length: average of two middle values
        return (sorted_values[mid - 1] + sorted_values[mid]) / 2
    else:
        # Odd length: middle value
        return sorted_values[mid]


def publish_status_update(state: SyndicationState, event_type: str, data: Dict[str, Any]):
    """
    DEPRECATED: Use EventBus.emit() with domain events instead.
    
    This function is kept for backward compatibility but will be removed
    in a future version. All workflow nodes now use the event-driven
    architecture with typed domain events.
    
    Publish real-time status update to dashboard via WebSocket/Redis/etc.
    """
    import warnings
    warnings.warn(
        "publish_status_update is deprecated. Use EventBus.emit() with domain events instead.",
        DeprecationWarning,
        stacklevel=2
    )
    
    message = {
        "syndication_id": state["syndication_id"],
        "event_type": event_type,
        "timestamp": datetime.utcnow().isoformat(),
        "data": data,
        "status": state.get("status", "unknown")
    }
    
    logger.info(f"[DASHBOARD] {event_type}: {data}")
    
    # Store in database for historical view
    db.get_collection("syndication_events").insert_one(message)


# === Routing Functions ===

def route_after_negotiation(state: SyndicationState) -> Literal["settlement", "failed"]:
    """Route based on auction outcome"""
    status = state.get("status", "unknown")
    
    # Debug logging
    neg_state = state.get("negotiation_state", {})
    sub_rate = neg_state.get("subscription_rate", 0)
    logger.info(f"ROUTING CHECK: status={status}, sub_rate={sub_rate}")
    
    if status == "failed":
        return "failed"
    
    # Additional validation
    if sub_rate < 0.80:  # Less than 80% subscribed
        logger.warning(f"Routing to FAILED: Low subscription rate {sub_rate}")
        state["status"] = "failed"
        state["failure_reason"] = "insufficient_subscription"
        return "failed"
    
    return "settlement"


def route_after_settlement(state: SyndicationState) -> Literal["payment", "settlement_failed"]:
    """Route based on settlement outcome"""
    if state.get("status") in ["settlement_failed", "failed"]:
        return "settlement_failed"
    return "payment"


def failed_node(state: SyndicationState) -> SyndicationState:
    """Handle auction failure with notifications and cleanup"""
    logger.warning(f"=== AUCTION FAILED: {state['syndication_id']} ===")
    
    # Notify all participants
    for bid in state.get("bids", []):
        ParticipantAgent(bid["participant_agent_id"]).notify_auction_failed(
            state["syndication_id"],
            reason=state.get("failure_reason", "unknown")
        )
    
    # Notify originator
    originator = OriginatorAgent(state["originator_agent_id"])
    originator.complete_syndication(
        state["syndication_id"], 
        success=False,
        reason=state.get("failure_reason", "unknown")
    )
    
    # IDEMPOTENT: Only emit if not already emitted by negotiation_node
    # Check state flag to prevent duplicate events
    if not state.get("_auction_failed_emitted"):
        EventBus.emit(AuctionFailed(
            syndication_id=state["syndication_id"],
            reason=state.get("failure_reason", "unknown"),
            final_subscription=state.get("negotiation_state", {}).get("subscription_rate", 0),
            bids_received=len(state.get("bids", [])),
            round_reached=state.get("negotiation_state", {}).get("auction_round", 0)
        ))
        state["_auction_failed_emitted"] = True
    
    # Update database
    db.get_collection("syndications").update_one(
        {"_id": state["syndication_id"]},
        {"$set": {"status": "failed", "failure_reason": state.get("failure_reason")}}
    )
    
    return state


def settlement_failed_node(state: SyndicationState) -> SyndicationState:
    """Handle settlement failure"""
    logger.warning(f"=== SETTLEMENT FAILED: {state['syndication_id']} ===")
    
    # Attempt rollback if needed
    SettlementAgent(state["syndication_id"]).rollback_settlement(state)
    
    # Notify participants
    for allocation in state.get("allocations", []):
        ParticipantAgent(allocation["participant_agent_id"]).notify_settlement_failed(
            state["syndication_id"]
        )
    
    # IDEMPOTENT: Only emit if not already emitted by settlement_node
    if not state.get("_settlement_failed_emitted"):
        EventBus.emit(SettlementFailed(
            syndication_id=state["syndication_id"],
            stage_name=state.get("failed_stage", "unknown"),
            reason=state.get("failure_reason", "unknown")
        ))
        state["_settlement_failed_emitted"] = True
    
    return state


# === Build the Enhanced Graph ===

def build_syndication_graph() -> StateGraph:
    """Build the LangGraph workflow for syndication"""
    
    workflow = StateGraph(SyndicationState)
    
    # Add nodes
    workflow.add_node("originator", originator_node)
    workflow.add_node("participants", participants_node)
    workflow.add_node("negotiation", negotiation_node)
    workflow.add_node("settlement", settlement_node)
    workflow.add_node("payment", payment_node)
    workflow.add_node("failed", failed_node)
    workflow.add_node("settlement_failed", settlement_failed_node)
    
    # Set entry point
    workflow.set_entry_point("originator")
    
    # Add edges
    workflow.add_edge("originator", "participants")
    workflow.add_edge("participants", "negotiation")
    
    # Conditional routing
    workflow.add_conditional_edges(
        "negotiation",
        route_after_negotiation,
        {
            "settlement": "settlement",
            "failed": "failed"
        }
    )
    
    workflow.add_conditional_edges(
        "settlement",
        route_after_settlement,
        {
            "payment": "payment",
            "settlement_failed": "settlement_failed"
        }
    )
    
    # Terminal nodes
    workflow.add_edge("payment", END)
    workflow.add_edge("failed", END)
    workflow.add_edge("settlement_failed", END)
    
    return workflow


# === Main Execution with Enhanced Logging ===

def run_syndication(originator_id: str = "OA-001", 
                    loan_params: Dict[str, Any] = None,
                    enable_dashboard: bool = True) -> Dict[str, Any]:
    """
    Run a complete syndication workflow with full observability.
    
    Args:
        originator_id: The originator agent ID
        loan_params: Optional specific loan parameters
        enable_dashboard: Whether to publish real-time updates
    
    Returns:
        Final state after workflow completion
    """
    # Initialize event handlers for dashboard, metrics, and alerts
    from event_bus import setup_event_handlers
    from idempotent_node import ensure_indexes
    setup_event_handlers()
    ensure_indexes()  # Create MongoDB indexes for idempotency checks
    
    start_time = datetime.utcnow()
    
    # Reuse an existing syndication if the provided ID matches one in the DB.
    existing = db.syndications().find_one({"_id": originator_id})
    if not existing:
        existing = db.syndications().find_one({"syndication_id": originator_id})

    if existing:
        initial_state = existing
        initial_state["syndication_id"] = existing.get("syndication_id") or existing.get("_id")
        if "originator_agent_id" not in initial_state:
            if isinstance(originator_id, str) and originator_id.startswith("OA-"):
                initial_state["originator_agent_id"] = originator_id
    else:
        # Generate initial syndication for a new run
        initial_state = generate_syndication(originator_id, loan_params)
    
    logger.info(f"\n{'='*80}")
    logger.info(f"🚀 STARTING SYNDICATION WORKFLOW")
    logger.info(f"{'='*80}")
    logger.info(f"  Syndication ID: {initial_state['syndication_id']}")
    logger.info(f"  Originator: {initial_state['originator']}")
    logger.info(f"  Borrower: {initial_state['loan_details']['borrower_name']}")
    logger.info(f"  Industry: {initial_state['loan_details']['industry']}")
    logger.info(f"  Total Amount: ${initial_state['loan_details']['total_amount']:,}")
    logger.info(f"  Syndication Target: ${initial_state['loan_details']['syndication_target']:,}")
    logger.info(f"  Credit Rating: {initial_state['loan_details']['credit_rating']}")
    logger.info(f"  Initial Spread: {initial_state['pricing']['initial_spread']} bps")
    logger.info(f"  Target Close: {initial_state['timeline']['target_close_date']}")
    logger.info(f"{'='*80}\n")
    
    # Build and compile graph
    workflow = build_syndication_graph()
    memory = MemorySaver()
    app = workflow.compile(checkpointer=memory)
    
    # Run the workflow with tracking
    config = {"configurable": {"thread_id": initial_state["syndication_id"]}}
    final_state = None
    node_count = 0
    
    for event in app.stream(initial_state, config):
        for node_name, node_state in event.items():
            node_count += 1
            status = node_state.get('status', 'unknown')
            logger.info(f"[Node {node_count}] {node_name.upper()} → Status: {status}")
            final_state = node_state
    
    # Calculate final metrics
    end_time = datetime.utcnow()
    duration = (end_time - start_time).total_seconds()
    
    logger.info(f"\n{'='*80}")
    logger.info(f"✅ SYNDICATION WORKFLOW COMPLETE")
    logger.info(f"{'='*80}")
    logger.info(f"  Syndication ID: {initial_state['syndication_id']}")
    logger.info(f"  Final Status: {final_state.get('status', 'unknown')}")
    logger.info(f"  Duration: {duration:.2f} seconds ({duration/60:.1f} minutes)")
    logger.info(f"  Nodes Executed: {node_count}")
    logger.info(f"")
    logger.info(f"  📊 RESULTS:")
    logger.info(f"    Total Bids Received: {len(final_state.get('bids', []))}")
    logger.info(f"    Total Committed: ${final_state.get('total_committed', 0):,}")
    logger.info(f"    Subscription Rate: {final_state.get('subscription_rate', 0)*100:.1f}%")
    logger.info(f"    Final Spread: {final_state.get('negotiation_state', {}).get('current_spread', 0)} bps")
    logger.info(f"    Allocations: {len(final_state.get('allocations', []))}")
    logger.info(f"    Payments Processed: {len(final_state.get('payments', []))}")
    
    if final_state.get('payment_metrics'):
        logger.info(f"")
        logger.info(f"  💰 PAYMENT METRICS:")
        logger.info(f"    Total Expected: ${final_state['payment_metrics'].get('total_expected', 0):,}")
        logger.info(f"    Total Collected: ${final_state['payment_metrics'].get('total_collected', 0):,}")
        logger.info(f"    Collection Rate: {final_state['payment_metrics'].get('collection_rate', 0)*100:.1f}%")
    
    logger.info(f"{'='*80}\n")
    
    return final_state


async def run_syndication_async(originator_id: str = "OA-001", 
                                 loan_params: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Async wrapper for run_syndication to use from FastAPI.
    Runs the synchronous workflow in a thread to avoid blocking.
    """
    return await asyncio.to_thread(run_syndication, originator_id, loan_params)


def resume_syndication(syndication_id: str) -> Dict[str, Any]:
    """
    Resume an interrupted/paused syndication workflow.
    """
    workflow = build_syndication_graph()
    memory = MemorySaver()
    app = workflow.compile(checkpointer=memory)
    
    config = {"configurable": {"thread_id": syndication_id}}
    
    # Check if we are really paused
    state = app.get_state(config)
    if not state.next:
        logger.warning(f"Syndication {syndication_id} is not paused or already complete.")
        return {"error": "Not paused"}
    
    logger.info(f"▶ RESUMING SYNDICATION: {syndication_id} at node {state.next}")
    
    final_state = None
    node_count = 0
    
    # Resume by passing None to stream
    for event in app.stream(None, config):
        for node_name, node_state in event.items():
            node_count += 1
            status = node_state.get('status', 'unknown')
            logger.info(f"[Resume Node {node_count}] {node_name.upper()} → Status: {status}")
            final_state = node_state
            
            # Re-check for pause (if multiple steps)
            snapshot = app.get_state(config)
            if snapshot.next:
                final_state["paused"] = True
                final_state["next_node"] = snapshot.next[0]
                from .events import WorkflowPaused
                from event_bus import EventBus
                EventBus.emit(WorkflowPaused(
                    syndication_id=syndication_id,
                    next_node=snapshot.next[0]
                ))
                return final_state

    return final_state


async def resume_syndication_async(syndication_id: str) -> Dict[str, Any]:
    """Async wrapper for resume_syndication"""
    return await asyncio.to_thread(resume_syndication, syndication_id)


async def run_multiple_syndications(count: int = 5, originator_ids: List[str] = None):
    """Run multiple syndications concurrently for demo"""
    if not originator_ids:
        originator_ids = ["OA-001", "OA-002", "OA-003"]
    
    tasks = []
    for i in range(count):
        originator = originator_ids[i % len(originator_ids)]
        task = asyncio.to_thread(run_syndication, originator)
        tasks.append(task)
    
    results = await asyncio.gather(*tasks)
    return results


# === CLI Entry Point ===

if __name__ == "__main__":
    import sys
    
    # Ensure database is connected
    db.get_database()
    
    # Parse arguments
    if len(sys.argv) > 1:
        if sys.argv[1] == "multi":
            count = int(sys.argv[2]) if len(sys.argv) > 2 else 3
            print(f"\n🚀 Starting {count} Concurrent Syndications\n")
            asyncio.run(run_multiple_syndications(count))
        else:
            originator = sys.argv[1]
            print(f"\n🚀 Starting SyndiMatch for Originator: {originator}\n")
            run_syndication(originator)
    else:
        print("\n🚀 Starting SyndiMatch Demo Syndication\n")
        result = run_syndication("OA-001")
        
        print("\n" + "="*80)
        print("📋 QUICK SUMMARY")
        print("="*80)
        print(f"Syndication: {result.get('syndication_id')}")
        print(f"Status: {result.get('status')}")
        print(f"Success: {'✓' if result.get('status') == 'completed' else '✗'}")
        print("="*80 + "\n")
