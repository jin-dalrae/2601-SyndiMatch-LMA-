"""
SyndiMatch - Enhanced Payment Agent
Manages x402 payment processing with retry logic and payment summaries
"""

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
import logging
import hashlib
import secrets
import uuid

from .state import SyndicationState, PaymentDecision, PaymentStatus
from .config import LATE_PAYMENT_PENALTY_BPS, GRACE_PERIOD_HOURS
from .x402_client import X402Client, PaymentResult, PaymentStatus as X402PaymentStatus
from . import db

logger = logging.getLogger(__name__)

# Initialize x402 client
x402 = X402Client()

# Payment type processing order
PAYMENT_TYPE_ORDER = ["commitment_fee", "arrangement_fee", "upfront_fee", "principal"]
MAX_RETRIES = 3


class PaymentAgent:
    """
    Enhanced Payment Agent with:
    - Payment type ordering (commitment -> arrangement -> principal)
    - Retry logic with exponential backoff
    - Payment summary generation
    - Escrow release logic
    - Capacity release on failure
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
        
        synd = db.syndications().find_one({"_id": self.syndication_id})
        if not synd:
            raise ValueError(f"Syndication {self.syndication_id} not found")
        
        settlement = db.settlement_agents().find_one({"syndication_id": self.syndication_id})
        
        now = datetime.utcnow()
        funding_date = settlement.get("settlement_config", {}).get("funding_date", now + timedelta(days=5)) if settlement else now + timedelta(days=5)
        
        allocation_doc = db.allocations().find_one({"syndication_id": self.syndication_id})
        allocations = allocation_doc.get("allocations", []) if allocation_doc else []
        
        total_commitment_fees = sum(a.get("fees", {}).get("commitment_fee", 0) for a in allocations)
        total_arrangement_fees = sum(a.get("fees", {}).get("arrangement_fee", 0) for a in allocations)
        total_upfront_fees = sum(a.get("fees", {}).get("upfront_fee", 0) for a in allocations)
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
                {"payment_type": "commitment_fee", "due_date": now + timedelta(hours=24), "total_amount_due": total_commitment_fees, "currency": synd.get("loan_details", {}).get("currency", "USD"), "recipient": f"originator-{synd['originator_agent_id']}-wallet", "participants_count": len(allocations), "status": "pending", "collected": 0},
                {"payment_type": "arrangement_fee", "due_date": funding_date, "total_amount_due": total_arrangement_fees, "currency": synd.get("loan_details", {}).get("currency", "USD"), "recipient": f"originator-{synd['originator_agent_id']}-wallet", "participants_count": len(allocations), "status": "pending", "collected": 0},
                {"payment_type": "upfront_fee", "due_date": funding_date, "total_amount_due": total_upfront_fees, "currency": synd.get("loan_details", {}).get("currency", "USD"), "recipient": f"originator-{synd['originator_agent_id']}-wallet", "participants_count": len(allocations), "status": "pending", "collected": 0},
                {"payment_type": "principal", "due_date": funding_date, "total_amount_due": total_principal, "currency": synd.get("loan_details", {}).get("currency", "USD"), "recipient": f"escrow-{self.syndication_id}-wallet", "participants_count": len(allocations), "status": "pending", "collected": 0}
            ],
            "decision_rules": {
                "partial_payment_handling": "accept_and_track",
                "late_payment_penalty": {"enabled": True, "rate_bps": LATE_PAYMENT_PENALTY_BPS, "grace_period_hours": GRACE_PERIOD_HOURS},
                "default_handling": {"auto_notify_originator": True, "reallocation_trigger": True, "break_fee_collection": True, "break_fee_percentage": 2.0}
            },
            "performance_tracking": {
                "total_expected": total_commitment_fees + total_arrangement_fees + total_upfront_fees + total_principal,
                "total_collected": 0,
                "collection_rate": 0.0,
                "payments_on_time": 0,
                "payments_late": 0,
                "payments_failed": 0,
                "payments_defaulted": 0,
                "average_delay_hours": 0,
                "breakdown_by_type": {
                    "commitment_fee": {"expected": total_commitment_fees, "collected": 0, "count": 0},
                    "arrangement_fee": {"expected": total_arrangement_fees, "collected": 0, "count": 0},
                    "upfront_fee": {"expected": total_upfront_fees, "collected": 0, "count": 0},
                    "principal": {"expected": total_principal, "collected": 0, "count": 0}
                }
            }
        }
        
        db.payment_agents().insert_one(config)
        return config

    def process_payment_type(self, state: SyndicationState, payment_type: str) -> List[Dict[str, Any]]:
        """Process payments of a specific type"""
        logger.info(f"[{self.agent_id}] Processing payments: {payment_type}")
        
        # Check if payments exist, if not generate them
        pending_payments = list(db.payment_history().find({
            "syndication_id": self.syndication_id,
            "payment_type": payment_type,
            "payment_status": "pending"
        }))
        
        if not pending_payments:
            logger.info(f"[{self.agent_id}] Generating pending payments for {payment_type}")
            self._generate_payments_of_type(payment_type)
            pending_payments = list(db.payment_history().find({
                "syndication_id": self.syndication_id,
                "payment_type": payment_type,
                "payment_status": "pending"
            }))
        
        results = []
        for payment in pending_payments:
            # Process payment
            result = self._process_single_payment(payment)
            
            # Record result
            payment_record = {
                "payment_id": payment["_id"],
                "payment_type": payment_type,
                "payer": payment["payer"],
                "amount_due": payment["amount_due"],
                "amount_paid": result.amount_processed,
                "status": result.status,
                "transaction_hash": result.transaction_hash
            }
            results.append(payment_record)
            
        return results

    def retry_payment(self, payment: Dict[str, Any], max_retries: int = 3) -> Dict[str, Any]:
        """Retry a failed payment"""
        logger.info(f"[{self.agent_id}] Retrying payment {payment['payment_id']}")
        
        # Fetch fresh record
        current_record = db.payment_history().find_one({"_id": payment["payment_id"]})
        if not current_record:
            return payment # Should not happen
            
        if current_record["payment_status"] == "completed":
            payment["status"] = "completed"
            return payment
            
        # Retry logic (simplified: just try again)
        result = self._process_single_payment(current_record)
        
        return {
            "payment_id": payment["payment_id"],
            "payment_type": payment["payment_type"],
            "payer": payment["payer"],
            "amount_due": payment["amount_due"],
            "amount_paid": result.amount_processed,
            "status": result.status,
            "transaction_hash": result.transaction_hash
        }

    def _generate_payments_of_type(self, payment_type: str):
        """Generate payment records for a specific type from allocations"""
        allocation_doc = db.allocations().find_one({"syndication_id": self.syndication_id})
        if not allocation_doc:
            logger.warning(f"[{self.agent_id}] No allocations found to generate payments")
            return

        synd = db.syndications().find_one({"_id": self.syndication_id})
        originator_wallet = self.config["payment_config"]["originator_wallet"]
        escrow_wallet = self.config["payment_config"]["escrow_wallet"]

        for alloc in allocation_doc.get("allocations", []):
            p_id = str(alloc['participant_agent_id'])
            payment_id = f"PAY-{self.syndication_id.split('-')[-1]}-{p_id.split('-')[-1]}-{payment_type}"
            
            # Determine amount and recipient
            amount = 0
            recipient_wallet = originator_wallet
            
            if payment_type == "commitment_fee":
                amount = alloc["fees"]["commitment_fee"]
            elif payment_type == "arrangement_fee":
                amount = alloc["fees"]["arrangement_fee"]
            elif payment_type == "principal":
                amount = alloc["final_allocation"]
                recipient_wallet = escrow_wallet
            
            if amount > 0:
                # Use UUID for payment ID to prevent collisions across retries
                payment_id = f"PAY-{uuid.uuid4().hex[:12].upper()}"
                
                # Get due date from schedule (single source of truth)
                schedule_due_date = self._get_schedule_due_date(payment_type)
                
                payment = {
                    "_id": payment_id,
                    "payment_agent_id": self.agent_id,
                    "syndication_id": self.syndication_id,
                    "allocation_id": alloc["_id"],
                    "payer": {
                        "participant_agent_id": alloc["participant_agent_id"],
                        "institution_name": alloc["institution_name"],
                        "wallet_address": f"participant-{alloc['participant_agent_id']}-wallet"
                    },
                    "recipient": {
                        "type": "originator" if payment_type != "principal" else "escrow",
                        "agent_id": synd["originator_agent_id"],
                        "wallet_address": recipient_wallet
                    },
                    "payment_type": payment_type,
                    "amount_due": amount,
                    "amount_paid": 0,
                    "currency": self.config["payment_config"]["base_currency"],
                    "due_date": schedule_due_date,
                    "payment_status": "pending",
                    "created_at": datetime.utcnow()
                }
                
                # INSERT only, never overwrite (ledger entries are immutable)
                db.payment_history().insert_one(payment)
    
    def _get_schedule_due_date(self, payment_type: str) -> datetime:
        """Get due date from payment schedule (single source of truth)"""
        for schedule in self.config.get("payment_schedule", []):
            if schedule["payment_type"] == payment_type:
                return schedule["due_date"]
        return datetime.utcnow() + timedelta(days=5)
    
    def process_payments(self, state: SyndicationState) -> SyndicationState:
        """Process payments in order: commitment -> arrangement -> principal"""
        logger.info(f"[{self.agent_id}] Processing payments for {self.syndication_id}")
        
        state["payment_agent_id"] = self.agent_id
        if "payments" not in state:
            state["payments"] = []
        
        # Process by payment type in order
        for payment_type in PAYMENT_TYPE_ORDER:
            pending_payments = list(db.payment_history().find({
                "syndication_id": self.syndication_id,
                "payment_type": payment_type,
                "payment_status": {"$in": ["pending", "retry"]}
            }))
            
            if not pending_payments:
                continue
            
            logger.info(f"[{self.agent_id}] Processing {len(pending_payments)} {payment_type} payments")
            
            for payment in pending_payments:
                result = self._process_single_payment_with_retry(payment)
                state["payments"].append({
                    "payment_id": payment["_id"],
                    "payment_type": payment_type,
                    "status": result.status,
                    "amount": result.amount_processed,
                    "transaction_hash": result.transaction_hash,
                    "is_on_time": result.is_on_time
                })
        
        # Update tracking and generate summary
        self._update_tracking()
        self._generate_payment_summary()
        
        return state
    
    def process_single_payment(self, payment: Dict[str, Any]) -> PaymentDecision:
        """Public method for orchestrator to process single payment with retry"""
        return self._process_single_payment_with_retry(payment)

    def _process_single_payment(self, payment: Dict[str, Any]) -> PaymentDecision:
        """Internal compatibility wrapper for legacy call sites."""
        return self._process_single_payment_with_retry(payment)
    
    def _process_single_payment_with_retry(self, payment: Dict[str, Any], attempt: int = 1) -> PaymentDecision:
        """Process a single payment with retry logic"""
        payment_id = payment["_id"]
        amount = payment["amount_due"]
        retry_count = payment.get("retry_count", 0)
        
        logger.info(f"[{self.agent_id}] Processing payment {payment_id}: ${amount:,} (attempt {attempt})")
        
        try:
            result = self._execute_payment(payment)
            
            if result.status == "failed" and attempt < MAX_RETRIES:
                # Update retry count
                db.payment_history().update_one(
                    {"_id": payment_id},
                    {"$set": {"payment_status": "retry", "retry_count": retry_count + 1}}
                )
                # Retry with exponential backoff (simulated)
                import time
                time.sleep(min(2 ** attempt, 10))
                payment["retry_count"] = retry_count + 1
                return self._process_single_payment_with_retry(payment, attempt + 1)
            
            return result
            
        except Exception as e:
            logger.error(f"[{self.agent_id}] Payment {payment_id} failed: {e}")
            
            if attempt < MAX_RETRIES:
                db.payment_history().update_one(
                    {"_id": payment_id},
                    {"$set": {"payment_status": "retry", "retry_count": retry_count + 1, "last_error": str(e)}}
                )
                return self._process_single_payment_with_retry(payment, attempt + 1)
            
            # Max retries exceeded - handle failure
            self._handle_payment_failure(payment)
            
            return PaymentDecision(
                payment_id=payment_id,
                status="failed",
                amount_processed=0,
                amount_due=amount,
                reasoning=f"Payment failed after {MAX_RETRIES} attempts: {e}"
            )
    
    def _execute_payment(self, payment: Dict[str, Any]) -> PaymentDecision:
        """Execute a single payment via x402"""
        payment_id = payment["_id"]
        amount = payment["amount_due"]
        due_date = payment.get("due_date")
        
        now = datetime.utcnow()
        
        # Check if late
        is_late = False
        delay_hours = 0
        penalty = 0
        
        if due_date:
            if isinstance(due_date, str):
                due_date = datetime.fromisoformat(due_date.replace("Z", ""))
            if now > due_date:
                delay_hours = (now - due_date).total_seconds() / 3600
                if delay_hours > GRACE_PERIOD_HOURS:
                    is_late = True
                    penalty = amount * 0.001  # 0.1% flat late fee
        
        # Execute x402 payment
        payer_wallet = payment.get("payer", {}).get("wallet_address", f"participant-{payment.get('payer', {}).get('participant_agent_id', 'unknown')}-wallet")
        recipient_wallet = payment.get("recipient", {}).get("wallet_address", self.config["payment_config"]["originator_wallet"])
        
        # Execute x402 payment via client
        try:
            payment_result = x402.create_payment(
                from_address=payer_wallet,
                to_address=recipient_wallet,
                amount=amount,
                currency="USDC",
                network="base",
                metadata={
                    "syndication_id": self.syndication_id,
                    "payment_type": payment["payment_type"],
                    "payment_id": payment_id
                }
            )
        except Exception as e:
            logger.error(f"[{self.agent_id}] Payment {payment_id} FAILED: {e}")
            db.payment_history().update_one(
                {"_id": payment_id},
                {
                    "$set": {
                        "payment_status": "failed",
                        "failure_reason": str(e),
                        "failed_at": now,
                        "updated_at": now
                    },
                    "$inc": {"retry_count": 1}
                }
            )
            return PaymentDecision(
                payment_id=payment_id,
                status="failed",
                transaction_hash=None,
                amount_processed=0,
                penalties_applied=0,
                reasoning=f"Payment failed: {e}"
            )
        
        if payment_result.status != X402PaymentStatus.CONFIRMED:
            return PaymentDecision(
                payment_id=payment_id,
                status="failed",
                amount_processed=0,
                amount_due=amount,
                reasoning=f"Payment not confirmed: {payment_result.error or 'Unknown error'}"
            )
        
        tx_hash = payment_result.transaction_hash
        
        # Update payment record (SUCCESS path)
        db.payment_history().update_one(
            {"_id": payment_id},
            {
                "$set": {
                    "payment_status": "completed",
                    "amount_paid": amount,
                    "initiated_at": now,
                    "completed_at": now,
                    "payment_delay_hours": delay_hours,
                    "is_on_time": not is_late,
                    "late_fee": round(penalty, 2),
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
                        "total_penalty": round(penalty, 2),
                        "penalty_collected": False  # Track if penalty was collected
                    },
                    "reconciliation": {
                        "reconciled": True,
                        "reconciled_at": now,
                        "reconciled_by": self.agent_id,
                        "discrepancies": []
                    },
                    "updated_at": now
                }
            }
        )
        
        # Update participant state (only on success, with correct on-time tracking)
        self._update_participant_after_payment(
            payment.get("payer", {}).get("participant_agent_id"),
            payment["payment_type"],
            amount,
            is_on_time=not is_late  # Pass actual on-time status
        )
        
        # Update originator state
        self._update_originator_after_payment(
            payment.get("recipient", {}).get("agent_id"),
            payment["payment_type"],
            amount
        )
        
        return PaymentDecision(
            payment_id=payment_id,
            status="completed",
            transaction_hash=tx_hash,
            amount_processed=amount,
            amount_due=amount,
            penalties_applied=penalty,
            is_on_time=not is_late,
            delay_hours=delay_hours,
            reasoning=f"Payment processed {'late' if is_late else 'on time'}"
        )

    def poll_transaction_status(self, payment_id: str) -> Dict[str, Any]:
        """
        Poll x402 for transaction status and update database.
        Returns fresh status information.
        """
        payment = db.payment_history().find_one({"_id": payment_id})
        if not payment:
            return {"status": "not_found"}
        
        # If already completed or failed, just return
        if payment["payment_status"] in ["completed", "failed"]:
            return {"status": payment["payment_status"]}
            
        tx_hash = payment.get("transaction", {}).get("transaction_hash")
        if not tx_hash:
            return {"status": "pending", "reason": "no_transaction_hash"}
            
        try:
            status_info = x402.get_transfer_status(tx_hash)
            new_status = status_info["status"] # 'confirmed', 'pending', 'failed'
            
            if new_status == "confirmed":
                # Finalize the payment in DB
                db.payment_history().update_one(
                    {"_id": payment_id},
                    {
                        "$set": {
                            "payment_status": "completed",
                            "updated_at": datetime.utcnow(),
                            "confirmation_received_at": datetime.utcnow(),
                            "transaction.finalized": True,
                            "transaction.confirmations": status_info.get("confirmations", 12)
                        }
                    }
                )
                logger.info(f"[{self.agent_id}] Payment {payment_id} CONFIRMED on-chain")
                
                # Update participant/originator as before
                self._update_participant_after_payment(
                    payment["payer"]["participant_agent_id"],
                    payment["payment_type"],
                    payment["amount_due"],
                    is_on_time=payment.get("is_on_time", True)
                )
                
            elif new_status == "failed":
                db.payment_history().update_one(
                    {"_id": payment_id},
                    {
                        "$set": {
                            "payment_status": "failed",
                            "updated_at": datetime.utcnow(),
                            "failure_reason": status_info.get("error", "On-chain failure")
                        }
                    }
                )
                logger.error(f"[{self.agent_id}] Payment {payment_id} FAILED on-chain")
                
            return {"status": new_status, "confirmations": status_info.get("confirmations", 0)}
            
        except Exception as e:
            logger.error(f"[{self.agent_id}] Failed to poll status for {payment_id}: {e}")
            return {"status": "error", "reason": str(e)}
    
    def _handle_payment_failure(self, payment: Dict[str, Any]) -> None:
        """Handle failed payment - release capacity and collect break fee"""
        payment_id = payment["_id"]
        participant_id = payment.get("payer", {}).get("participant_agent_id")
        
        logger.warning(f"[{self.agent_id}] Handling payment failure for {payment_id}")
        
        # Mark payment as failed
        db.payment_history().update_one(
            {"_id": payment_id},
            {"$set": {"payment_status": "failed", "failed_at": datetime.utcnow()}}
        )
        
        if not participant_id:
            return
        
        # Get allocation to release capacity
        allocation_doc = db.allocations().find_one({"syndication_id": self.syndication_id})
        if not allocation_doc:
            return
        
        participant_alloc = None
        for alloc in allocation_doc.get("allocations", []):
            if alloc["participant_agent_id"] == participant_id:
                participant_alloc = alloc
                break
        
        if not participant_alloc:
            return
        
        allocation_amount = participant_alloc.get("final_allocation", 0)
        
        # Release participant capacity
        db.participant_agents().update_one(
            {"_id": participant_id},
            {
                "$inc": {
                    "risk_appetite.available_capacity": allocation_amount,
                    "risk_appetite.current_deployed": -allocation_amount
                },
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        
        # Create break fee payment
        break_fee_pct = self.config["decision_rules"]["default_handling"]["break_fee_percentage"]
        break_fee = int(allocation_amount * break_fee_pct / 100)
        
        break_fee_payment = {
            "_id": f"BREAK-{payment_id}",
            "payment_agent_id": self.agent_id,
            "syndication_id": self.syndication_id,
            "payer": payment.get("payer", {}),
            "recipient": payment.get("recipient", {}),
            "payment_type": "break_fee",
            "amount_due": break_fee,
            "amount_paid": 0,
            "currency": "USD",
            "due_date": datetime.utcnow() + timedelta(hours=24),
            "payment_status": "pending",
            "reason": "payment_failure",
            "original_payment_id": payment_id,
            "created_at": datetime.utcnow()
        }
        
        db.payment_history().insert_one(break_fee_payment)
        logger.info(f"[{self.agent_id}] Created break fee payment: ${break_fee:,} for {participant_id}")
    
    def _generate_payment_summary(self) -> None:
        """Generate consolidated payment summary for dashboard"""
        all_payments = list(db.payment_history().find({"syndication_id": self.syndication_id}))
        
        # Calculate by type
        by_type = {}
        for payment_type in PAYMENT_TYPE_ORDER + ["break_fee"]:
            type_payments = [p for p in all_payments if p.get("payment_type") == payment_type]
            completed = [p for p in type_payments if p.get("payment_status") == "completed"]
            
            by_type[payment_type] = {
                "total": len(type_payments),
                "completed": len(completed),
                "pending": len([p for p in type_payments if p.get("payment_status") in ["pending", "retry"]]),
                "failed": len([p for p in type_payments if p.get("payment_status") == "failed"]),
                "amount_expected": sum(p.get("amount_due", 0) for p in type_payments),
                "amount_collected": sum(p.get("amount_paid", 0) for p in completed)
            }
        
        # Calculate by participant
        by_participant = {}
        participant_ids = set(p.get("payer", {}).get("participant_agent_id") for p in all_payments if p.get("payer"))
        
        for pid in participant_ids:
            if not pid:
                continue
            p_payments = [p for p in all_payments if p.get("payer", {}).get("participant_agent_id") == pid]
            completed = [p for p in p_payments if p.get("payment_status") == "completed"]
            on_time = [p for p in completed if p.get("is_on_time", True)]
            
            by_participant[pid] = {
                "institution_name": p_payments[0].get("payer", {}).get("institution_name") if p_payments else "Unknown",
                "total_payments": len(p_payments),
                "completed": len(completed),
                "on_time": len(on_time),
                "late": len(completed) - len(on_time),
                "on_time_rate": round(len(on_time) / len(completed), 3) if completed else 1.0,
                "total_paid": sum(p.get("amount_paid", 0) for p in completed)
            }
        
        # Overall status
        total = len(all_payments)
        completed = len([p for p in all_payments if p.get("payment_status") == "completed"])
        
        if completed == total and total > 0:
            overall_status = "complete"
        elif completed > 0:
            overall_status = "in_progress"
        else:
            overall_status = "pending"
        
        summary = {
            "_id": f"PAYSUM-{self.syndication_id}",
            "syndication_id": self.syndication_id,
            "payment_agent_id": self.agent_id,
            "overall_status": overall_status,
            "total_payments": total,
            "completed_payments": completed,
            "completion_rate": round(completed / total, 3) if total > 0 else 0,
            "total_expected": sum(p.get("amount_due", 0) for p in all_payments),
            "total_collected": sum(p.get("amount_paid", 0) for p in all_payments if p.get("payment_status") == "completed"),
            "by_payment_type": by_type,
            "by_participant": by_participant,
            "updated_at": datetime.utcnow()
        }
        
        db.get_collection("payment_summaries").replace_one(
            {"_id": summary["_id"]},
            summary,
            upsert=True
        )
        
        logger.info(f"[{self.agent_id}] Generated payment summary: {completed}/{total} payments complete")
    
    def generate_payment_receipt(self, payment_record: Dict[str, Any]) -> Dict[str, Any]:
        """Generate receipt for completed payment"""
        return {
            "receipt_id": f"RCP-{payment_record['_id']}",
            "syndication_id": self.syndication_id,
            "participant": payment_record.get("payer", {}).get("institution_name", "Unknown"),
            "participant_id": payment_record.get("payer", {}).get("participant_agent_id"),
            "payment_type": payment_record.get("payment_type"),
            "amount": payment_record.get("amount_paid", 0),
            "currency": payment_record.get("currency", "USD"),
            "transaction_hash": payment_record.get("transaction", {}).get("transaction_hash"),
            "completed_at": payment_record.get("completed_at"),
            "is_on_time": payment_record.get("is_on_time", True),
            "late_fee": payment_record.get("penalties", {}).get("late_fee", 0),
            "generated_at": datetime.utcnow().isoformat()
        }
    
    def release_escrow_to_borrower(self) -> Dict[str, Any]:
        """Release escrow funds to borrower after all principal collected"""
        logger.info(f"[{self.agent_id}] Initiating escrow release for {self.syndication_id}")
        
        # Verify all principal payments completed
        principal_payments = list(db.payment_history().find({
            "syndication_id": self.syndication_id,
            "payment_type": "principal"
        }))
        
        pending = [p for p in principal_payments if p.get("payment_status") != "completed"]
        if pending:
            return {"error": f"{len(pending)} principal payments still pending", "status": "blocked"}
        
        total_principal = sum(p.get("amount_paid", 0) for p in principal_payments)
        
        # Get borrower wallet from syndication
        synd = db.syndications().find_one({"_id": self.syndication_id})
        borrower_wallet = f"borrower-{synd.get('loan_details', {}).get('borrower_name', 'unknown').replace(' ', '-').lower()}-wallet"
        
        # Execute escrow release
        escrow_wallet = self.config["payment_config"]["escrow_wallet"]
        
        result = x402.release_escrow(
            escrow_id=self.syndication_id,
            to_address=borrower_wallet,
            total_amount=total_principal
        )
        
        # Record release
        release_record = {
            "_id": f"ESCROW-REL-{self.syndication_id}",
            "syndication_id": self.syndication_id,
            "from_wallet": escrow_wallet,
            "to_wallet": borrower_wallet,
            "amount": total_principal,
            "platform_fee": result.get("platform_fee", 0),
            "net_amount": result.get("borrower_amount", total_principal),
            "transaction_hash": result.get("transaction_hash"),
            "status": "completed",
            "released_at": datetime.utcnow()
        }
        
        db.get_collection("escrow_releases").insert_one(release_record)
        
        logger.info(f"[{self.agent_id}] Escrow released: ${total_principal:,} to borrower")
        return release_record
    
    def _update_participant_after_payment(self, participant_id: str, payment_type: str, amount: int, is_on_time: bool) -> None:
        """Update participant state after payment"""
        if not participant_id:
            return
        
        now = datetime.utcnow()
        
        update = {
            "$inc": {
                f"fees_paid_ytd.{payment_type}": amount,
                "performance_history.payments_made": 1,
                "payment_stats.total_payments": 1
            },
            "$set": {
                "last_payment_at": now,
                "updated_at": now
            }
        }
        
        if is_on_time:
            update["$inc"]["performance_history.payments_on_time"] = 1
            update["$inc"]["payment_stats.on_time_payments"] = 1
        else:
            update["$inc"]["performance_history.payments_late"] = 1
            update["$inc"]["payment_stats.late_payments"] = 1
        
        db.participant_agents().update_one({"_id": participant_id}, update)
        
        # Update reliability score
        participant = db.participant_agents().find_one({"_id": participant_id})
        if participant:
            stats = participant.get("payment_stats", {})
            total = stats.get("total_payments", 1)
            on_time = stats.get("on_time_payments", total)
            reliability = round((on_time / total) * 100, 1) if total > 0 else 100
            on_time_rate = round(on_time / total, 3) if total > 0 else 1.0
            
            db.participant_agents().update_one(
                {"_id": participant_id},
                {
                    "$set": {
                        "payment_stats.reliability_score": reliability,
                        "performance_history.on_time_rate": on_time_rate
                    }
                }
            )
    
    def _update_originator_after_payment(self, originator_id: str, payment_type: str, amount: int) -> None:
        """Update originator state after receiving payment"""
        if not originator_id:
            return
        
        now = datetime.utcnow()
        
        db.originator_agents().update_one(
            {"_id": originator_id},
            {
                "$inc": {
                    f"fees_by_type.{payment_type}": amount,
                    "total_fees_ytd": amount
                },
                "$set": {
                    "last_payment_received": now,
                    "updated_at": now
                }
            }
        )
    
    def _update_tracking(self) -> None:
        """Update payment agent performance tracking"""
        all_payments = list(db.payment_history().find({"syndication_id": self.syndication_id}))
        
        completed = [p for p in all_payments if p.get("payment_status") == "completed"]
        total_collected = sum(p.get("amount_paid", 0) for p in completed)
        on_time = sum(1 for p in completed if p.get("is_on_time", True))
        late = len(completed) - on_time
        failed = len([p for p in all_payments if p.get("payment_status") == "failed"])
        
        total_expected = self.config["performance_tracking"]["total_expected"]
        
        # Breakdown by type
        breakdown = {}
        for ptype in PAYMENT_TYPE_ORDER:
            type_completed = [p for p in completed if p.get("payment_type") == ptype]
            breakdown[ptype] = {
                "expected": self.config["performance_tracking"]["breakdown_by_type"].get(ptype, {}).get("expected", 0),
                "collected": sum(p.get("amount_paid", 0) for p in type_completed),
                "count": len(type_completed)
            }
        
        db.payment_agents().update_one(
            {"_id": self.agent_id},
            {
                "$set": {
                    "performance_tracking.total_collected": total_collected,
                    "performance_tracking.collection_rate": round(total_collected / total_expected, 4) if total_expected > 0 else 0,
                    "performance_tracking.payments_on_time": on_time,
                    "performance_tracking.payments_late": late,
                    "performance_tracking.payments_failed": failed,
                    "performance_tracking.breakdown_by_type": breakdown,
                    "updated_at": datetime.utcnow()
                }
            }
        )
    
    def process_commitment_fees(self, state: SyndicationState) -> List[Dict[str, Any]]:
        """Process commitment fee payments"""
        return self.process_payment_type(state, "commitment_fee")

    def process_arrangement_fees(self, state: SyndicationState) -> List[Dict[str, Any]]:
        """Process arrangement fee payments"""
        return self.process_payment_type(state, "arrangement_fee")

    def process_principal_payments(self, state: SyndicationState) -> List[Dict[str, Any]]:
        """Process principal payments"""
        return self.process_payment_type(state, "principal")

    def check_payment_status(self, payment_id: str) -> Dict[str, Any]:
        """Check status of a specific payment"""
        payment = db.payment_history().find_one({"_id": payment_id})
        if not payment:
            return {"status": "not_found"}
        return {
            "status": payment["payment_status"],
            "amount_paid": payment.get("amount_paid", 0),
            "updated_at": payment.get("updated_at")
        }

    def handle_late_payments(self, state: SyndicationState) -> List[Dict[str, Any]]:
        """Identify and audit overdue payments"""
        now = datetime.utcnow()
        overdue = list(db.payment_history().find({
            "syndication_id": self.syndication_id,
            "payment_status": "pending",
            "due_date": {"$lt": now}
        }))
        
        results = []
        for payment in overdue:
            delay = (now - payment["due_date"]).total_seconds() / 3600
            result = {
                "payment_id": payment["_id"],
                "payer": payment["payer"]["institution_name"],
                "hours_overdue": round(delay, 2),
                "penalty_accruing": True
            }
            results.append(result)
            logger.warning(f"[{self.agent_id}] Payment overdue: {payment['_id']} ({round(delay, 1)}h)")
            
        return results

    def release_escrow(self, state: SyndicationState) -> Dict[str, Any]:
        """
        Release funds from escrow to borrower.
        
        CRITICAL: Only releases if 100% of expected principal is collected.
        Partial collection means there is a default and escrow should not release.
        """
        logger.info(f"[{self.agent_id}] Evaluating escrow release for {self.syndication_id}")
        
        # Get escrow wallet details
        escrow_wallet = self.config["payment_config"]["escrow_wallet"]
        
        # Determine borrower wallet
        borrower_name = state["loan_details"].get("borrower_name", "unknown").replace(" ", "-").lower()
        borrower_wallet = f"borrower-{borrower_name}-wallet"
        
        # Get expected principal from schedule
        expected_principal = 0
        for schedule in self.config.get("payment_schedule", []):
            if schedule["payment_type"] == "principal":
                expected_principal = schedule["total_amount_due"]
                break
        
        if expected_principal == 0:
            logger.warning(f"[{self.agent_id}] No expected principal in schedule")
            return {
                "status": "skipped", 
                "reason": "no_expected_principal",
                "amount_released": 0
            }
        
        # Calculate total collected principal
        principal_payments = list(db.payment_history().find({
            "syndication_id": self.syndication_id,
            "payment_type": "principal",
            "payment_status": "completed"
        }))
        total_collected = sum(p.get("amount_paid", 0) for p in principal_payments)
        
        # Check for pending or failed payments
        pending_or_failed = db.payment_history().count_documents({
            "syndication_id": self.syndication_id,
            "payment_type": "principal",
            "payment_status": {"$in": ["pending", "failed"]}
        })
        
        if pending_or_failed > 0:
            logger.warning(f"[{self.agent_id}] Cannot release escrow: {pending_or_failed} payments pending/failed")
            return {
                "status": "blocked",
                "reason": "payments_incomplete",
                "pending_count": pending_or_failed,
                "amount_collected": total_collected,
                "amount_expected": expected_principal,
                "amount_released": 0
            }
        
        # CRITICAL: Only release if 100% collected
        collection_rate = total_collected / expected_principal if expected_principal > 0 else 0
        
        if collection_rate < 0.999:  # Allow tiny rounding differences
            logger.error(f"[{self.agent_id}] ESCROW BLOCKED: Only {collection_rate*100:.1f}% collected")
            return {
                "status": "blocked",
                "reason": "partial_collection",
                "collection_rate": collection_rate,
                "amount_collected": total_collected,
                "amount_expected": expected_principal,
                "amount_released": 0
            }

        try:
            # Call x402 release
            borrower_res, platform_res = x402.release_escrow(
                escrow_id=self.syndication_id,
                borrower_wallet=borrower_wallet,
                total_amount=total_collected
            )
            
            result = {
                "status": "completed",
                "borrower_tx": borrower_res.transaction_hash,
                "platform_fee_tx": platform_res.transaction_hash,
                "amount_released": borrower_res.amount,
                "platform_fee": platform_res.amount,
                "borrower_wallet": borrower_wallet,
                "timestamp": datetime.utcnow()
            }
            
            logger.info(f"[{self.agent_id}] Escrow release successful: {result}")
            return result
            
        except Exception as e:
            logger.error(f"[{self.agent_id}] Escrow release failed: {e}")
            return {"status": "failed", "error": str(e)}

    def complete_syndication(self, state: SyndicationState) -> SyndicationState:
        """Finalize syndication after all payments complete"""
        logger.info(f"[{self.agent_id}] Completing syndication {self.syndication_id}")

        # Release escrow funds to borrower
        escrow_result = self.release_escrow(state)
        state["payment_metrics"]["escrow_release"] = escrow_result
        
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
        
        db.payment_agents().update_one(
            {"_id": self.agent_id},
            {"$set": {"status": "completed", "completed_at": datetime.utcnow()}}
        )
        
        # Update originator success metrics
        from originator_agent import OriginatorAgent
        originator = OriginatorAgent(state["originator_agent_id"])
        originator.complete_syndication(self.syndication_id, success=True)
        
        logger.info(f"[{self.agent_id}] Syndication {self.syndication_id} completed successfully")
        return state
