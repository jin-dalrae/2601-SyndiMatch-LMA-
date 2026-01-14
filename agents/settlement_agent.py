"""
SyndiMatch - Enhanced Settlement Agent
Manages post-auction settlement with rollback, payment verification, and participant tracking
"""

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
import logging

from .state import SyndicationState, SettlementDecision
from .config import COMMITMENT_FEE_DUE_HOURS
from . import db

logger = logging.getLogger(__name__)


class SettlementAgent:
    """
    Enhanced Settlement Agent with:
    - Rollback/recovery on failures
    - Multi-payment type creation (commitment, arrangement, principal)
    - Per-participant progress tracking
    - Deadline enforcement
    - Break fee logic
    """
    
    WORKFLOW_STAGES = [
        {"stage": 1, "name": "allocation_confirmation", "duration_hours": 2},
        {"stage": 2, "name": "payment_collection", "duration_hours": 24},
        {"stage": 3, "name": "legal_documentation", "duration_hours": 48},
        {"stage": 4, "name": "compliance_verification", "duration_hours": 24},
        {"stage": 5, "name": "final_funding", "duration_hours": 4}
    ]
    
    def __init__(self, syndication_id: str):
        self.syndication_id = syndication_id
        self.agent_id = f"SA-{syndication_id}"
        self.config = self._load_or_create_config()
        self.participant_status: Dict[str, Dict[str, Any]] = {}
    
    def _load_or_create_config(self) -> Dict[str, Any]:
        """Load existing config or create new settlement agent config"""
