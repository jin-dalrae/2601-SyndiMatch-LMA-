"""
SyndiMatch - Settlement Agent
Manages post-auction settlement workflow
"""

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import logging

from .state import SyndicationState, SettlementDecision
from .config import COMMITMENT_FEE_DUE_HOURS
import db

logger = logging.getLogger(__name__)


class SettlementAgent:
    """
    Agent that manages post-auction settlement process.
    Responsible for:
    - Confirming allocations with participants
    - Collecting commitment letters and signatures
    - Coordinating payment collection via PaymentAgent
    - Compliance verification
    - Final funding
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
    
    def _load_or_create_config(self) -> Dict[str, Any]:
        """Load existing config or create new settlement agent config"""
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
    def run_settlement(self, state: SyndicationState) -> SyndicationState:
        """
        Run the full settlement workflow through all stages.
        """
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
        
        for stage_config in self.WORKFLOW_STAGES:
            result = self._execute_stage(state, stage_config)
            
            if result.issues:
                state["warnings"].extend(result.issues)
            
            # Check if stage failed critically
            if "critical_failure" in result.issues:
                state["status"] = "settlement_failed"
                state["errors"].append(f"Settlement failed at stage {stage_config['name']}")
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
            next_stage=stage_num + 1,
            tasks_completed=tasks_completed,
            tasks_pending=tasks_pending,
            issues=issues,
            reasoning=reasoning_map.get(stage_name, "")
        )
    
    def _stage_allocation_confirmation(self, state: SyndicationState) -> tuple:
        """Stage 1: Confirm allocations with all participants"""
        completed = []
        pending = []
        issues = []
        
        # Finalize allocation table
        allocation_doc = db.allocations().find_one({"syndication_id": self.syndication_id})
        if allocation_doc:
            total_allocated = sum(a["final_allocation"] for a in allocation_doc.get("allocations", []))
            
            # Update percentages
            for alloc in allocation_doc.get("allocations", []):
                alloc["allocation_percentage"] = round(
                    alloc["final_allocation"] / total_allocated, 4
                ) if total_allocated > 0 else 0
            
            db.allocations().update_one(
                {"_id": allocation_doc["_id"]},
                {"$set": {"allocations": allocation_doc["allocations"]}}
            )
            completed.append("finalize_allocation_table")
        
        # Notify participants
        completed.append("notify_all_participants")
        
        # Generate commitment letters (simulated)
        completed.append("generate_commitment_letters")
        
        return completed, pending, issues
    
    def _stage_payment_collection(self, state: SyndicationState) -> tuple:
        """Stage 2: Collection commitment fees"""
        completed = []
        pending = []
        issues = []
        
        from pymongo import ReplaceOne
        bulk_payments = []
        
        # Calculate all fees
        allocation_doc = db.allocations().find_one({"syndication_id": self.syndication_id})
        if allocation_doc:
            originator_id = state.get("originator_agent_id") or self.config.get("originator_agent_id", "system")
            
            for alloc in allocation_doc.get("allocations", []):
                # Use safe ID generation to prevent collisions
                payment_id = f"PAYHIST-{self.syndication_id}-{alloc['_id']}"
                
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
                    "payment_type": "commitment_fee",
                    "amount_due": alloc["fees"]["commitment_fee"],
                    "amount_paid": 0,
                    "currency": self.config["payment_schedule"]["payment_currency"],
                    "due_date": datetime.utcnow() + timedelta(hours=COMMITMENT_FEE_DUE_HOURS),
                    "payment_status": "pending",
                    "created_at": datetime.utcnow()
                }
                
                bulk_payments.append(
                    ReplaceOne({"_id": payment_id}, payment, upsert=True)
                )
                pending.append(f"commitment_fee_{alloc['participant_agent_id']}")
            
            if bulk_payments:
                db.payment_history().bulk_write(bulk_payments)
        
        completed.append("calculate_all_fees")
        completed.append("send_payment_instructions")
        
        # Track pending payments
        db.settlement_agents().update_one(
            {"_id": self.agent_id},
            {"$set": {"performance_tracking.payments_pending": len(pending)}}
        )
        
        return completed, pending, issues
    
    def _stage_legal_documentation(self, state: SyndicationState) -> tuple:
        """Stage 3: Distribute and collect legal documents"""
        completed = ["distribute_loan_documents"]
        pending = []
        issues = []
        
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
                        }
                    )
                )
            
            if bulk_docs:
                db.allocations().bulk_write(bulk_docs)
            
            completed.append("collect_e_signatures")
            completed.append("verify_legal_opinions")
            
            db.settlement_agents().update_one(
                {"_id": self.agent_id},
                {"$set": {"performance_tracking.documents_signed": len(allocation_doc.get("allocations", []))}}
            )
        
        return completed, pending, issues
    
    def _stage_compliance_verification(self, state: SyndicationState) -> tuple:
        """Stage 4: KYC and compliance checks"""
        completed = []
        pending = []
        issues = []
        
        # Simulated compliance checks
        completed.extend(["kyc_checks", "sanctions_screening", "regulatory_reporting"])
        
        allocation_doc = db.allocations().find_one({"syndication_id": self.syndication_id})
        if allocation_doc:
            db.settlement_agents().update_one(
                {"_id": self.agent_id},
                {"$set": {"performance_tracking.compliance_checks_passed": len(allocation_doc.get("allocations", []))}}
            )
        
        return completed, pending, issues
    
    def _stage_final_funding(self, state: SyndicationState) -> tuple:
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
                "release_escrow_funds",
                "wire_proceeds_to_borrower",
                "send_confirmation_notices"
            ])
            
            # Mark allocation as funded
            db.allocations().update_one(
                {"syndication_id": self.syndication_id},
                {"$set": {"allocation_status": "funded"}}
            )
        
        return completed, pending, issues
    
    def _update_syndication(self, state: SyndicationState) -> None:
        """Update syndication in MongoDB"""
        state["updated_at"] = datetime.utcnow().isoformat()
        db.syndications().update_one(
            {"_id": self.syndication_id},
            {"$set": {
                "status": state["status"],
                "timeline": state["timeline"],
                "settlement_agent_id": state["settlement_agent_id"],
                "updated_at": state["updated_at"]
            }}
        )
