"""
SyndiMatch - Enhanced Payment Agent
Manages x402 payment processing with retry logic and payment summaries
"""

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
import logging
import hashlib
import secrets
from concurrent.futures import ThreadPoolExecutor

from state import SyndicationState, PaymentDecision, PaymentStatus
from config import LATE_PAYMENT_PENALTY_BPS, GRACE_PERIOD_HOURS
from x402_client import X402Client, PaymentResult
import db

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
        
        if payment_result.status != PaymentStatus.CONFIRMED:
            return PaymentDecision(
                payment_id=payment_id,
                status="failed",
                amount_processed=0,
                amount_due=amount,
                reasoning=f"Payment not confirmed: {payment_result.error or 'Unknown error'}"
            )
        
        tx_hash = payment_result.transaction_hash
        
        # Update payment record
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
                    "penalties": {"late_fee": round(penalty, 2), "total_penalty": round(penalty, 2)},
                    "updated_at": now
                }
            }
        )
        
        # Update participant and originator
        self._update_participant_after_payment(payment.get("payer", {}).get("participant_agent_id"), payment["payment_type"], amount, not is_late)
        self._update_originator_after_payment(payment.get("recipient", {}).get("agent_id"), payment["payment_type"], amount)
        
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
        
        db.participant_agents().update_one({"_id": participant_id}, update)
        
        # Update reliability score
        participant = db.participant_agents().find_one({"_id": participant_id})
        if participant:
            stats = participant.get("payment_stats", {})
            total = stats.get("total_payments", 1)
            on_time = stats.get("on_time_payments", total)
            reliability = round((on_time / total) * 100, 1) if total > 0 else 100
            
            db.participant_agents().update_one(
                {"_id": participant_id},
                {"$set": {"payment_stats.reliability_score": reliability}}
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
    
    def complete_syndication(self, state: SyndicationState) -> SyndicationState:
        """Finalize syndication after all payments complete"""
        logger.info(f"[{self.agent_id}] Completing syndication {self.syndication_id}")
        
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