<<<<<<< HEAD
        existing = db.settlement_agents().find_one({"_id": self.agent_id})
        if existing:
            return existing
        
        synd = db.syndications().find_one({"_id": self.syndication_id})
        if not synd:
            raise ValueError(f"Syndication {self.syndication_id} not found")
        
        neg = db.negotiation_agents().find_one({"syndication_id": self.syndication_id})
        
        loan_type = synd.get("loan_details", {}).get("loan_type", "Corporate")
        if "Bridge" in loan_type or "Revolver" in loan_type:
            settlement_days = 3
        elif "Project" in loan_type:
            settlement_days = 7
        else:
            settlement_days = 5
        
        now = datetime.utcnow()
        funding_date = now + timedelta(days=settlement_days)
        
        rating = synd.get("loan_details", {}).get("credit_rating", "BBB")
        if rating.startswith("A"):
            arrangement_fee = 1.5
        elif rating.startswith("BBB"):
            arrangement_fee = 2.0
        else:
            arrangement_fee = 2.5
        
        config = {
            "_id": self.agent_id,
            "agent_type": "settlement",
            "syndication_id": self.syndication_id,
            "negotiation_agent_id": neg["_id"] if neg else None,
            "originator_agent_id": synd["originator_agent_id"],
            "originator": synd["originator"],
            "created_at": now,
            "status": "active",
            "activated_at": now,
            "settlement_config": {
                "settlement_period_days": settlement_days,
                "funding_date": funding_date,
                "payment_method": "coinbase_x402",
                "escrow_required": True,
                "legal_doc_platform": "docusign"
            },
            "payment_schedule": {
                "commitment_fee_percentage": synd.get("pricing", {}).get("commitment_fee", 0.5),
                "commitment_fee_due": "t+1_business_day",
                "arrangement_fee_percentage": arrangement_fee,
                "arrangement_fee_due": "funding_date",
                "upfront_fee_percentage": synd.get("pricing", {}).get("upfront_fee", 1.0),
                "upfront_fee_due": "funding_date",
                "break_fee_percentage": 2.0,
                "payment_currency": synd.get("loan_details", {}).get("currency", "USD")
            },
            "x402_payment_config": {
                "originator_wallet": f"originator-{synd['originator_agent_id']}-wallet",
                "escrow_wallet": f"escrow-{self.syndication_id}-wallet",
                "enable_smart_contract": True,
                "penalty_for_late_payment": 0.5
            },
            "workflow_stages": self.WORKFLOW_STAGES,
            "participant_statuses": {},
            "performance_tracking": {
                "current_stage": 0,
                "stages_completed": 0,
                "payments_received": 0,
                "payments_pending": 0,
                "documents_signed": 0,
                "documents_pending": 0,
                "compliance_checks_passed": 0,
                "estimated_completion_date": funding_date,
                "actual_completion_date": None
=======
        try:
            existing = db.settlement_agents().find_one({"_id": self.agent_id})
            if existing:
                return existing
            
            # Load syndication and negotiation data
            synd = db.syndications().find_one({"_id": self.syndication_id})
            if not synd:
                raise ValueError(f"Syndication {self.syndication_id} not found")
            
            neg = db.negotiation_agents().find_one({"syndication_id": self.syndication_id})
            
            # Calculate settlement period based on loan type
            loan_type = synd.get("loan_details", {}).get("loan_type", "Corporate")
            if "Bridge" in loan_type or "Revolver" in loan_type:
                settlement_days = 3
            elif "Project" in loan_type:
                settlement_days = 7
            else:
                settlement_days = 5
            
            now = datetime.utcnow()
            funding_date = now + timedelta(days=settlement_days)
            
            # Calculate fee percentages based on credit rating
            rating = synd.get("loan_details", {}).get("credit_rating", "BBB")
            if rating.startswith("A"):
                arrangement_fee = 1.5
            elif rating.startswith("BBB"):
                arrangement_fee = 2.0
            else:
                arrangement_fee = 2.5
            
            config = {
                "_id": self.agent_id,
                "agent_type": "settlement",
                "syndication_id": self.syndication_id,
                "negotiation_agent_id": neg["_id"] if neg else None,
                "originator_agent_id": synd.get("originator_agent_id", "system-originator"),
                "originator": synd.get("originator", "SyndiMatch Protocol"),
                "created_at": now,
                "status": "active",
                "activated_at": now,
                "settlement_config": {
                    "settlement_period_days": settlement_days,
                    "funding_date": funding_date,
                    "payment_method": "coinbase_x402",
                    "escrow_required": True,
                    "legal_doc_platform": "docusign"
                },
                "payment_schedule": {
                    "commitment_fee_percentage": synd.get("pricing", {}).get("commitment_fee", 0.5),
                    "commitment_fee_due": "t+1_business_day",
                    "arrangement_fee_percentage": arrangement_fee,
                    "arrangement_fee_due": "funding_date",
                    "break_fee_percentage": 2.0,
                    "payment_currency": synd.get("loan_details", {}).get("currency", "USD")
                },
                "x402_payment_config": {
                    "originator_wallet": f"originator-{synd.get('originator_agent_id', 'sys')}-wallet",
                    "escrow_wallet": f"escrow-{self.syndication_id}-wallet",
                    "enable_smart_contract": True,
                    "penalty_for_late_payment": 0.5
                },
                "workflow_stages": self.WORKFLOW_STAGES,
                "performance_tracking": {
                    "current_stage": 0,
                    "stages_completed": 0,
                    "payments_received": 0,
                    "payments_pending": 0,
                    "documents_signed": 0,
                    "documents_pending": 0,
                    "compliance_checks_passed": 0,
                    "estimated_completion_date": funding_date,
                    "actual_completion_date": None
                }
>>>>>>> syndication-change
            }
            
            db.settlement_agents().insert_one(config)
            return config
        except Exception as e:
            logger.error(f"Error initializing settlement agent config: {e}")
            raise

    def confirm_allocations(self, state: SyndicationState) -> SyndicationState:
        """Step 1: Confirm allocations"""
        state["last_settlement_decision"] = self._execute_stage(state, self.WORKFLOW_STAGES[0])
        return state

    def distribute_documents(self, state: SyndicationState) -> SyndicationState:
        """Step 2: Distribute legal documents"""
        # Mapping to legal_documentation stage
        state["last_settlement_decision"] = self._execute_stage(state, self.WORKFLOW_STAGES[2])
        return state

    def verify_compliance(self, state: SyndicationState) -> SyndicationState:
        """Step 3: Verify compliance"""
        state["last_settlement_decision"] = self._execute_stage(state, self.WORKFLOW_STAGES[3])
        return state

    def collect_signatures(self, state: SyndicationState) -> SyndicationState:
        """Step 4: Collect signatures"""
        # In this simplified agent, signatures are collected during legal doc stage
        # We perform a verification here
        logger.info(f"[{self.agent_id}] Verifying signatures collected")
        
<<<<<<< HEAD
        db.settlement_agents().insert_one(config)
        return config
    
    def initialize_participant_tracking(self, state: SyndicationState) -> None:
        """Initialize per-participant status tracking"""
        allocation_doc = db.allocations().find_one({"syndication_id": self.syndication_id})
        if not allocation_doc:
            return
        
        for alloc in allocation_doc.get("allocations", []):
            participant_id = alloc["participant_agent_id"]
            self.participant_status[participant_id] = {
                "participant_id": participant_id,
                "institution_name": alloc["institution_name"],
                "allocation_amount": alloc["final_allocation"],
                "allocation_accepted": False,
                "commitment_letter_signed": False,
                "commitment_fee_paid": False,
                "arrangement_fee_paid": False,
                "kyc_verified": False,
                "ready_to_fund": False,
                "deadlines": {
                    "commitment_letter_deadline": (datetime.utcnow() + timedelta(hours=24)).isoformat(),
                    "commitment_fee_deadline": (datetime.utcnow() + timedelta(hours=COMMITMENT_FEE_DUE_HOURS)).isoformat()
                }
            }
        
        # Update database
        db.settlement_agents().update_one(
            {"_id": self.agent_id},
            {"$set": {"participant_statuses": self.participant_status}}
        )
    
=======
        # Check if actually signed (from previous stage logic)
        signed_count = db.settlement_agents().find_one({"_id": self.agent_id}).get("performance_tracking", {}).get("documents_signed", 0)
        state["documents_signed_count"] = signed_count
        
        return state

    def rollback_settlement(self, state: SyndicationState) -> SyndicationState:
        """Rollback settlement on failure"""
        logger.warning(f"[{self.agent_id}] Rolling back settlement")
        state["status"] = "settlement_failed"
        state["failure_reason"] = "Rollback triggered"
        
        # More thorough reset of state
        db.settlement_agents().update_one(
            {"_id": self.agent_id},
            {
                "$set": {
                    "status": "failed",
                    "performance_tracking.current_stage": 0,
                    "performance_tracking.stages_completed": 0,
                    "performance_tracking.payments_pending": 0,
                    "performance_tracking.documents_signed": 0
                }
            }
        )
        
        self._update_syndication(state)
        return state
>>>>>>> syndication-change
    def run_settlement(self, state: SyndicationState) -> SyndicationState:
        """Run the full settlement workflow with recovery support"""
        logger.info(f"[{self.agent_id}] Starting settlement for {self.syndication_id}")

        # Validate state fields
        state.setdefault("warnings", [])
        state.setdefault("errors", [])
        timeline = state.get("timeline", {})
        if not timeline:
            timeline = state["timeline"] = {}
        
        state["status"] = "settlement"
        state["settlement_agent_id"] = self.agent_id
        
        # Update funding date in timeline
        timeline["funding_date"] = self.config["settlement_config"]["funding_date"].isoformat()
        
        # Initialize participant tracking
        self.initialize_participant_tracking(state)
        
        for stage_config in self.WORKFLOW_STAGES:
            try:
                result = self._execute_stage(state, stage_config)
                
                if result.issues:
                    state["warnings"].extend(result.issues)
                
                # Check if stage failed critically
                if "critical_failure" in result.issues:
                    state["status"] = "settlement_failed"
                    state["failure_reason"] = f"Settlement failed at stage {stage_config['name']}"
                    state["failed_stage"] = stage_config['name']
                    state["failed_at"] = datetime.utcnow().isoformat()
                    
                    # Attempt rollback
                    self._rollback_settlement(state, stage_config["stage"])
                    
                    self._update_syndication(state)
                    return state
                    
            except Exception as e:
                logger.error(f"[{self.agent_id}] Stage {stage_config['name']} failed: {e}")
                state["status"] = "settlement_failed"
                state["failure_reason"] = str(e)
                state["failed_stage"] = stage_config['name']
                
                # Attempt rollback
                self._rollback_settlement(state, stage_config["stage"])
                
                self._update_syndication(state)
                return state
        
        # All stages complete
        state["status"] = "funding"
        self._update_syndication(state)
        
        # Update settlement agent
        db.settlement_agents().update_one(
            {"_id": self.agent_id},
            {
                "$set": {
                    "status": "completed",
                    "performance_tracking.actual_completion_date": datetime.utcnow()
                }
            }
        )
        
        logger.info(f"[{self.agent_id}] Settlement complete for {self.syndication_id}")
        return state
    
    def _rollback_settlement(self, state: SyndicationState, failed_stage: int) -> None:
        """Rollback settlement on failure - release capacity, notify participants"""
        logger.warning(f"[{self.agent_id}] Rolling back settlement from stage {failed_stage}")
        
        allocation_doc = db.allocations().find_one({"syndication_id": self.syndication_id})
        if not allocation_doc:
            return
        
        for alloc in allocation_doc.get("allocations", []):
            participant_id = alloc["participant_agent_id"]
            amount = alloc["final_allocation"]
            
            # Release participant capacity
            db.participant_agents().update_one(
                {"_id": participant_id},
                {
                    "$inc": {
                        "risk_appetite.available_capacity": amount,
                        "risk_appetite.current_deployed": -amount
                    }
                }
            )
            
            # Log the notification (in production: send email/webhook)
            logger.info(f"[{self.agent_id}] Notifying {participant_id} of settlement failure")
        
        # Update allocation status
        db.allocations().update_one(
            {"_id": allocation_doc["_id"]},
            {"$set": {"allocation_status": "rolled_back"}}
        )
        
        # Update settlement agent
        db.settlement_agents().update_one(
            {"_id": self.agent_id},
            {
                "$set": {
                    "status": "rolled_back",
                    "rolled_back_at": datetime.utcnow(),
                    "rolled_back_stage": failed_stage
                }
            }
        )
    
    def handle_participant_withdrawal(self, participant_id: str, reason: str = None) -> Dict[str, Any]:
        """Handle participant withdrawal with break fee logic"""
        allocation_doc = db.allocations().find_one({"syndication_id": self.syndication_id})
        if not allocation_doc:
            return {"error": "No allocations found"}
        
        # Find participant's allocation
        participant_alloc = None
        for alloc in allocation_doc.get("allocations", []):
            if alloc["participant_agent_id"] == participant_id:
                participant_alloc = alloc
                break
        
        if not participant_alloc:
            return {"error": "Participant allocation not found"}
        
        # Calculate break fee
        break_fee_pct = self.config["payment_schedule"]["break_fee_percentage"]
        break_fee = int(participant_alloc["final_allocation"] * break_fee_pct / 100)
        
        logger.warning(f"[{self.agent_id}] Participant {participant_id} withdrawing. Break fee: ${break_fee:,}")
        
        # Create break fee payment record
        payment_id = f"BREAK-{self.syndication_id.split('-')[-1]}-{participant_id.split('-')[-1]}"
        payment = {
            "_id": payment_id,
            "payment_agent_id": f"PAY-{self.syndication_id}",
            "syndication_id": self.syndication_id,
            "allocation_id": participant_alloc["_id"],
            "payer": {
                "participant_agent_id": participant_id,
                "institution_name": participant_alloc["institution_name"]
            },
            "payment_type": "break_fee",
            "amount_due": break_fee,
            "amount_paid": 0,
            "currency": self.config["payment_schedule"]["payment_currency"],
            "due_date": datetime.utcnow() + timedelta(hours=24),
            "payment_status": "pending",
            "reason": reason,
            "created_at": datetime.utcnow()
        }
        
        db.payment_history().insert_one(payment)
        
        # Update allocation status
        db.allocations().update_one(
            {"_id": allocation_doc["_id"], "allocations._id": participant_alloc["_id"]},
            {"$set": {"allocations.$.commitment_status": "withdrawn"}}
        )
        
        # Release capacity
        db.participant_agents().update_one(
            {"_id": participant_id},
            {
                "$inc": {
                    "risk_appetite.available_capacity": participant_alloc["final_allocation"],
                    "risk_appetite.current_deployed": -participant_alloc["final_allocation"]
                }
            }
        )
        
        return {
            "status": "withdrawal_processed",
            "participant_id": participant_id,
            "break_fee": break_fee,
            "break_fee_payment_id": payment_id
        }
    
    def _execute_stage(self, state: SyndicationState, 
                       stage_config: Dict[str, Any]) -> SettlementDecision:
        """Execute a single settlement stage"""
        stage_num = stage_config["stage"]
        stage_name = stage_config["name"]
        
        logger.info(f"[{self.agent_id}] Executing stage {stage_num}: {stage_name}")
        
        tasks_completed = []
        tasks_pending = []
        issues = []
        
        if stage_name == "allocation_confirmation":
            tasks_completed, tasks_pending, issues = self._stage_allocation_confirmation(state)
        elif stage_name == "payment_collection":
            tasks_completed, tasks_pending, issues = self._stage_payment_collection(state)
        elif stage_name == "legal_documentation":
            tasks_completed, tasks_pending, issues = self._stage_legal_documentation(state)
        elif stage_name == "compliance_verification":
            tasks_completed, tasks_pending, issues = self._stage_compliance_verification(state)
        elif stage_name == "final_funding":
            tasks_completed, tasks_pending, issues = self._stage_final_funding(state)
        
        # Update tracking
        db.settlement_agents().update_one(
            {"_id": self.agent_id},
            {
                "$set": {
                    "performance_tracking.current_stage": stage_num,
                    "performance_tracking.stages_completed": stage_num
                }
            }
        )
        
        # Define reasoning based on stage
        reasoning_map = {
            "allocation_confirmation": f"Verifying allocations for {len(tasks_completed)} participants. All commitment letters generated.",
            "payment_collection": f"Collecting commitment fees via x402. {len(tasks_pending)} payments pending.",
            "legal_documentation": "Distributing and tracking legal documents. Automated e-signature collection active.",
            "compliance_verification": "Performing KYC and sanctions screening on all participating institutions.",
            "final_funding": "Verifying 100% principal collection before escrow release to borrower."
        }
        
        return SettlementDecision(
            stage_completed=stage_num,
            stage_name=stage_name,
            next_stage=stage_num + 1,
            tasks_completed=tasks_completed,
            tasks_pending=tasks_pending,
            issues=issues,
<<<<<<< HEAD
            participants_ready=len([p for p in self.participant_status.values() if p.get("ready_to_fund")]),
            participants_pending=len([p for p in self.participant_status.values() if not p.get("ready_to_fund")])
=======
            reasoning=reasoning_map.get(stage_name, "")
>>>>>>> syndication-change
        )
    
    def _stage_allocation_confirmation(self, state: SyndicationState) -> Tuple[List, List, List]:
        """Stage 1: Confirm allocations with all participants"""
        completed = []
        pending = []
        issues = []
        
        allocation_doc = db.allocations().find_one({"syndication_id": self.syndication_id})
        if not allocation_doc:
            issues.append("critical_failure: No allocations found")
            return completed, pending, issues
        
        allocations = allocation_doc.get("allocations", [])
        if not allocations:
            issues.append("critical_failure: Empty allocations list")
            return completed, pending, issues
        
        total_allocated = sum(a["final_allocation"] for a in allocations)
        
        # Update percentages
        for alloc in allocations:
            alloc["allocation_percentage"] = round(
                alloc["final_allocation"] / total_allocated, 4
            ) if total_allocated > 0 else 0
            
            # Update participant status
            participant_id = alloc["participant_agent_id"]
            if participant_id in self.participant_status:
                self.participant_status[participant_id]["allocation_accepted"] = True
        
        db.allocations().update_one(
            {"_id": allocation_doc["_id"]},
            {"$set": {"allocations": allocations}}
        )
        completed.append("finalize_allocation_table")
        
        # Notify participants (log for now)
        for alloc in allocations:
            logger.info(f"[{self.agent_id}] Notifying {alloc['institution_name']} of allocation: ${alloc['final_allocation']:,}")
        completed.append("notify_all_participants")
        
        # Generate commitment letters
        completed.append("generate_commitment_letters")
        
        return completed, pending, issues
    
    def _stage_payment_collection(self, state: SyndicationState) -> Tuple[List, List, List]:
        """Stage 2: Create ALL payment records (commitment, arrangement, principal)"""
        completed = []
        pending = []
        issues = []
        
<<<<<<< HEAD
        allocation_doc = db.allocations().find_one({"syndication_id": self.syndication_id})
        if not allocation_doc:
            issues.append("No allocations found for payment creation")
            return completed, pending, issues
        
        now = datetime.utcnow()
        funding_date = self.config["settlement_config"]["funding_date"]
        
        payment_types = [
            {
                "type": "commitment_fee",
                "due_date": now + timedelta(hours=COMMITMENT_FEE_DUE_HOURS),
                "fee_key": "commitment_fee"
            },
            {
                "type": "arrangement_fee",
                "due_date": funding_date,
                "fee_key": "arrangement_fee"
            },
            {
                "type": "upfront_fee",
                "due_date": funding_date,
                "fee_key": "upfront_fee"
            }
        ]
        
        for alloc in allocation_doc.get("allocations", []):
            for payment_config in payment_types:
                payment_id = f"PAY-{self.syndication_id.split('-')[-1]}-{alloc['participant_agent_id'].split('-')[-1]}-{payment_config['type'][:4].upper()}"
                
                # Get fee amount
                fee_amount = alloc.get("fees", {}).get(payment_config["fee_key"], 0)
                if fee_amount == 0:
                    continue  # Skip if no fee
=======
        from pymongo import ReplaceOne
        bulk_payments = []
        
        # Calculate all fees
        allocation_doc = db.allocations().find_one({"syndication_id": self.syndication_id})
        if allocation_doc:
            originator_id = state.get("originator_agent_id") or self.config.get("originator_agent_id", "system")
            
            for alloc in allocation_doc.get("allocations", []):
                # Use safe ID generation to prevent collisions
                payment_id = f"PAYHIST-{self.syndication_id}-{alloc['_id']}"
>>>>>>> syndication-change
                
                payment = {
                    "_id": payment_id,
                    "payment_agent_id": f"PAY-{self.syndication_id}",
                    "syndication_id": self.syndication_id,
                    "allocation_id": alloc["_id"],
                    "payer": {
                        "participant_agent_id": alloc["participant_agent_id"],
                        "institution_name": alloc["institution_name"],
                        "wallet_address": f"participant-{alloc['participant_agent_id']}-wallet"
                    },
                    "recipient": {
                        "type": "originator",
                        "agent_id": originator_id,
                        "wallet_address": self.config["x402_payment_config"]["originator_wallet"]
                    },
                    "payment_type": payment_config["type"],
                    "amount_due": fee_amount,
                    "amount_paid": 0,
                    "currency": self.config["payment_schedule"]["payment_currency"],
                    "due_date": payment_config["due_date"],
                    "payment_status": "pending",
                    "created_at": now,
                    "retry_count": 0
                }
                
                bulk_payments.append(
                    ReplaceOne({"_id": payment_id}, payment, upsert=True)
                )
<<<<<<< HEAD
                pending.append(f"{payment_config['type']}_{alloc['participant_agent_id']}")
=======
                pending.append(f"commitment_fee_{alloc['participant_agent_id']}")
            
            if bulk_payments:
                db.payment_history().bulk_write(bulk_payments)
>>>>>>> syndication-change
        
        completed.append("calculate_all_fees")
        completed.append("create_payment_records")
        completed.append("send_payment_instructions")
        
        # Track pending payments
        db.settlement_agents().update_one(
            {"_id": self.agent_id},
            {"$set": {"performance_tracking.payments_pending": len(pending)}}
        )
        
        return completed, pending, issues
    
    def _stage_legal_documentation(self, state: SyndicationState) -> Tuple[List, List, List]:
        """Stage 3: Distribute and collect legal documents"""
        completed = ["distribute_loan_documents"]
        pending = []
        issues = []
        
<<<<<<< HEAD
        allocation_doc = db.allocations().find_one({"syndication_id": self.syndication_id})
        if allocation_doc:
            now = datetime.utcnow()
            for alloc in allocation_doc.get("allocations", []):
                # Update commitment letter as signed
                db.allocations().update_one(
                    {"_id": allocation_doc["_id"], "allocations._id": alloc["_id"]},
                    {
                        "$set": {
                            "allocations.$.commitment_letter_signed": True,
                            "allocations.$.commitment_letter_signed_at": now,
                            "allocations.$.commitment_status": "confirmed"
=======
        # Simulated document signing (In production, this would be an async hook)
        allocation_doc = db.allocations().find_one({"syndication_id": self.syndication_id})
        if allocation_doc:
            from pymongo import UpdateOne
            bulk_docs = []
            
            for alloc in allocation_doc.get("allocations", []):
                bulk_docs.append(
                    UpdateOne(
                        {"_id": allocation_doc["_id"], "allocations._id": alloc["_id"]},
                        {
                            "$set": {
                                "allocations.$.commitment_letter_signed": True,
                                "allocations.$.commitment_status": "confirmed"
                            }
>>>>>>> syndication-change
                        }
                    )
                )
                
                # Update participant status
                participant_id = alloc["participant_agent_id"]
                if participant_id in self.participant_status:
                    self.participant_status[participant_id]["commitment_letter_signed"] = True
            
            if bulk_docs:
                db.allocations().bulk_write(bulk_docs)
            
            completed.append("collect_e_signatures")
            completed.append("verify_legal_opinions")
            
            db.settlement_agents().update_one(
                {"_id": self.agent_id},
                {
                    "$set": {
                        "performance_tracking.documents_signed": len(allocation_doc.get("allocations", [])),
                        "participant_statuses": self.participant_status
                    }
                }
            )
        
        return completed, pending, issues
    
    def _stage_compliance_verification(self, state: SyndicationState) -> Tuple[List, List, List]:
        """Stage 4: KYC and compliance checks"""
        completed = []
        pending = []
        issues = []
        
        # Simulated compliance checks
        completed.extend(["kyc_checks", "sanctions_screening", "regulatory_reporting"])
        
        allocation_doc = db.allocations().find_one({"syndication_id": self.syndication_id})
        if allocation_doc:
            for alloc in allocation_doc.get("allocations", []):
                participant_id = alloc["participant_agent_id"]
                if participant_id in self.participant_status:
                    self.participant_status[participant_id]["kyc_verified"] = True
            
            db.settlement_agents().update_one(
                {"_id": self.agent_id},
                {
                    "$set": {
                        "performance_tracking.compliance_checks_passed": len(allocation_doc.get("allocations", [])),
                        "participant_statuses": self.participant_status
                    }
                }
            )
        
        return completed, pending, issues
    
    def _stage_final_funding(self, state: SyndicationState) -> Tuple[List, List, List]:
        """Stage 5: Release escrow and wire to borrower"""
        completed = []
        pending = []
        issues = []
        
        # Check if all payments received
        pending_records = list(db.payment_history().find({
            "syndication_id": self.syndication_id,
            "payment_status": {"$in": ["pending", "processing"]}
        }))
        
        if pending_records:
            payer_names = ", ".join([p.get("payer", {}).get("institution_name", "Unknown") for p in pending_records])
            issues.append(f"{len(pending_records)} payments still pending from: {payer_names}")
            pending.append(f"wait_for_payments_{len(pending_records)}")
        else:
            completed.extend([
                "verify_all_payments_received",
                "release_escrow_funds",
                "wire_proceeds_to_borrower",
                "send_confirmation_notices"
            ])
            
            # Mark all participants as ready to fund
            for participant_id in self.participant_status:
                self.participant_status[participant_id]["ready_to_fund"] = True
            
            # Mark allocation as funded
            db.allocations().update_one(
                {"syndication_id": self.syndication_id},
                {"$set": {"allocation_status": "funded"}}
            )
            
            db.settlement_agents().update_one(
                {"_id": self.agent_id},
                {"$set": {"participant_statuses": self.participant_status}}
            )
        
        return completed, pending, issues
    
    def check_deadlines(self) -> List[Dict[str, Any]]:
        """Check for deadline breaches and return list of overdue items"""
        overdue = []
        now = datetime.utcnow()
        
        for participant_id, status in self.participant_status.items():
            deadlines = status.get("deadlines", {})
            
            # Check commitment letter deadline
            if not status.get("commitment_letter_signed"):
                deadline_str = deadlines.get("commitment_letter_deadline")
                if deadline_str:
                    deadline = datetime.fromisoformat(deadline_str)
                    if now > deadline:
                        overdue.append({
                            "participant_id": participant_id,
                            "type": "commitment_letter",
                            "deadline": deadline_str,
                            "hours_overdue": (now - deadline).total_seconds() / 3600
                        })
            
            # Check commitment fee deadline
            if not status.get("commitment_fee_paid"):
                deadline_str = deadlines.get("commitment_fee_deadline")
                if deadline_str:
                    deadline = datetime.fromisoformat(deadline_str)
                    if now > deadline:
                        overdue.append({
                            "participant_id": participant_id,
                            "type": "commitment_fee",
                            "deadline": deadline_str,
                            "hours_overdue": (now - deadline).total_seconds() / 3600
                        })
        
        return overdue
    
    def _update_syndication(self, state: SyndicationState) -> None:
        """Update syndication in MongoDB"""
        state["updated_at"] = datetime.utcnow().isoformat()
        
        update_fields = {
            "status": state["status"],
            "timeline": state["timeline"],
            "settlement_agent_id": state["settlement_agent_id"],
            "updated_at": state["updated_at"]
        }
        
        if state.get("failure_reason"):
            update_fields["failure_reason"] = state["failure_reason"]
        if state.get("failed_stage"):
            update_fields["failed_stage"] = state["failed_stage"]
        if state.get("failed_at"):
            update_fields["failed_at"] = state["failed_at"]
        
        db.syndications().update_one(
            {"_id": self.syndication_id},
            {"$set": update_fields}
        )
    
    def get_participant_progress(self) -> Dict[str, Any]:
        """Get summary of participant progress through settlement"""
        if not self.participant_status:
            # Load from database
            config = db.settlement_agents().find_one({"_id": self.agent_id})
            if config:
                self.participant_status = config.get("participant_statuses", {})
        
        total = len(self.participant_status)
        if total == 0:
            return {"total": 0}
        
        return {
            "total": total,
            "allocation_accepted": len([p for p in self.participant_status.values() if p.get("allocation_accepted")]),
            "commitment_letter_signed": len([p for p in self.participant_status.values() if p.get("commitment_letter_signed")]),
            "commitment_fee_paid": len([p for p in self.participant_status.values() if p.get("commitment_fee_paid")]),
            "arrangement_fee_paid": len([p for p in self.participant_status.values() if p.get("arrangement_fee_paid")]),
            "kyc_verified": len([p for p in self.participant_status.values() if p.get("kyc_verified")]),
            "ready_to_fund": len([p for p in self.participant_status.values() if p.get("ready_to_fund")])
        }
