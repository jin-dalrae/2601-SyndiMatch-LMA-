"""
Idempotent Node Wrapper
Ensures each workflow node executes exactly once, even on retry.
Critical for financial transaction integrity.

Usage:
    from idempotent_node import idempotent
    
    @idempotent("originator")
    def originator_node(state: SyndicationState) -> SyndicationState:
        ...

The decorator:
1. Checks if node already executed successfully for this syndication
2. Returns cached result if already executed (skip re-execution)
3. Saves result after successful execution
4. Allows retry on failure (failed executions are not cached)
"""

import functools
import logging
from typing import Callable, Dict, Any, Optional
from datetime import datetime
from collections.abc import Mapping

import db
from state import SyndicationState

logger = logging.getLogger(__name__)


def idempotent(node_name: str):
    """
    Decorator to make a node function idempotent using atomic MongoDB locks.
    """
    def decorator(func: Callable[[SyndicationState], SyndicationState]):
        @functools.wraps(func)
        def wrapper(state: SyndicationState) -> SyndicationState:
            syndication_id = state["syndication_id"]
            idempotency_key = f"{syndication_id}:{node_name}"
            
            # Atomic check-and-set: Lock the node for execution if not already completed
            # This prevents race conditions where two processes try to run the same node
            existing = db.get_collection("node_executions").find_one_and_update(
                {
                    "_id": idempotency_key,
                    "status": {"$ne": "completed"} # Don't re-run if already successful
                },
                {
                    "$setOnInsert": {
                        "syndication_id": syndication_id,
                        "node_name": node_name,
                        "created_at": datetime.utcnow()
                    },
                    "$set": {
                        "status": "in_progress",
                        "started_at": datetime.utcnow()
                    }
                },
                upsert=True,
                return_document=True # Need the document to get started_at for timing or check status
            )
            
            # If we didn't get a document or status is completed, it means another process beat us
            # OR the query matched an existing 'completed' doc (which it shouldn't because of $ne)
            # Actually find_one_and_update with $ne will FAIL to update if status IS completed.
            # But with upsert=True, it might create a new one if not found.
            
            # Re-check status of the returned document
            if existing and existing.get("status") == "completed":
                logger.info(f"[IDEMPOTENT] Skipping {node_name} - already executed for {syndication_id}")
                cached_changes = existing.get("state_changes", {})
                # Use deep merge to ensure nested structures are preserved
                return deep_merge(dict(state), cached_changes)
            
            # If we reach here, we have the 'in_progress' lock
            started_at = datetime.utcnow()
            
            try:
                # Execute the actual node function
                result_state = func(state)
                
                # Extract state changes to cache
                state_changes = _extract_state_changes(state, result_state)
                
                # Mark as completed
                db.get_collection("node_executions").update_one(
                    {"_id": idempotency_key},
                    {
                        "$set": {
                            "status": "completed",
                            "completed_at": datetime.utcnow(),
                            "state_changes": state_changes,
                            "execution_time_ms": _calculate_execution_time(started_at)
                        }
                    }
                )
                
                logger.info(f"[IDEMPOTENT] {node_name} completed for {syndication_id}")
                return result_state
                
            except Exception as e:
                # Mark as failed
                db.get_collection("node_executions").update_one(
                    {"_id": idempotency_key},
                    {
                        "$set": {
                            "status": "failed",
                            "error": str(e),
                            "error_type": type(e).__name__,
                            "failed_at": datetime.utcnow()
                        }
                    }
                )
                logger.error(f"[IDEMPOTENT] {node_name} failed for {syndication_id}: {e}")
                raise
        
        return wrapper
    return decorator


def deep_merge(base: Dict[str, Any], changes: Dict[str, Any]) -> Dict[str, Any]:
    """
    Recursively merge changes into base dictionary.
    """
    for k, v in changes.items():
        if k in base and isinstance(base[k], Mapping) and isinstance(v, Mapping):
            base[k] = deep_merge(dict(base[k]), v)
        else:
            base[k] = v
    return base


