"""
SyndiMatch - Payment Agent
Manages x402 payment processing and state updates
"""

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import logging
import hashlib
import secrets
import uuid

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
            payment_id = f"PAY-{self.syndication_id.split('-')[-1]}-{alloc['participant_agent_id'].split('-')[-1]}-{payment_type}"
            
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
        try:
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
            payment_status = "completed"
        except Exception as e:
            logger.error(f"[{self.agent_id}] Payment {payment_id} FAILED: {e}")
            tx_hash = None
            payment_status = "failed"
            
            # Record failure
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
        
        # Update payment record (SUCCESS path)
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
        
        # Update participant state (only on success, with correct on-time tracking)
        self._update_participant_after_payment(
            payment["payer"]["participant_agent_id"],
            payment["payment_type"],
            amount,
            is_on_time=not is_late  # Pass actual on-time status
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
                                          payment_type: str, amount: int,
                                          is_on_time: bool = True) -> None:
        """
        Update participant agent state after making a payment.
        
        Args:
            participant_id: Participant agent ID
            payment_type: Type of payment
            amount: Amount paid
            is_on_time: Whether payment was made on time (default True for backward compat)
        """
        now = datetime.utcnow()
        
        # Build increment based on on-time status
        inc_updates = {
            f"fees_paid_ytd.{payment_type}": amount,
            "performance_history.payments_made": 1
        }
        
        # Only increment on-time counter if actually on-time
        if is_on_time:
            inc_updates["performance_history.payments_on_time"] = 1
        else:
            inc_updates["performance_history.payments_late"] = 1
        
        db.participant_agents().update_one(
            {"_id": participant_id},
            {
                "$inc": inc_updates,
                "$set": {
                    "last_payment_at": now,
                    "updated_at": now
                }
            }
        )
        
        # Recalculate on-time rate atomically (fetch after increment)
        participant = db.participant_agents().find_one({"_id": participant_id})
        if participant:
            perf = participant.get("performance_history", {})
            on_time = perf.get("payments_on_time", 0)
            total = perf.get("payments_made", 1)
            
            db.participant_agents().update_one(
                {"_id": participant_id},
                {
                    "$set": {
                        "performance_history.on_time_rate": round(on_time / total, 3) if total > 0 else 1.0
                    }
                }
            )
        
        logger.info(f"[{self.agent_id}] Updated participant {participant_id} after {payment_type} ({'on-time' if is_on_time else 'LATE'})")
    
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
        """
        Finalize syndication after all payments complete.
        """
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
