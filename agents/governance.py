"""Deterministic controls for allocation approval and settlement.

This module deliberately has no LLM or database dependency so the control
boundary can be tested in isolation. Agents may propose an allocation; only
an approval for the exact immutable proposal may authorize settlement.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any, Dict, Iterable


class GovernanceError(ValueError):
    """Raised when a consequential workflow transition is not authorized."""


def _allocation_payload(allocation: Dict[str, Any]) -> Dict[str, Any]:
    rows: Iterable[Dict[str, Any]] = allocation.get("allocations", [])
    return {
        "allocation_id": allocation.get("_id"),
        "syndication_id": allocation.get("syndication_id"),
        "allocation_version": allocation.get("allocation_version"),
        "allocations": [
            {
                "allocation_id": row.get("_id") or row.get("allocation_id"),
                "bid_id": row.get("bid_id"),
                "participant_agent_id": row.get("participant_agent_id"),
                "final_allocation": row.get("final_allocation"),
                "final_spread": row.get("final_spread"),
            }
            for row in rows
        ],
    }


def allocation_fingerprint(allocation: Dict[str, Any]) -> str:
    """Return a stable SHA-256 fingerprint for the decision-bearing fields."""
    encoded = json.dumps(
        _allocation_payload(allocation), sort_keys=True, separators=(",", ":")
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def version_allocation(
    allocation: Dict[str, Any], previous: Dict[str, Any] | None = None
) -> Dict[str, Any]:
    """Create a new proposal version and invalidate any previous approval."""
    proposal = dict(allocation)
    previous_version = int((previous or {}).get("allocation_version", 0))
    proposal["allocation_version"] = previous_version + 1
    proposal["allocation_status"] = "pending_approval"
    proposal.pop("approval", None)
    proposal["allocation_fingerprint"] = allocation_fingerprint(proposal)
    return proposal


def approval_authorizes_settlement(
    allocation: Dict[str, Any] | None,
) -> bool:
    """True only when approval matches the current allocation exactly."""
    if not allocation or allocation.get("allocation_status") != "approved":
        return False
    approval = allocation.get("approval") or {}
    if approval.get("decision") not in {"approved", "override"}:
        return False
    if approval.get("allocation_id") != allocation.get("_id"):
        return False
    if approval.get("allocation_version") != allocation.get("allocation_version"):
        return False
    expected = allocation_fingerprint(allocation)
    return (
        allocation.get("allocation_fingerprint") == expected
        and approval.get("allocation_fingerprint") == expected
    )


def require_settlement_approval(allocation: Dict[str, Any] | None) -> None:
    if not approval_authorizes_settlement(allocation):
        raise GovernanceError(
            "Settlement blocked: current allocation lacks an exact, valid approval"
        )


def validate_bid_amount(risk_appetite: Dict[str, Any], amount: Any) -> list[str]:
    """Validate a model-proposed commitment against deterministic limits."""
    if isinstance(amount, bool) or not isinstance(amount, int):
        return ["bid_amount_must_be_integer_usd"]
    if amount <= 0:
        return ["bid_amount_must_be_positive"]

    violations: list[str] = []
    minimum = int(risk_appetite.get("min_ticket", 0))
    maximum = int(risk_appetite.get("max_single_ticket", 0))
    available = int(risk_appetite.get("available_capacity", 0))
    if amount < minimum:
        violations.append("below_minimum_ticket")
    if maximum and amount > maximum:
        violations.append("above_maximum_single_ticket")
    if amount > available:
        violations.append("insufficient_available_capacity")
    return violations
