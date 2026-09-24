import unittest
import importlib.util
from pathlib import Path

module_path = Path(__file__).resolve().parents[1] / "agents" / "governance.py"
spec = importlib.util.spec_from_file_location("syndimatch_governance", module_path)
governance = importlib.util.module_from_spec(spec)
spec.loader.exec_module(governance)
allocation_fingerprint = governance.allocation_fingerprint
approval_authorizes_settlement = governance.approval_authorizes_settlement
version_allocation = governance.version_allocation
validate_bid_amount = governance.validate_bid_amount


def proposal(amount=60_000_000):
    return {
        "_id": "ALLOC-SYND-001",
        "syndication_id": "SYND-001",
        "allocations": [{
            "_id": "ALLOC-BID-1",
            "bid_id": "BID-1",
            "participant_agent_id": "PA-1",
            "final_allocation": amount,
            "final_spread": 250,
        }],
    }


class GovernanceTests(unittest.TestCase):
    def test_oversized_model_recommendation_is_rejected(self):
        risk = {"min_ticket": 10_000_000, "max_single_ticket": 50_000_000, "available_capacity": 40_000_000}
        self.assertEqual(
            validate_bid_amount(risk, 60_000_000),
            ["above_maximum_single_ticket", "insufficient_available_capacity"],
        )

    def test_fingerprint_matches_browser_api_implementation(self):
        allocation = version_allocation(proposal())
        self.assertEqual(
            allocation["allocation_fingerprint"],
            "ed011511a89edabece2c312502a4bebcf7ea29566e8c3b3d049ee3888b548245",
        )

    def test_unapproved_and_rejected_allocations_cannot_settle(self):
        allocation = version_allocation(proposal())
        self.assertFalse(approval_authorizes_settlement(allocation))
        allocation["allocation_status"] = "rejected"
        allocation["approval"] = {
            "decision": "rejected",
            "allocation_id": allocation["_id"],
            "allocation_version": allocation["allocation_version"],
            "allocation_fingerprint": allocation["allocation_fingerprint"],
        }
        self.assertFalse(approval_authorizes_settlement(allocation))

    def test_exact_approval_authorizes_settlement(self):
        allocation = version_allocation(proposal())
        allocation["allocation_status"] = "approved"
        allocation["approval"] = {
            "decision": "approved",
            "allocation_id": allocation["_id"],
            "allocation_version": allocation["allocation_version"],
            "allocation_fingerprint": allocation["allocation_fingerprint"],
        }
        self.assertTrue(approval_authorizes_settlement(allocation))

    def test_edit_invalidates_existing_approval(self):
        allocation = version_allocation(proposal())
        allocation["allocation_status"] = "approved"
        allocation["approval"] = {
            "decision": "approved",
            "allocation_id": allocation["_id"],
            "allocation_version": allocation["allocation_version"],
            "allocation_fingerprint": allocation["allocation_fingerprint"],
        }
        allocation["allocations"][0]["final_allocation"] += 1
        self.assertNotEqual(allocation["allocation_fingerprint"], allocation_fingerprint(allocation))
        self.assertFalse(approval_authorizes_settlement(allocation))

    def test_new_version_removes_old_approval(self):
        old = version_allocation(proposal())
        old["approval"] = {"decision": "approved"}
        renewed = version_allocation(proposal(55_000_000), old)
        self.assertEqual(renewed["allocation_version"], 2)
        self.assertEqual(renewed["allocation_status"], "pending_approval")
        self.assertNotIn("approval", renewed)


if __name__ == "__main__":
    unittest.main()
