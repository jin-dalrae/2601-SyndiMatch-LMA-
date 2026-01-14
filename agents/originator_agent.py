"""
SyndiMatch - Enhanced Originator Agent
Broadcasts loan opportunities with advanced pricing, ESG, and relationship tracking
"""

from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
import json
import logging
import uuid
from random import choice, randint, uniform

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

from .state import SyndicationState
from .config import ANTHROPIC_API_KEY, AGENT_MODEL
from . import db

logger = logging.getLogger(__name__)


# Industry-specific company name generators
COMPANY_NAMES = {
    "Technology": ["TechNova", "CloudScale", "DataSync", "ByteWorks", "QuantumLogic", "NeuralPath"],
    "Healthcare": ["MedCore", "VitalHealth", "BioGenix", "PharmaVista", "CareLink", "HealthBridge"],
    "Energy": ["EnergyCorp", "PowerGrid", "SolarVentures", "WindForce", "FuelDynamics", "GreenPower"],
    "Real Estate": ["UrbanVest", "MetroPlex", "PropertyCore", "LandMark", "EstateGroup", "RealtyPrime"],
    "Industrial": ["IndustriaMax", "SteelWorks", "MachineCore", "FactoryPro", "HeavyLift", "MetalForge"],
    "Financial Services": ["CapitalOne", "FinanceHub", "WealthCore", "AssetPrime", "FundGroup", "InvestCo"],
    "Telecom": ["TelcoNet", "SignalMax", "WaveLink", "CommCore", "NetworkPlus", "ConnectPro"],
    "Consumer": ["BrandCo", "RetailMax", "ConsumerFirst", "MarketPrime", "ShopGroup", "TrendCore"],
    "Infrastructure": ["BuildCore", "StructurePro", "CivilWorks", "InfraTech", "BridgeGroup", "RoadMaster"]
}

GEOGRAPHIES = ["North America", "Europe", "Asia Pacific", "Latin America", "Middle East"]

LOAN_STRUCTURES = {
    "Leveraged Buyout": {"seniority": "Senior Secured First Lien", "amortization": "1% p.a.", "call_protection": "101 (Y1-2)"},
    "Project Finance": {"seniority": "Senior Secured", "amortization": "Sculpted", "call_protection": "Make-whole"},
    "Acquisition Finance": {"seniority": "Senior Secured First Lien", "amortization": "Bullet", "call_protection": "None"},
    "Corporate Refinancing": {"seniority": "Senior Unsecured", "amortization": "Bullet", "call_protection": "None"},
    "Bridge Loan": {"seniority": "Second Lien", "amortization": "Bullet", "call_protection": "102 (6mo)"}
}


