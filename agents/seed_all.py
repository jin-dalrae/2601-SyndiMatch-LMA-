"""
SyndiMatch - Comprehensive Database Seed Script
Seeds all collections with realistic agent and syndication data
"""

import sys
sys.path.append('.')

from datetime import datetime, timedelta
import random
from pymongo import MongoClient
from dotenv import load_dotenv
import os

load_dotenv()

# Connect to MongoDB
client = MongoClient(os.getenv("MONGODB_URI"))
db = client["syndimatch"]


def seed_originator_agents():
    """Seed originator agents (major banks)"""
    originators = [
        {"_id": "OA-001", "entity": "JPMorgan Chase", "headquarters": "New York, NY", "status": "active", "active_loans": 2, "success_rate": 94, "total_fees_ytd": 0},
        {"_id": "OA-002", "entity": "Bank of America", "headquarters": "Charlotte, NC", "status": "active", "active_loans": 1, "success_rate": 96, "total_fees_ytd": 0},
        {"_id": "OA-003", "entity": "Citigroup", "headquarters": "New York, NY", "status": "active", "active_loans": 2, "success_rate": 91, "total_fees_ytd": 0},
        {"_id": "OA-004", "entity": "Goldman Sachs", "headquarters": "New York, NY", "status": "active", "active_loans": 0, "success_rate": 92, "total_fees_ytd": 0},
        {"_id": "OA-005", "entity": "Wells Fargo", "headquarters": "San Francisco, CA", "status": "active", "active_loans": 1, "success_rate": 88, "total_fees_ytd": 0},
        {"_id": "OA-006", "entity": "BNP Paribas", "headquarters": "Paris, France", "status": "active", "active_loans": 1, "success_rate": 93, "total_fees_ytd": 0},
        {"_id": "OA-007", "entity": "Barclays", "headquarters": "London, UK", "status": "active", "active_loans": 0, "success_rate": 90, "total_fees_ytd": 0},
        {"_id": "OA-008", "entity": "MUFG Bank", "headquarters": "Tokyo, Japan", "status": "active", "active_loans": 1, "success_rate": 95, "total_fees_ytd": 0}
    ]
    
    db.originator_agents.delete_many({})
    db.originator_agents.insert_many(originators)
    print(f"✅ Seeded {len(originators)} originator agents")


