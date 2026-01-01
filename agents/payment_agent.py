"""
SyndiMatch - Payment Agent
Manages x402 payment processing and state updates
"""

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import logging
import hashlib
import secrets

from state import SyndicationState, PaymentDecision, PaymentStatus
from config import LATE_PAYMENT_PENALTY_BPS, GRACE_PERIOD_HOURS
from x402_client import X402Client, PaymentResult
import db

logger = logging.getLogger(__name__)

# Initialize x402 client
x402 = X402Client()


class PaymentAgent:
    """
    Agent that manages payment processing via Coinbase x402.
    Responsible for:
    - Processing commitment fees, arrangement fees, and principal
    - Tracking payment status and applying penalties
    - Updating participant and originator states
    - Managing escrow releases
    """
    
    def __init__(self, syndication_id: str):
        self.syndication_id = syndication_id
        self.agent_id = f"PAY-{syndication_id}"
        self.config = self._load_or_create_config()
    
    def _load_or_create_config(self) -> Dict[str, Any]:
        """Load existing config or create new payment agent config"""
        existing = db.payment_agents().find_one({"_id": self.agent_id})
        if existing:
            return existing
        
        # Load syndication and settlement data
        synd = db.syndications().find_one({"_id": self.syndication_id})
        if not synd:
            raise ValueError(f"Syndication {self.syndication_id} not found")
        
        settlement = db.settlement_agents().find_one({"syndication_id": self.syndication_id})
        
        now = datetime.utcnow()
        funding_date = settlement.get("settlement_config", {}).get("funding_date", now + timedelta(days=5))
        
        # Build payment schedule
        allocation_doc = db.allocations().find_one({"syndication_id": self.syndication_id})
        allocations = allocation_doc.get("allocations", []) if allocation_doc else []
        
        total_commitment_fees = sum(a.get("fees", {}).get("commitment_fee", 0) for a in allocations)
        total_arrangement_fees = sum(a.get("fees", {}).get("arrangement_fee", 0) for a in allocations)
        total_principal = sum(a.get("final_allocation", 0) for a in allocations)
        
        config = {
            "_id": self.agent_id,
            "agent_type": "payment",
            "syndication_id": self.syndication_id,
            "settlement_agent_id": settlement["_id"] if settlement else None,
            "originator_agent_id": synd["originator_agent_id"],
            "originator": synd["originator"],
            "created_at": now,
            "status": "active",
            "payment_config": {
                "payment_provider": "coinbase_x402",
                "base_currency": synd.get("loan_details", {}).get("currency", "USD"),
                "escrow_enabled": True,
                "escrow_wallet": f"escrow-{self.syndication_id}-wallet",
                "originator_wallet": f"originator-{synd['originator_agent_id']}-wallet",
                "auto_processing": True,
                "require_manual_approval_above": 50000000
            },
            "payment_schedule": [
                {
                    "payment_type": "commitment_fee",
                    "due_date": now + timedelta(hours=24),
                    "total_amount_due": total_commitment_fees,
                    "currency": synd.get("loan_details", {}).get("currency", "USD"),
                    "recipient": f"originator-{synd['originator_agent_id']}-wallet",
                    "participants_count": len(allocations),
                    "status": "pending"
                },
                {
                    "payment_type": "arrangement_fee",
                    "due_date": funding_date,
                    "total_amount_due": total_arrangement_fees,
                    "currency": synd.get("loan_details", {}).get("currency", "USD"),
                    "recipient": f"originator-{synd['originator_agent_id']}-wallet",
                    "participants_count": len(allocations),
                    "status": "pending"
                },
                {
                    "payment_type": "principal",
                    "due_date": funding_date,
                    "total_amount_due": total_principal,
                    "currency": synd.get("loan_details", {}).get("currency", "USD"),
                    "recipient": f"escrow-{self.syndication_id}-wallet",
                    "participants_count": len(allocations),
                    "status": "pending"
                }
            ],
            "decision_rules": {
                "partial_payment_handling": "accept_and_track",
                "late_payment_penalty": {
                    "enabled": True,
                    "rate_bps": LATE_PAYMENT_PENALTY_BPS,
                    "grace_period_hours": GRACE_PERIOD_HOURS
                },
                "default_handling": {
                    "auto_notify_originator": True,
                    "reallocation_trigger": True,
                    "break_fee_collection": True,
                    "break_fee_percentage": 2.0
                }
            },
            "performance_tracking": {
                "total_expected": total_commitment_fees + total_arrangement_fees + total_principal,
                "total_collected": 0,
                "collection_rate": 0.0,
                "payments_on_time": 0,
                "payments_late": 0,
                "payments_defaulted": 0,
                "average_delay_hours": 0
            }
        }
        
        db.payment_agents().insert_one(config)
        return config
    
    def process_payments(self, state: SyndicationState) -> SyndicationState:
        """
        Process all pending payments for the syndication.
        """
        logger.info(f"[{self.agent_id}] Processing payments for {self.syndication_id}")
        
        state["payment_agent_id"] = self.agent_id
        
        # Get all pending payments
        pending_payments = list(db.payment_history().find({
            "syndication_id": self.syndication_id,
            "payment_status": "pending"
        }))
        
        for payment in pending_payments:
            result = self._process_single_payment(payment)
            state["payments"].append({
                "payment_id": payment["_id"],
                "status": result.status,
                "amount": result.amount_processed,
                "transaction_hash": result.transaction_hash
            })
        
        # Update payment agent tracking
        self._update_tracking()
        
        return state
    
    def _process_single_payment(self, payment: Dict[str, Any]) -> PaymentDecision:
        """
        Process a single payment via x402 (simulated).
        """
        payment_id = payment["_id"]
        amount = payment["amount_due"]
        due_date = payment.get("due_date")
        
        logger.info(f"[{self.agent_id}] Processing payment {payment_id}: ${amount:,}")
        
        now = datetime.utcnow()
        
        # Check if late
        is_late = False
        delay_hours = 0
        penalty = 0
        
        if due_date and now > due_date:
            delay_hours = (now - due_date).total_seconds() / 3600
            if delay_hours > GRACE_PERIOD_HOURS:
                is_late = True
                # Calculate penalty (annualized rate)
                penalty = amount * (LATE_PAYMENT_PENALTY_BPS / 10000) * (delay_hours / 8760)
        
        # Execute x402 payment via client
        payment_result = x402.create_payment(
            from_address=payment["payer"]["wallet_address"],
            to_address=payment["recipient"]["wallet_address"],
            amount=amount,
            currency="USDC",
            network="base",
            metadata={
                "syndication_id": self.syndication_id,
                "payment_type": payment["payment_type"],
                "payment_id": payment_id
            }
        )
        tx_hash = payment_result.transaction_hash
        
        # Update payment record
        db.payment_history().update_one(
            {"_id": payment_id},
            {
                "$set": {
                    "payment_status": "completed",
                    "amount_paid": amount,
                    "completed_at": now,
                    "payment_delay_hours": delay_hours,
                    "is_on_time": not is_late,
                    "transaction": {
                        "x402_transaction_id": f"x402-tx-{secrets.token_hex(8)}",
                        "blockchain": "base",
                        "transaction_hash": tx_hash,
                        "confirmation_blocks": 12,
                        "gas_paid": round(0.00015 + secrets.randbelow(100) * 0.000001, 6),
                        "gas_currency": "ETH",
                        "amount_sent": amount,
                        "amount_received": amount,
                        "transaction_fee": round(amount * 0.00001, 2)
                    },
                    "penalties": {
                        "late_fee": round(penalty, 2),
                        "other_adjustments": 0,
                        "total_penalty": round(penalty, 2)
                    },
                    "reconciliation": {
                        "reconciled": True,
                        "reconciled_at": now,
                        "reconciled_by": self.agent_id,
                        "discrepancies": []
                    },
                    "updated_at": now
                },
                "$push": {
                    "notifications_sent": {
                        "type": "payment_confirmed",
                        "sent_to": [payment["payer"]["participant_agent_id"], payment["recipient"]["agent_id"]],
                        "sent_at": now
                    }
                }
            }
        )
        
        # Update participant state
        self._update_participant_after_payment(
            payment["payer"]["participant_agent_id"],
            payment["payment_type"],
            amount
        )
        
        # Update originator state
        self._update_originator_after_payment(
            payment["recipient"]["agent_id"],
            payment["payment_type"],
            amount
        )
        
        return PaymentDecision(
            payment_id=payment_id,
            status="completed",
            transaction_hash=tx_hash,
            amount_processed=amount,
            penalties_applied=penalty,
            reasoning=f"Payment processed {'late' if is_late else 'on time'}"
        )
    
    def _simulate_x402_transaction(self, from_wallet: str, to_wallet: str, 
                                    amount: int) -> str:
        """
        Simulate a Coinbase x402 transaction.
        In production, this would call the actual x402 API.
        """
        # Generate deterministic but unique transaction hash
        tx_data = f"{from_wallet}:{to_wallet}:{amount}:{datetime.utcnow().isoformat()}"
        tx_hash = "0x" + hashlib.sha256(tx_data.encode()).hexdigest()[:64]
        
        logger.info(f"[{self.agent_id}] x402 Transaction: {tx_hash[:20]}...")
        return tx_hash
    
    def _update_participant_after_payment(self, participant_id: str, 
                                          payment_type: str, amount: int) -> None:
        """
        Update participant agent state after making a payment.
        """
        now = datetime.utcnow()
        
        db.participant_agents().update_one(
            {"_id": participant_id},
            {
                "$inc": {
                    f"fees_paid_ytd.{payment_type}": amount,
                    "performance_history.payments_made": 1
                },
                "$set": {
                    "last_payment_at": now,
                    "updated_at": now
                }
            }
        )
        
        # Update on-time payment rate
        participant = db.participant_agents().find_one({"_id": participant_id})
        if participant:
            perf = participant.get("performance_history", {})
            on_time = perf.get("payments_on_time", 0) + 1
            total = perf.get("payments_made", 1)
            
            db.participant_agents().update_one(
                {"_id": participant_id},
                {
                    "$set": {
                        "performance_history.payments_on_time": on_time,
                        "performance_history.on_time_rate": round(on_time / total, 3) if total > 0 else 1.0
                    }
                }
            )
        
        logger.info(f"[{self.agent_id}] Updated participant {participant_id} after {payment_type}")
    
    def _update_originator_after_payment(self, originator_id: str,
                                         payment_type: str, amount: int) -> None:
        """
        Update originator agent state after receiving a payment.
        """
        now = datetime.utcnow()
        
        db.originator_agents().update_one(
            {"_id": originator_id},
            {
                "$inc": {
                    f"fees_received_ytd.{payment_type}": amount,
                    "total_fees_ytd": amount
                },
                "$set": {
                    "last_payment_received": now,
                    "updated_at": now
                }
            }
        )
        
        logger.info(f"[{self.agent_id}] Updated originator {originator_id}: +${amount:,}")
    
    def _update_tracking(self) -> None:
        """Update payment agent performance tracking"""
        # Calculate totals
        all_payments = list(db.payment_history().find({
            "syndication_id": self.syndication_id
        }))
        
        completed = [p for p in all_payments if p.get("payment_status") == "completed"]
        total_collected = sum(p.get("amount_paid", 0) for p in completed)
        on_time = sum(1 for p in completed if p.get("is_on_time", True))
        late = len(completed) - on_time
        
        config = self.config
        total_expected = config["performance_tracking"]["total_expected"]
        
        db.payment_agents().update_one(
            {"_id": self.agent_id},
            {
                "$set": {
                    "performance_tracking.total_collected": total_collected,
                    "performance_tracking.collection_rate": round(total_collected / total_expected, 4) if total_expected > 0 else 0,
                    "performance_tracking.payments_on_time": on_time,
                    "performance_tracking.payments_late": late,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        # Update payment schedule status
        for schedule in config["payment_schedule"]:
            payment_type = schedule["payment_type"]
            type_payments = [p for p in completed if p.get("payment_type") == payment_type]
            collected = sum(p.get("amount_paid", 0) for p in type_payments)
            
            if collected >= schedule["total_amount_due"]:
                schedule["status"] = "completed"
            elif collected > 0:
                schedule["status"] = "partial"
        
        db.payment_agents().update_one(
            {"_id": self.agent_id},
            {"$set": {"payment_schedule": config["payment_schedule"]}}
        )
    
    def complete_syndication(self, state: SyndicationState) -> SyndicationState:
        """
        Finalize syndication after all payments complete.
        """
        logger.info(f"[{self.agent_id}] Completing syndication {self.syndication_id}")
        
        # Mark syndication as completed
        state["status"] = "completed"
        state["updated_at"] = datetime.utcnow().isoformat()
        
        db.syndications().update_one(
            {"_id": self.syndication_id},
            {
                "$set": {
                    "status": "completed",
                    "completed_at": datetime.utcnow(),
                    "updated_at": state["updated_at"]
                }
            }
        )
        
        # Update payment agent
        db.payment_agents().update_one(
            {"_id": self.agent_id},
            {
                "$set": {
                    "status": "completed",
                    "completed_at": datetime.utcnow()
                }
            }
        )
        
        # Update originator's success metrics
        from originator_agent import OriginatorAgent
        originator = OriginatorAgent(state["originator_agent_id"])
        originator.complete_syndication(self.syndication_id, success=True)
        
        logger.info(f"[{self.agent_id}] Syndication {self.syndication_id} completed successfully")
        return state
