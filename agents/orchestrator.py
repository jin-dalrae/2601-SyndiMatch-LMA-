"""
SyndiMatch - Enhanced LangGraph Workflow Orchestrator
Includes real-time metrics, dashboard updates, and robust error handling
"""

from typing import Dict, Any, Literal, List
from datetime import datetime, timedelta
import logging
import asyncio
from concurrent.futures import ThreadPoolExecutor

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from state import SyndicationState
from originator_agent import OriginatorAgent, generate_syndication
from participant_agent import ParticipantAgent, evaluate_all_participants
from negotiation_agent import NegotiationAgent
from settlement_agent import SettlementAgent
from payment_agent import PaymentAgent
from metrics_calculator import MetricsCalculator
from alert_manager import AlertManager
import db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# === Enhanced Node Functions ===

def originator_node(state: SyndicationState) -> SyndicationState:
    """Originator broadcasts the loan opportunity"""
    logger.info(f"=== ORIGINATOR NODE: {state['syndication_id']} ===")
    
    agent = OriginatorAgent(state["originator_agent_id"])
    state = agent.broadcast_loan(state)
    
    # Initialize metrics tracking
    MetricsCalculator.initialize_syndication_metrics(state)
    
    # Publish to dashboard
    publish_status_update(state, "BROADCAST", {
        "event": "syndication_opened",
        "syndication_id": state["syndication_id"],
        "amount": state["loan_details"]["total_amount"],
        "spread": state["pricing"]["initial_spread"],
        "target_close": state["timeline"]["target_close_date"]
    })
    
    return state


def participants_node(state: SyndicationState) -> SyndicationState:
    """All participant agents evaluate and submit bids IN PARALLEL"""
    logger.info(f"=== PARTICIPANTS NODE: {state['syndication_id']} ===")
    
    # Get all active participants
    participants = list(db.participant_agents().find({"status": "active"}))
    participant_ids = [str(p["_id"]) for p in participants]
    
    logger.info(f"Evaluating {len(participant_ids)} participants in parallel...")
    
    # Parallel evaluation with timeout
    bids = []
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = []
        for participant_id in participant_ids:
            agent = ParticipantAgent(participant_id)
            future = executor.submit(agent.evaluate_opportunity, state)
            futures.append((participant_id, future))
        
        # Collect results with timeout
        for participant_id, future in futures:
            try:
                bid = future.result(timeout=30)  # 30s timeout per participant
                if bid:
                    bids.append(bid)
                    
                    # Real-time bid notification
                    publish_status_update(state, "BID_RECEIVED", {
                        "participant": bid.get("institution_name", participant_id),
                        "amount": bid.get("bid_amount", 0),
                        "spread": bid.get("spread_bid", 0),
                        "timestamp": datetime.utcnow().isoformat()
                    })
            except TimeoutError:
                logger.warning(f"Participant {participant_id} evaluation timed out")
            except Exception as e:
                logger.error(f"Participant {participant_id} evaluation failed: {e}")
    
    # Update state with bids
    state["bids"] = bids
    state["bid_statistics"] = MetricsCalculator.calculate_bid_statistics(bids, state)
    
    logger.info(f"Received {len(bids)} bids from {len(participant_ids)} participants")
    
    # Check if minimum participation threshold met
    min_bids = 3
    if len(bids) < min_bids:
        AlertManager.create_alert(
            syndication_id=state["syndication_id"],
            alert_type="low_participation",
            severity="warning",
            message=f"Only {len(bids)} bids received (minimum: {min_bids})"
        )
    
    # Update dashboard metrics
    publish_status_update(state, "BIDDING_COMPLETE", {
        "total_bids": len(bids),
        "total_bid_amount": sum(b.get("bid_amount", 0) for b in bids),
        "subscription_rate": state["bid_statistics"]["subscription_rate"],
        "spread_range": state["bid_statistics"]["spread_range"]
    })
    
    return state