def seed_participant_agents():
    """Seed diverse participant agents"""
    # Base participants
    participants = [
        # MAJOR (5)
        {
            "_id": "PA-001", "tier": "major",
            "institution": {"name": "Apollo Global Management", "type": "Private Credit Fund", "headquarters": "New York, NY"},
            "risk_appetite": {"total_capital_available": 2500000000, "max_single_ticket": 300000000, "min_ticket": 25000000, "credit_rating_range": {"min": "B-", "max": "BBB+", "sweet_spot": "BB to BB+"}, "target_all_in_yield": 10.5, "min_acceptable_yield": 8.0},
            "sector_preferences": {"preferred": ["Technology", "Healthcare", "Business Services"], "neutral": ["Industrial", "Consumer"], "avoid": ["Oil & Gas", "Retail"]},
            "strategy": {"investment_style": "aggressive", "bidding_behavior": "fast_decisive", "spread_sensitivity": "low"},
            "decision_making": {"speed": "very_fast", "autonomy_level": "very_high", "typical_response_time_hours": 2},
            "performance_history": {"bids_submitted_ytd": 247, "allocations_won": 89, "win_rate": 0.36, "average_spread_paid": 420, "payments_on_time": 247, "on_time_rate": 1.0},
            "status": "active"
        },
        {
            "_id": "PA-002", "tier": "major",
            "institution": {"name": "CalPERS", "type": "Public Pension Fund", "headquarters": "Sacramento, CA"},
            "risk_appetite": {"total_capital_available": 3000000000, "max_single_ticket": 400000000, "min_ticket": 50000000, "credit_rating_range": {"min": "A-", "max": "AAA", "sweet_spot": "A to AA"}, "target_all_in_yield": 5.5, "min_acceptable_yield": 4.0},
            "sector_preferences": {"preferred": ["Infrastructure", "Utilities", "Healthcare"], "neutral": ["Industrial"], "avoid": ["Cannabis", "Weapons", "Tobacco"]},
            "strategy": {"investment_style": "conservative", "bidding_behavior": "methodical_selective", "spread_sensitivity": "moderate"},
            "constraints": {"esg_requirements": True, "min_esg_score": 75},
            "decision_making": {"speed": "slow", "autonomy_level": "low", "typical_response_time_hours": 48},
            "performance_history": {"bids_submitted_ytd": 67, "allocations_won": 49, "win_rate": 0.73, "average_spread_paid": 285, "payments_on_time": 67, "on_time_rate": 1.0},
            "status": "active"
        },
        {
            "_id": "PA-003", "tier": "major",
            "institution": {"name": "BNP Paribas Asset Management", "type": "European Bank", "headquarters": "Paris, France"},
            "risk_appetite": {"total_capital_available": 4000000000, "max_single_ticket": 500000000, "min_ticket": 30000000, "credit_rating_range": {"min": "BBB-", "max": "AAA", "sweet_spot": "BBB+ to A"}, "target_all_in_yield": 5.0, "min_acceptable_yield": 3.8},
            "sector_preferences": {"preferred": ["Renewable Energy", "Infrastructure", "Industrial"], "neutral": ["Healthcare", "Consumer"], "avoid": ["Coal", "Weapons"]},
            "strategy": {"investment_style": "moderate", "bidding_behavior": "relationship_price_conscious", "spread_sensitivity": "moderate"},
            "constraints": {"esg_requirements": True, "min_esg_score": 70},
            "decision_making": {"speed": "moderate", "autonomy_level": "moderate", "typical_response_time_hours": 18},
            "performance_history": {"bids_submitted_ytd": 134, "allocations_won": 98, "win_rate": 0.73, "average_spread_paid": 320, "payments_on_time": 134, "on_time_rate": 1.0},
            "status": "active"
        },
        {
            "_id": "PA-004", "tier": "major",
            "institution": {"name": "MUFG Bank", "type": "Japanese Bank", "headquarters": "Tokyo, Japan"},
            "risk_appetite": {"total_capital_available": 5000000000, "max_single_ticket": 600000000, "min_ticket": 75000000, "credit_rating_range": {"min": "BBB", "max": "AAA", "sweet_spot": "A- to AA"}, "target_all_in_yield": 4.5, "min_acceptable_yield": 3.5},
            "sector_preferences": {"preferred": ["Infrastructure", "Project Finance", "Utilities"], "neutral": ["Industrial", "TMT"], "avoid": ["Speculative Tech", "Crypto"]},
            "strategy": {"investment_style": "conservative", "bidding_behavior": "patient_relationship_focused", "spread_sensitivity": "high"},
            "decision_making": {"speed": "very_slow", "autonomy_level": "low", "typical_response_time_hours": 72},
            "performance_history": {"bids_submitted_ytd": 112, "allocations_won": 96, "win_rate": 0.86, "average_spread_paid": 245, "payments_on_time": 112, "on_time_rate": 1.0},
            "status": "active"
        },
        {
            "_id": "PA-005", "tier": "major",
            "institution": {"name": "Palmer Square Capital", "type": "CLO Manager", "headquarters": "Kansas City, MO"},
            "risk_appetite": {"total_capital_available": 1200000000, "max_single_ticket": 75000000, "min_ticket": 5000000, "credit_rating_range": {"min": "B-", "max": "BBB-", "sweet_spot": "B+ to BB"}, "target_all_in_yield": 8.5, "min_acceptable_yield": 7.0},
            "sector_preferences": {"preferred": ["Business Services", "Healthcare", "Technology"], "neutral": ["Consumer", "Media"], "avoid": ["Oil & Gas", "Airlines"]},
            "strategy": {"investment_style": "moderate", "bidding_behavior": "competitive_fast", "spread_sensitivity": "low"},
            "decision_making": {"speed": "very_fast", "autonomy_level": "very_high", "typical_response_time_hours": 1},
            "performance_history": {"bids_submitted_ytd": 892, "allocations_won": 250, "win_rate": 0.28, "average_spread_paid": 445, "payments_on_time": 889, "on_time_rate": 0.997},
            "status": "active"
        },
        
        # MINOR (10)
        {"_id": "PA-101", "tier": "minor", "institution": {"name": "PNC Bank", "type": "US Regional Bank", "headquarters": "Pittsburgh, PA"}, "risk_appetite": {"total_capital_available": 800000000, "max_single_ticket": 100000000, "min_ticket": 15000000}, "strategy": {"investment_style": "moderate", "bidding_behavior": "relationship_price_conscious"}, "status": "active"},
        {"_id": "PA-102", "tier": "minor", "institution": {"name": "Ares Management", "type": "Private Credit Fund", "headquarters": "Los Angeles, CA"}, "risk_appetite": {"total_capital_available": 1100000000, "max_single_ticket": 200000000, "min_ticket": 20000000}, "strategy": {"investment_style": "aggressive", "bidding_behavior": "fast_decisive"}, "status": "active"},
        {"_id": "PA-103", "tier": "minor", "institution": {"name": "MetLife Investment Management", "type": "Insurance Company", "headquarters": "New York, NY"}, "risk_appetite": {"total_capital_available": 1500000000, "max_single_ticket": 250000000, "min_ticket": 40000000}, "strategy": {"investment_style": "conservative", "bidding_behavior": "methodical_selective"}, "status": "active"},
        {"_id": "PA-104", "tier": "minor", "institution": {"name": "Golub Capital", "type": "BDC", "headquarters": "New York, NY"}, "risk_appetite": {"total_capital_available": 700000000, "max_single_ticket": 80000000, "min_ticket": 10000000}, "strategy": {"investment_style": "moderate", "bidding_behavior": "competitive_fast"}, "status": "active"},
        {"_id": "PA-105", "tier": "minor", "institution": {"name": "Davidson Kempner", "type": "Hedge Fund - Distressed", "headquarters": "New York, NY"}, "risk_appetite": {"total_capital_available": 600000000, "max_single_ticket": 100000000, "min_ticket": 15000000}, "strategy": {"investment_style": "very_aggressive", "bidding_behavior": "opportunistic"}, "status": "active"},
        {"_id": "PA-106", "tier": "minor", "institution": {"name": "KeyBank", "type": "US Regional Bank", "headquarters": "Cleveland, OH"}, "risk_appetite": {"total_capital_available": 650000000, "max_single_ticket": 80000000, "min_ticket": 15000000}, "strategy": {"investment_style": "moderate", "bidding_behavior": "relationship_price_conscious"}, "status": "active"},
        {"_id": "PA-107", "tier": "minor", "institution": {"name": "Blue Owl Capital", "type": "Private Credit Fund", "headquarters": "New York, NY"}, "risk_appetite": {"total_capital_available": 950000000, "max_single_ticket": 150000000, "min_ticket": 25000000}, "strategy": {"investment_style": "aggressive", "bidding_behavior": "fast_decisive"}, "status": "active"},
        {"_id": "PA-108", "tier": "minor", "institution": {"name": "Ontario Teachers' Pension", "type": "Pension Fund", "headquarters": "Toronto, Canada"}, "risk_appetite": {"total_capital_available": 2200000000, "max_single_ticket": 350000000, "min_ticket": 50000000}, "strategy": {"investment_style": "conservative", "bidding_behavior": "methodical_selective"}, "status": "active"},
        {"_id": "PA-109", "tier": "minor", "institution": {"name": "Barings LLC", "type": "CLO Manager", "headquarters": "Charlotte, NC"}, "risk_appetite": {"total_capital_available": 850000000, "max_single_ticket": 60000000, "min_ticket": 5000000}, "strategy": {"investment_style": "moderate", "bidding_behavior": "competitive_fast"}, "status": "active"},
        {"_id": "PA-110", "tier": "minor", "institution": {"name": "Prudential Investment Management", "type": "Insurance Company", "headquarters": "Newark, NJ"}, "risk_appetite": {"total_capital_available": 1800000000, "max_single_ticket": 300000000, "min_ticket": 50000000}, "strategy": {"investment_style": "conservative", "bidding_behavior": "methodical_selective"}, "status": "active"}
    ]
    
    # Process and randomize deployment
    for p in participants:
        total = p["risk_appetite"]["total_capital_available"]
        # Randomize current deployment between 40-80%
        deployed = int(total * random.uniform(0.4, 0.8))
        p["risk_appetite"]["current_deployed"] = deployed
        p["risk_appetite"]["available_capacity"] = total - deployed
        
        # Default credit ratings if missing
        if "credit_rating_range" not in p["risk_appetite"]:
            p["risk_appetite"]["credit_rating_range"] = {"min": "B", "max": "A", "sweet_spot": "BB to BBB"}
            p["risk_appetite"]["target_all_in_yield"] = 6.5
            p["risk_appetite"]["min_acceptable_yield"] = 5.0
            
        # Default sector preferences if missing
        if "sector_preferences" not in p:
            p["sector_preferences"] = {"preferred": ["Industrial", "Consumer"], "neutral": ["Healthcare"], "avoid": ["Speculative"]}

    db.participant_agents.delete_many({})
    db.participant_agents.insert_many(participants)
    print(f"✅ Seeded {len(participants)} participant agents with randomized deployment")