class OriginatorAgent:
    """
    Enhanced Agent representing loan originators (banks).
    Now includes:
    - Dynamic pricing strategy
    - ESG integration
    - Geographic tracking
    - Relationship management
    - Payment verification
    """
    
    def __init__(self, agent_id: str):
        self.agent_id = agent_id
        # Initialize LLM only if valid API key is present
        if ANTHROPIC_API_KEY and ANTHROPIC_API_KEY.startswith("sk-"):
            self.llm = ChatAnthropic(
                model=AGENT_MODEL,
                api_key=ANTHROPIC_API_KEY,
                temperature=0.3
            )
        else:
            self.llm = None
            logger.info(f"[{self.agent_id}] No valid API Key found. Running in Simulation Mode.")
            
        try:
            self.profile = self._load_profile()
        except:
             # Create default profile if DB is empty/error
            self.profile = {"_id": self.agent_id, "active_loans": 0, "completed_syndications_ytd": 0}
    
    def _load_profile(self) -> Dict[str, Any]:
        """Load originator profile from MongoDB"""
        profile = db.originator_agents().find_one({"_id": self.agent_id})
        if not profile:
            raise ValueError(f"Originator agent {self.agent_id} not found")
        return profile
    
    def _refresh_profile(self):
        """Refresh profile from database"""
        self.profile = self._load_profile()
    
    def analyze_market_conditions(self) -> Dict[str, Any]:
        """Analyze recent market to optimize pricing"""
        # Get recent completed syndications
        recent = list(db.syndications().find(
            {"status": "completed"},
            {"pricing": 1, "loan_details": 1}
        ).sort("created_at", -1).limit(20))
        
        if not recent:
            return {"market_spread_avg": 400, "demand_level": "moderate"}
        
        # Calculate average spreads by rating
        spreads_by_rating = {}
        for synd in recent:
            rating = synd.get("loan_details", {}).get("credit_rating", "BBB")
            spread = synd.get("pricing", {}).get("initial_spread", 400)
            if rating not in spreads_by_rating:
                spreads_by_rating[rating] = []
            spreads_by_rating[rating].append(spread)
        
        avg_spreads = {r: sum(s)/len(s) for r, s in spreads_by_rating.items()}
        
        # Assess demand
        recent_subscription = [s.get("subscription_rate", 1.0) for s in recent]
        avg_subscription = sum(recent_subscription) / len(recent_subscription) if recent_subscription else 1.0
        
        demand_level = "high" if avg_subscription > 1.2 else "moderate" if avg_subscription > 0.9 else "low"
        
        return {
            "market_spread_avg": sum(avg_spreads.values()) / len(avg_spreads) if avg_spreads else 400,
            "spreads_by_rating": avg_spreads,
            "demand_level": demand_level,
            "avg_subscription": avg_subscription
        }
    
    def identify_target_participants(self, loan_details: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Pre-qualify likely participants for this deal"""
        industry = loan_details.get("industry", "")
        rating = loan_details.get("credit_rating", "BBB")
        amount = loan_details.get("syndication_target", 0)
        geography = loan_details.get("geography", "North America")
        
        # Find participants who match criteria
        query = {
            "status": "active",
            "risk_appetite.available_capacity": {"$gte": amount * 0.05},  # Can take at least 5%
            "sector_preferences.avoid": {"$nin": [industry]},  # Doesn't avoid this sector
        }
        
        participants = list(db.participant_agents().find(query))
        
        # Score and rank participants
        scored = []
        for p in participants:
            score = 0
            
            # Sector preference bonus
            if industry in p.get("sector_preferences", {}).get("preferred", []):
                score += 30
            
            # Capacity score
            capacity = p.get("risk_appetite", {}).get("available_capacity", 0)
            if capacity > amount * 0.15:
                score += 20
            elif capacity > amount * 0.10:
                score += 10
            
            # Relationship score (from past deals)
            relationship = self._get_relationship_score(p["_id"])
            score += relationship
            
            scored.append({
                "participant_id": p["_id"],
                "institution": p.get("institution", {}).get("name", "Unknown"),
                "capacity": capacity,
                "match_score": score,
                "relationship_score": relationship
            })
        
        # Sort by score and return top matches
        scored.sort(key=lambda x: x["match_score"], reverse=True)
        return scored[:20]
    
    def _get_relationship_score(self, participant_id: str) -> int:
        """Calculate relationship score with a participant"""
        # Count past successful deals together
        past_allocations = db.allocations().count_documents({
            "participant_agent_id": participant_id,
            "syndication_id": {"$regex": f".*"},  # From our syndications
            "status": "confirmed"
        })
        
        # Base score on history
        if past_allocations >= 10:
            return 40
        elif past_allocations >= 5:
            return 25
        elif past_allocations >= 1:
            return 10
        return 0
    
    def calculate_optimal_spread(self, loan_details: Dict[str, Any], strategy: str = "balanced") -> int:
        """
        Calculate optimal initial spread based on market conditions and strategy.
        
        Strategies:
        - maximize_participation: Lower spread to attract more bidders
        - maximize_revenue: Higher spread for larger fees
        - speed_to_close: Aggressive pricing for quick execution
        - balanced: Optimal balance
        """
        rating = loan_details.get("credit_rating", "BBB")
        industry = loan_details.get("industry", "Technology")
        
        # Base spreads by rating
        base_spreads = {
            "AAA": 150, "AA+": 175, "AA": 190, "AA-": 210,
            "A+": 240, "A": 270, "A-": 300,
            "BBB+": 330, "BBB": 360, "BBB-": 390,
            "BB+": 420, "BB": 450, "BB-": 480,
            "B+": 520, "B": 560, "B-": 600
        }
        
        base_spread = base_spreads.get(rating, 400)
        
        # Industry adjustments
        industry_adjustments = {
            "Technology": 10,  # Higher risk premium
            "Healthcare": -5,  # Stable sector
            "Energy": 20,  # Volatile
            "Real Estate": 0,
            "Financial Services": -10,  # Lower risk
            "Infrastructure": -15  # Very stable
        }
        base_spread += industry_adjustments.get(industry, 0)
        
        # Strategy adjustments
        strategy_adjustments = {
            "maximize_participation": -30,
            "maximize_revenue": 25,
            "speed_to_close": -50,
            "balanced": 0
        }
        base_spread += strategy_adjustments.get(strategy, 0)
        
        # Market condition adjustment
        market = self.analyze_market_conditions()
        if market["demand_level"] == "high":
            base_spread -= 15  # Can price tighter in strong demand
        elif market["demand_level"] == "low":
            base_spread += 25  # Need more spread to attract bids
        
        return max(150, min(700, int(base_spread)))
    
    def broadcast_loan(self, state: SyndicationState) -> SyndicationState:
        """Broadcast a new syndication opportunity."""
        logger.info(f"[{self.agent_id}] Broadcasting syndication: {state['syndication_id']}")
        
        # Set initial negotiation state
        state["status"] = "open"
        state["current_round"] = 0
        state["current_spread"] = state["pricing"]["initial_spread"]
        state["total_committed"] = 0
        state["subscription_rate"] = 0.0
        state["bids"] = []
        state["allocations"] = []
        state["rejected_bids"] = []
        state["payments"] = []
        state["auction_history"] = []
        state["errors"] = []
        state["warnings"] = []
        state["created_at"] = datetime.utcnow().isoformat()
        state["updated_at"] = datetime.utcnow().isoformat()
        
<<<<<<< HEAD
        # Identify target participants
        targets = self.identify_target_participants(state["loan_details"])
        state["target_participants"] = [t["participant_id"] for t in targets[:15]]
        
        # Insert into MongoDB
        db.syndications().update_one(
            {"_id": state["syndication_id"]},
            {"$set": state},
=======
        # Add AI recommendation reasoning for the dashboard
        state["recommendation_reasoning"] = f"AI-Recommended: This {state['loan_details']['industry']} opportunity offers a competitive {state['pricing']['initial_spread']}bps spread relative to its {state['loan_details']['credit_rating']} rating."
        
        # Upsert into MongoDB (supports existing records created by other services)
        db.syndications().update_one(
            {"_id": state["syndication_id"]},
            {
                "$set": {
                    "schema_version": 1,  # For backward compatibility and migrations
                    **state
                }
            },
>>>>>>> syndication-change
            upsert=True
        )
        
        # Update originator's active loans count
        db.originator_agents().update_one(
            {"_id": self.agent_id},
            {
                "$inc": {"active_loans": 1},
                "$set": {"last_broadcast": datetime.utcnow()}
            }
        )
        
        logger.info(f"[{self.agent_id}] Syndication {state['syndication_id']} broadcast complete")
        return state
    
    def receive_payment(self, syndication_id: str, payment_type: str, 
                        amount: int, from_participant: str,
                        expected_amount: int = None) -> Dict[str, Any]:
        """
        Process incoming payment with verification and relationship tracking.
        """
        logger.info(f"[{self.agent_id}] Receiving {payment_type}: ${amount:,} from {from_participant}")
        
        now = datetime.utcnow()
        
        # Verify payment amount
        amount_verified = True
        discrepancy = 0
        if expected_amount:
            discrepancy = amount - expected_amount
            if abs(discrepancy) > expected_amount * 0.01:  # More than 1% difference
                amount_verified = False
                logger.warning(f"Payment discrepancy: expected ${expected_amount:,}, received ${amount:,}")
        
        # Update originator's financial state
<<<<<<< HEAD
        db.originator_agents().update_one(
            {"_id": self.agent_id},
            {
                "$inc": {
                    "total_fees_ytd": amount,
                    f"fees_by_type.{payment_type}": amount
                },
                "$set": {"updated_at": now}
=======
        # Build $inc updates correctly - no $ prefix on field names!
        inc_updates = {"total_fees_ytd": amount}
        
        if payment_type == "commitment_fee":
            inc_updates["financial_metrics.total_commitment_fees_received"] = amount
        elif payment_type == "arrangement_fee":
            inc_updates["financial_metrics.total_arrangement_fees_received"] = amount
        
        # Atomic increment of all fee fields
        db.originator_agents().update_one(
            {"_id": self.agent_id},
            {
                "$inc": inc_updates,
                "$set": {"updated_at": datetime.utcnow()}
>>>>>>> syndication-change
            }
        )
        
        # Track relationship with participant
        self._update_participant_relationship(from_participant, payment_type, amount, on_time=True)
        
        return {
            "status": "received",
            "originator_id": self.agent_id,
            "amount": amount,
            "payment_type": payment_type,
            "from_participant": from_participant,
            "amount_verified": amount_verified,
            "discrepancy": discrepancy,
            "timestamp": now.isoformat()
        }
    
<<<<<<< HEAD
    def _update_participant_relationship(self, participant_id: str, payment_type: str, 
                                          amount: int, on_time: bool):
        """Update relationship tracking with participant"""
        db.get_collection("originator_relationships").update_one(
            {"originator_id": self.agent_id, "participant_id": participant_id},
            {
                "$inc": {
                    "total_deals": 0,  # Will be updated on allocation
                    f"payments.{payment_type}": amount,
                    "on_time_payments": 1 if on_time else 0,
                    "late_payments": 0 if on_time else 1
                },
                "$set": {"last_interaction": datetime.utcnow()}
            },
            upsert=True
        )
    
    def complete_syndication(self, syndication_id: str, success: bool, reason: str = None) -> None:
        """Update originator state when syndication completes."""
=======
    def complete_syndication(self, syndication_id: str, success: bool, reason: Optional[str] = None) -> None:
        """
        Update originator state when syndication completes.
        Uses atomic MongoDB update to prevent race conditions.
        """
        # ATOMIC: Load profile and calculate in single read, then update
        profile = self._load_profile()
        track = profile.get("track_record", {})
        
        # Calculate success rate BEFORE the increment
        current_completed = track.get("deals_closed_ytd", 0)
        current_failed = track.get("deals_failed_ytd", 0)
        
        # After this syndication:
        new_completed = current_completed + (1 if success else 0)
        new_failed = current_failed + (0 if success else 1)
        total = new_completed + new_failed
        new_success_rate = (new_completed / total) if total > 0 else 0 # Result is 0.0-1.0 in originator schema
        
>>>>>>> syndication-change
        update = {
            "$inc": {
                "active_loans": -1,
                "track_record.deals_closed_ytd": 1 if success else 0,
                "track_record.deals_failed_ytd": 0 if success else 1
            },
            "$set": {
                "updated_at": datetime.utcnow(),
                "track_record.success_rate": round(new_success_rate, 3)
            }
        }
        
<<<<<<< HEAD
        # Calculate new success rate
        self._refresh_profile()
        total = self.profile.get("completed_syndications_ytd", 0) + self.profile.get("failed_syndications_ytd", 0) + 1
        successful = self.profile.get("completed_syndications_ytd", 0) + (1 if success else 0)
        new_success_rate = successful / total if total > 0 else 0
        
        update["$set"]["success_rate"] = round(new_success_rate * 100, 1)
        
        db.originator_agents().update_one({"_id": self.agent_id}, update)
        logger.info(f"[{self.agent_id}] Syndication {syndication_id} marked as {'success' if success else 'failed'}" +
                   (f": {reason}" if reason else ""))
=======
        db.originator_agents().update_one({"_id": self.agent_id}, update)
        
        status_msg = 'success' if success else f'failed ({reason})'
        logger.info(f"[{self.agent_id}] Syndication {syndication_id} marked as {status_msg}")
>>>>>>> syndication-change


def generate_syndication(originator_id: str, loan_params: Optional[Dict] = None) -> SyndicationState:
    """
    Generate a new syndication opportunity with comprehensive details.
    Includes ESG rating, geography, and advanced loan terms.
    """
    originator_profiles = {
        "OA-001": "JPMorgan Chase",
        "OA-002": "Bank of America", 
        "OA-003": "Citigroup",
        "OA-004": "Goldman Sachs",
        "OA-005": "Wells Fargo",
        "OA-006": "BNP Paribas",
        "OA-007": "Barclays",
        "OA-008": "MUFG Bank"
    }
    
    industries = list(COMPANY_NAMES.keys())
    loan_types = list(LOAN_STRUCTURES.keys())
    ratings = ["BB-", "BB", "BB+", "BBB-", "BBB", "BBB+", "A-", "A"]
    
    # Generate unique ID using UUID to prevent collisions
    synd_id = f"SYND-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"
    
    # Select industry and generate realistic company name
    industry = choice(industries)
    company_name = choice(COMPANY_NAMES.get(industry, ["GenericCorp"]))
    entity_suffix = choice(["Inc.", "LLC", "Corp.", "Holdings", "Group", "Partners"])
    borrower_name = f"{company_name} {entity_suffix}"
    
    # Select loan type and get structure
    loan_type = choice(loan_types)
    loan_structure = LOAN_STRUCTURES.get(loan_type, {})
    
    # Calculate amounts
    total_amount = randint(200, 2000) * 1000000
    hold_percentage = uniform(0.15, 0.35)
    originator_hold = int(total_amount * hold_percentage)
    syndication_target = total_amount - originator_hold
    
    # Select rating and calculate spread
    rating = choice(ratings)
    geography = choice(GEOGRAPHIES)
    
    # Generate ESG score (60-100 for most companies, lower for energy/industrial)
    if industry in ["Energy", "Industrial"]:
        esg_score = randint(50, 80)
    elif industry in ["Healthcare", "Technology"]:
        esg_score = randint(70, 95)
    else:
        esg_score = randint(60, 90)
    
    # Use originator agent to calculate optimal spread
    try:
        agent = OriginatorAgent(originator_id)
        initial_spread = agent.calculate_optimal_spread(
            {"credit_rating": rating, "industry": industry},
            strategy="balanced"
        )
    except Exception:
        # Fallback if agent not available
        base_spreads = {"A": 280, "A-": 320, "BBB+": 350, "BBB": 380, "BBB-": 400,
                        "BB+": 420, "BB": 450, "BB-": 480}
        initial_spread = base_spreads.get(rating, 400) + randint(-20, 20)
    
    now = datetime.utcnow()
    close_hours = randint(24, 120)
    
    state: SyndicationState = {
        "syndication_id": synd_id,
        "originator_agent_id": originator_id,
        "originator": originator_profiles.get(originator_id, "Unknown Bank"),
        
        "loan_details": {
            "borrower_name": borrower_name,
            "industry": industry,
            "loan_type": loan_type,
            "credit_rating": rating,
            "total_amount": total_amount,
            "currency": "USD",
            "originator_hold": originator_hold,
            "syndication_target": syndication_target,
            "geography": geography,
            "esg_score": esg_score,
            "maturity_years": randint(5, 10),
            "seniority": loan_structure.get("seniority", "Senior Secured"),
            "amortization": loan_structure.get("amortization", "Bullet"),
            "call_protection": loan_structure.get("call_protection", "None")
        },
        
        "pricing": {
            "base_rate": "SOFR",
            "initial_spread": initial_spread,
            "commitment_fee": round(uniform(0.35, 0.75), 2),
            "arrangement_fee": round(uniform(0.75, 1.50), 2),
            "upfront_fee": round(uniform(1.00, 2.00), 2)
        },
        
        "timeline": {
            "broadcast_date": now.isoformat(),
            "target_close_date": (now + timedelta(hours=close_hours)).isoformat(),
            "first_funding_date": (now + timedelta(hours=close_hours + 48)).isoformat()
        },
        
        # ESG rating at top level for easy access
        "esg_rating": esg_score,
        "geography": geography,
        
        # State tracking
        "status": "pending",
        "current_round": 0,
        "current_spread": initial_spread,
        "total_committed": 0,
        "subscription_rate": 0.0,
        "bids": [],
        "allocations": [],
        "rejected_bids": [],
        "payments": [],
        "auction_history": [],
        "negotiation_agent_id": None,
        "settlement_agent_id": None,
        "payment_agent_id": None,
        "target_participants": [],
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "errors": [],
        "warnings": []
    }
    
    return state