def negotiation_node(state: SyndicationState) -> SyndicationState:
    """Negotiation agent runs MULTI-ROUND Dutch auction"""
    logger.info(f"=== NEGOTIATION NODE: {state['syndication_id']} ===")
    
    agent = NegotiationAgent(state["syndication_id"])
    
    # Run auction with round-by-round updates
    max_rounds = getattr(agent, 'calculate_max_rounds', lambda s: 5)(state)
    
    for round_num in range(1, max_rounds + 1):
        logger.info(f"Starting auction round {round_num}/{max_rounds}")
        
        # Run round (use existing run_auction for now, can be enhanced)
        if round_num == 1:
            state = agent.run_auction(state)
        
        # Real-time auction update
        negotiation_state = state.get("negotiation_state", {})
        publish_status_update(state, "AUCTION_ROUND", {
            "round": round_num,
            "current_spread": negotiation_state.get("current_spread", state.get("pricing", {}).get("initial_spread", 0)),
            "total_committed": negotiation_state.get("total_committed", state.get("total_committed", 0)),
            "subscription_rate": negotiation_state.get("subscription_rate", state.get("subscription_rate", 0))
        })
        
        # Check early termination - subscription >= 100%
        subscription = negotiation_state.get("subscription_rate", state.get("subscription_rate", 0))
        if subscription >= 1.0:
            logger.info(f"Auction closing early at round {round_num} - fully subscribed")
            break
        
        # Check failure conditions
        if round_num >= max_rounds and subscription < 0.80:
            state["status"] = "failed"
            state["failure_reason"] = "insufficient_subscription"
            
            AlertManager.create_alert(
                syndication_id=state["syndication_id"],
                alert_type="auction_failing",
                severity="critical",
                message=f"Subscription only {subscription*100:.1f}% at final round"
            )
            return state
    
    # Calculate final metrics
    state["auction_metrics"] = MetricsCalculator.calculate_auction_metrics(state)
    
    # Dashboard update
    negotiation_state = state.get("negotiation_state", {})
    publish_status_update(state, "AUCTION_COMPLETE", {
        "final_spread": negotiation_state.get("current_spread", state.get("pricing", {}).get("initial_spread", 0)),
        "spread_improvement": state.get("pricing", {}).get("initial_spread", 0) - negotiation_state.get("current_spread", 0),
        "final_subscription": negotiation_state.get("subscription_rate", state.get("subscription_rate", 0)),
        "total_rounds": round_num,
        "winning_bids": len(state.get("allocations", []))
    })
    
    return state