def seed_demo_syndications():
    """Seed sample syndications in various states with relative dates"""
    now = datetime.utcnow()
    
    syndications = [
        {
            "_id": "SYND-2025-001",
            "syndication_id": "SYND-2025-001",
            "originator_agent_id": "OA-001",
            "originator": "JPMorgan Chase",
            "status": "negotiating",
            "loan_details": {
                "borrower_name": "TechFlow Solutions",
                "industry": "Technology",
                "loan_type": "Leveraged Buyout",
                "credit_rating": "BB+",
                "total_amount": 500000000,
                "currency": "USD",
                "originator_hold": 100000000,
                "syndication_target": 400000000
            },
            "pricing": {"base_rate": "SOFR", "initial_spread": 450, "commitment_fee": 0.5},
            "timeline": {
                "broadcast_date": (now - timedelta(hours=24)).isoformat(),
                "target_close_date": (now + timedelta(hours=24)).isoformat()
            },
            "current_round": 3,
            "current_spread": 420,
            "total_committed": 370000000,
            "subscription_rate": 0.925,
            "bids": [],
            "allocations": [],
            "auction_history": [],
            "created_at": (now - timedelta(hours=24)).isoformat(),
            "updated_at": now.isoformat()
        },
        {
            "_id": "SYND-2025-002",
            "syndication_id": "SYND-2025-002",
            "originator_agent_id": "OA-002",
            "originator": "Bank of America",
            "status": "settlement",
            "loan_details": {
                "borrower_name": "Atlas Manufacturing",
                "industry": "Industrial",
                "loan_type": "Corporate Refinancing",
                "credit_rating": "BBB-",
                "total_amount": 350000000,
                "currency": "USD",
                "originator_hold": 70000000,
                "syndication_target": 280000000
            },
            "pricing": {"base_rate": "SOFR", "initial_spread": 385, "commitment_fee": 0.5},
            "timeline": {
                "broadcast_date": (now - timedelta(days=5)).isoformat(),
                "target_close_date": (now - timedelta(days=2)).isoformat(),
                "funding_date": (now + timedelta(days=3)).isoformat()
            },
            "current_round": 5,
            "current_spread": 385,
            "total_committed": 280000000,
            "subscription_rate": 1.0,
            "created_at": (now - timedelta(days=5)).isoformat(),
            "updated_at": now.isoformat()
        },
        {
            "_id": "SYND-2025-003",
            "syndication_id": "SYND-2025-003",
            "originator_agent_id": "OA-003",
            "originator": "Citigroup",
            "status": "open",
            "loan_details": {
                "borrower_name": "Meridian Healthcare Group",
                "industry": "Healthcare",
                "loan_type": "Acquisition Finance",
                "credit_rating": "BB",
                "total_amount": 275000000,
                "currency": "USD",
                "originator_hold": 55000000,
                "syndication_target": 220000000
            },
            "pricing": {"base_rate": "SOFR", "initial_spread": 450, "commitment_fee": 0.5},
            "timeline": {
                "broadcast_date": now.isoformat(),
                "target_close_date": (now + timedelta(hours=48)).isoformat()
            },
            "current_round": 0,
            "current_spread": 450,
            "total_committed": 0,
            "subscription_rate": 0.0,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }
    ]
    
    db.syndications.delete_many({})
    db.syndications.insert_many(syndications)
    print(f"✅ Seeded {len(syndications)} demo syndications with relative dates")


def main():
    print("\n🌱 Seeding SyndiMatch Database...\n")
    
    seed_originator_agents()
    seed_participant_agents()
    seed_demo_syndications()
    
    print("\n🎉 Database seeding complete!\n")
    
    # Print summary and sample data
    print("Collections summary:")
    print(f"  • originator_agents: {db.originator_agents.count_documents({})}")
    print(f"  • participant_agents: {db.participant_agents.count_documents({})}")
    print(f"  • syndications: {db.syndications.count_documents({})}")
    
    print("\nSample records:")
    sample_o = db.originator_agents.find_one()
    if sample_o:
        print(f"  • Originator: {sample_o['entity']} ({sample_o['_id']})")
    
    sample_p = db.participant_agents.find_one()
    if sample_p:
        print(f"  • Participant: {sample_p['institution']['name']} (Deployed: {sample_p['risk_appetite']['current_deployed']:,})")
    
    sample_s = db.syndications.find_one()
    if sample_s:
        print(f"  • Syndication: {sample_s['loan_details']['borrower_name']} (Status: {sample_s['status']})")


if __name__ == "__main__":
    main()