def _extract_state_changes(before: SyndicationState, after: SyndicationState) -> Dict[str, Any]:
    """
    Extract only the fields that changed between before and after states.
    This minimizes storage and allows efficient state reconstruction.
    """
    # Key fields that nodes typically modify
    tracked_fields = [
        "status",
        "bids",
        "allocations",
        "rejected_bids",
        "payments",
        "negotiation_state",
        "bid_statistics",
        "auction_metrics",
        "settlement_metrics",
        "payment_metrics",
        "failure_reason",
        "total_committed",
        "subscription_rate",
        "current_spread",
        "current_round"
    ]
    
    changes = {}
    for field in tracked_fields:
        after_value = after.get(field)
        before_value = before.get(field)
        
        # Only store if changed
        if after_value != before_value:
            changes[field] = after_value
    
    return changes


def _calculate_execution_time(started_at: datetime) -> int:
    """Calculate execution time in milliseconds"""
    return int((datetime.utcnow() - started_at).total_seconds() * 1000)


# === Utility Functions ===

def get_last_successful_node(syndication_id: str) -> Optional[str]:
    """
    Get the last successfully completed node for a syndication.
    Useful for resuming a failed workflow.
    
    Args:
        syndication_id: The syndication to check
    
    Returns:
        Node name of last successful execution, or None
    """
    last = db.get_collection("node_executions").find_one(
        {"syndication_id": syndication_id, "status": "completed"},
        sort=[("completed_at", -1)]
    )
    return last["node_name"] if last else None


def get_execution_history(syndication_id: str) -> list:
    """
    Get full execution history for a syndication.
    Useful for debugging and audit.
    
    Args:
        syndication_id: The syndication to check
    
    Returns:
        List of execution records in order
    """
    cursor = db.get_collection("node_executions").find(
        {"syndication_id": syndication_id}
    ).sort("started_at", 1)
    return list(cursor)


def clear_failed_executions(syndication_id: str) -> int:
    """
    Clear failed executions to allow retry.
    Should be called when intentionally restarting a failed syndication.
    
    Args:
        syndication_id: The syndication to clear
    
    Returns:
        Number of records deleted
    """
    result = db.get_collection("node_executions").delete_many({
        "syndication_id": syndication_id,
        "status": "failed"
    })
    logger.info(f"Cleared {result.deleted_count} failed executions for {syndication_id}")
    return result.deleted_count


def clear_all_executions(syndication_id: str) -> int:
    """
    Clear ALL executions for a syndication (full reset).
    Use with caution - this allows complete re-execution.
    
    Args:
        syndication_id: The syndication to clear
    
    Returns:
        Number of records deleted
    """
    result = db.get_collection("node_executions").delete_many({
        "syndication_id": syndication_id
    })
    logger.warning(f"Cleared ALL {result.deleted_count} executions for {syndication_id}")
    return result.deleted_count


def is_node_completed(syndication_id: str, node_name: str) -> bool:
    """
    Check if a specific node has completed for a syndication.
    
    Args:
        syndication_id: The syndication to check
        node_name: The node to check
    
    Returns:
        True if node completed successfully
    """
    idempotency_key = f"{syndication_id}:{node_name}"
    existing = db.get_collection("node_executions").find_one({
        "_id": idempotency_key,
        "status": "completed"
    })
    return existing is not None


# === MongoDB Index Setup ===

def ensure_indexes():
    """
    Create necessary indexes for efficient idempotency checks.
    Call this at application startup.
    """
    collection = db.get_collection("node_executions")
    
    # Index for finding executions by syndication
    collection.create_index("syndication_id")
    
    # Index for finding last completed node
    collection.create_index([
        ("syndication_id", 1),
        ("status", 1),
        ("completed_at", -1)
    ])
    
    # Index for cleanup of old executions
    collection.create_index("completed_at")
    
    logger.info("Idempotency indexes created")