def settlement_node(state: SyndicationState) -> SyndicationState:
    """Settlement agent manages MULTI-STAGE post-auction workflow"""
    logger.info(f"=== SETTLEMENT NODE: {state['syndication_id']} ===")
    
    agent = SettlementAgent(state["syndication_id"])
    
    # Run settlement (uses existing method)
    try:
        state = agent.run_settlement(state)
        
        # Real-time settlement progress
        publish_status_update(state, "SETTLEMENT_PROGRESS", {
            "stage": "complete",
            "allocations_confirmed": len(state.get("allocations", [])),
            "timestamp": datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Settlement failed: {e}")
        state["status"] = "settlement_failed"
        state["failure_reason"] = str(e)
        
        AlertManager.create_alert(
            syndication_id=state["syndication_id"],
            alert_type="settlement_failure",
            severity="critical",
            message=f"Settlement failed: {str(e)}"
        )
        return state
    
    # Settlement complete
    state["settlement_metrics"] = MetricsCalculator.calculate_settlement_metrics(state)
    
    publish_status_update(state, "SETTLEMENT_COMPLETE", {
        "allocations_confirmed": len(state.get("allocations", [])),
        "ready_for_funding": True
    })
    
    return state


def payment_node(state: SyndicationState) -> SyndicationState:
    """Payment agent processes SCHEDULED payments with retries"""
    logger.info(f"=== PAYMENT NODE: {state['syndication_id']} ===")
    
    agent = PaymentAgent(state["syndication_id"])
    
    # Process payments (uses existing method)
    try:
        state = agent.process_payments(state)
        
        payments = state.get("payments", [])
        completed = [p for p in payments if p.get("status") == "completed"]
        failed = [p for p in payments if p.get("status") == "failed"]
        
        # Retry failed payments
        if failed:
            logger.warning(f"{len(failed)} payments failed, attempting retries...")
            for payment in failed:
                for retry in range(3):
                    try:
                        # Attempt retry through agent
                        retry_result = agent.process_single_payment(payment)
                        if retry_result.get("status") == "completed":
                            completed.append(retry_result)
                            failed.remove(payment)
                            break
                    except Exception as e:
                        logger.warning(f"Retry {retry+1} failed for payment: {e}")
                        continue
        
        # Alert for remaining failures
        if failed:
            AlertManager.create_alert(
                syndication_id=state["syndication_id"],
                alert_type="payment_failed",
                severity="critical",
                message=f"{len(failed)} payments failed after retries"
            )
        
        # Real-time payment status
        total_expected = sum(p.get("amount_due", 0) for p in payments)
        total_collected = sum(p.get("amount_paid", 0) for p in completed)
        
        publish_status_update(state, "PAYMENT_PROGRESS", {
            "completed": len(completed),
            "failed": len(failed),
            "total": len(payments),
            "completion_rate": len(completed) / len(payments) if payments else 0,
            "amount_collected": total_collected
        })
        
    except Exception as e:
        logger.error(f"Payment processing failed: {e}")
        state["status"] = "payment_failed"
        return state
    
    # Calculate payment metrics
    state["payment_metrics"] = MetricsCalculator.calculate_payment_metrics(state)
    
    # Check payment completion
    if state["payment_metrics"]["collection_rate"] < 0.95:
        AlertManager.create_alert(
            syndication_id=state["syndication_id"],
            alert_type="incomplete_payment_collection",
            severity="high",
            message=f"Only {state['payment_metrics']['collection_rate']*100:.1f}% collected"
        )
    
    # Final completion
    state = agent.complete_syndication(state)
    
    publish_status_update(state, "SYNDICATION_COMPLETE", {
        "final_status": state["status"],
        "total_syndicated": state.get("total_committed", 0),
        "total_fees_collected": state["payment_metrics"].get("total_fees_collected", 0),
        "completion_time": datetime.utcnow().isoformat()
    })
    
    return state


# === Helper Functions ===

def publish_status_update(state: SyndicationState, event_type: str, data: Dict[str, Any]):
    """
    Publish real-time status update to dashboard via WebSocket/Database.
    """
    message = {
        "syndication_id": state["syndication_id"],
        "event_type": event_type,
        "timestamp": datetime.utcnow().isoformat(),
        "data": data,
        "status": state.get("status", "unknown")
    }
    
    logger.info(f"[DASHBOARD] {event_type}: {data}")
    
    # Store in database for historical view
    try:
        db.get_collection("syndication_events").insert_one(message)
    except Exception as e:
        logger.warning(f"Failed to store event: {e}")


# === Routing Functions ===

def route_after_negotiation(state: SyndicationState) -> Literal["settlement", "failed"]:
    """Route based on auction outcome"""
    if state.get("status") == "failed":
        return "failed"
    
    # Additional validation
    subscription_rate = state.get("negotiation_state", {}).get("subscription_rate", 
                         state.get("subscription_rate", 0))
    if subscription_rate < 0.80:
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
    
    # Notify originator
    originator = OriginatorAgent(state["originator_agent_id"])
    originator.complete_syndication(
        state["syndication_id"], 
        success=False,
        reason=state.get("failure_reason", "unknown")
    )
    
    # Create failure alert
    AlertManager.create_alert(
        syndication_id=state["syndication_id"],
        alert_type="syndication_failed",
        severity="high",
        message=f"Syndication failed: {state.get('failure_reason', 'unknown')}"
    )
    
    # Dashboard notification
    publish_status_update(state, "SYNDICATION_FAILED", {
        "reason": state.get("failure_reason", "unknown"),
        "final_subscription": state.get("negotiation_state", {}).get("subscription_rate", 0),
        "bids_received": len(state.get("bids", []))
    })
    
    # Update database
    try:
        db.syndications().update_one(
            {"_id": state["syndication_id"]},
            {"$set": {"status": "failed", "failure_reason": state.get("failure_reason")}}
        )
    except Exception as e:
        logger.error(f"Failed to update syndication status: {e}")
    
    return state


def settlement_failed_node(state: SyndicationState) -> SyndicationState:
    """Handle settlement failure"""
    logger.warning(f"=== SETTLEMENT FAILED: {state['syndication_id']} ===")
    
    # Dashboard notification
    publish_status_update(state, "SETTLEMENT_FAILED", {
        "reason": state.get("failure_reason", "unknown")
    })
    
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
    start_time = datetime.utcnow()
    
    # Generate initial syndication
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
    
    negotiation_state = final_state.get('negotiation_state', {})
    logger.info(f"    Final Spread: {negotiation_state.get('current_spread', 0)} bps")
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


async def run_syndication_async(originator_id: str = "OA-001") -> Dict[str, Any]:
    """Async wrapper for running syndication"""
    return await asyncio.to_thread(run_syndication, originator_id)


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
