"""
SyndiMatch - LangGraph Workflow Orchestrator
Main entry point for agent orchestration
"""

from typing import Dict, Any, Literal
from datetime import datetime
import logging
import asyncio

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from state import SyndicationState
from originator_agent import OriginatorAgent, generate_syndication
from participant_agent import ParticipantAgent, evaluate_all_participants
from negotiation_agent import NegotiationAgent
from settlement_agent import SettlementAgent
from payment_agent import PaymentAgent
import db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# === Node Functions ===

def originator_node(state: SyndicationState) -> SyndicationState:
    """Originator broadcasts the loan opportunity"""
    logger.info(f"=== ORIGINATOR NODE: {state['syndication_id']} ===")
    
    agent = OriginatorAgent(state["originator_agent_id"])
    return agent.broadcast_loan(state)


def participants_node(state: SyndicationState) -> SyndicationState:
    """All participant agents evaluate and submit bids"""
    logger.info(f"=== PARTICIPANTS NODE: {state['syndication_id']} ===")
    
    # Evaluate all participants in parallel
    bids = evaluate_all_participants(state)
    
    # Update state with bids
    state["bids"] = bids
    logger.info(f"Received {len(bids)} bids")
    
    return state


def negotiation_node(state: SyndicationState) -> SyndicationState:
    """Negotiation agent runs the Dutch auction"""
    logger.info(f"=== NEGOTIATION NODE: {state['syndication_id']} ===")
    
    agent = NegotiationAgent(state["syndication_id"])
    return agent.run_auction(state)


def settlement_node(state: SyndicationState) -> SyndicationState:
    """Settlement agent manages post-auction workflow"""
    logger.info(f"=== SETTLEMENT NODE: {state['syndication_id']} ===")
    
    agent = SettlementAgent(state["syndication_id"])
    return agent.run_settlement(state)


def payment_node(state: SyndicationState) -> SyndicationState:
    """Payment agent processes all payments"""
    logger.info(f"=== PAYMENT NODE: {state['syndication_id']} ===")
    
    agent = PaymentAgent(state["syndication_id"])
    state = agent.process_payments(state)
    return agent.complete_syndication(state)


# === Routing Functions ===

def route_after_negotiation(state: SyndicationState) -> Literal["settlement", "failed"]:
    """Route based on auction outcome"""
    if state["status"] == "failed":
        return "failed"
    return "settlement"


def route_after_settlement(state: SyndicationState) -> Literal["payment", "settlement_failed"]:
    """Route based on settlement outcome"""
    if state["status"] == "settlement_failed":
        return "settlement_failed"
    return "payment"


def failed_node(state: SyndicationState) -> SyndicationState:
    """Handle auction failure"""
    logger.warning(f"=== AUCTION FAILED: {state['syndication_id']} ===")
    
    # Notify originator
    originator = OriginatorAgent(state["originator_agent_id"])
    originator.complete_syndication(state["syndication_id"], success=False)
    
    return state


def settlement_failed_node(state: SyndicationState) -> SyndicationState:
    """Handle settlement failure"""
    logger.warning(f"=== SETTLEMENT FAILED: {state['syndication_id']} ===")
    return state


# === Build the Graph ===

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
    
    # Conditional routing after negotiation
    workflow.add_conditional_edges(
        "negotiation",
        route_after_negotiation,
        {
            "settlement": "settlement",
            "failed": "failed"
        }
    )
    
    # Conditional routing after settlement
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


# === Main Execution ===

def run_syndication(originator_id: str = "OA-001", 
                    loan_params: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Run a complete syndication workflow.
    
    Args:
        originator_id: The originator agent ID
        loan_params: Optional specific loan parameters
    
    Returns:
        Final state after workflow completion
    """
    # Generate initial syndication
    initial_state = generate_syndication(originator_id, loan_params)
    
    logger.info(f"\n{'='*60}")
    logger.info(f"STARTING SYNDICATION: {initial_state['syndication_id']}")
    logger.info(f"Borrower: {initial_state['loan_details']['borrower_name']}")
    logger.info(f"Amount: ${initial_state['loan_details']['total_amount']:,}")
    logger.info(f"Rating: {initial_state['loan_details']['credit_rating']}")
    logger.info(f"Spread: {initial_state['pricing']['initial_spread']} bps")
    logger.info(f"{'='*60}\n")
    
    # Build and compile graph
    workflow = build_syndication_graph()
    memory = MemorySaver()
    app = workflow.compile(checkpointer=memory)
    
    # Run the workflow
    config = {"configurable": {"thread_id": initial_state["syndication_id"]}}
    final_state = None
    
    for event in app.stream(initial_state, config):
        for node_name, node_state in event.items():
            logger.info(f"[{node_name}] Status: {node_state.get('status', 'unknown')}")
            final_state = node_state
    
    logger.info(f"\n{'='*60}")
    logger.info(f"SYNDICATION COMPLETE: {initial_state['syndication_id']}")
    logger.info(f"Final Status: {final_state.get('status', 'unknown')}")
    logger.info(f"Total Committed: ${final_state.get('total_committed', 0):,}")
    logger.info(f"Subscription Rate: {final_state.get('subscription_rate', 0)*100:.1f}%")
    logger.info(f"{'='*60}\n")
    
    return final_state


async def run_syndication_async(originator_id: str = "OA-001") -> Dict[str, Any]:
    """Async wrapper for running syndication"""
    return await asyncio.to_thread(run_syndication, originator_id)


# === CLI Entry Point ===

if __name__ == "__main__":
    import sys
    
    # Ensure database is connected
    db.get_database()
    
    # Run a demo syndication
    originator = sys.argv[1] if len(sys.argv) > 1 else "OA-001"
    
    print("\n🚀 Starting SyndiMatch Agent Orchestration Demo\n")
    result = run_syndication(originator)
    
    print("\n📊 Final Result:")
    print(f"  Syndication ID: {result.get('syndication_id')}")
    print(f"  Status: {result.get('status')}")
    print(f"  Allocations: {len(result.get('allocations', []))}")
    print(f"  Payments: {len(result.get('payments', []))}")
