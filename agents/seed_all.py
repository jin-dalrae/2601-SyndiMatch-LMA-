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
    """Seed 35 diverse participant agents"""
    participants = [
        # MAJOR (5)
        {
            "_id": "PA-001", "tier": "major",
            "institution": {"name": "Apollo Global Management", "type": "Private Credit Fund", "headquarters": "New York, NY"},
            "risk_appetite": {"total_capital_available": 2500000000, "current_deployed": 1800000000, "available_capacity": 700000000, "max_single_ticket": 300000000, "min_ticket": 25000000, "credit_rating_range": {"min": "B-", "max": "BBB+", "sweet_spot": "BB to BB+"}, "target_all_in_yield": 10.5, "min_acceptable_yield": 8.0},
            "sector_preferences": {"preferred": ["Technology", "Healthcare", "Business Services"], "neutral": ["Industrial", "Consumer"], "avoid": ["Oil & Gas", "Retail"]},
            "strategy": {"investment_style": "aggressive", "bidding_behavior": "fast_decisive", "spread_sensitivity": "low"},
            "decision_making": {"speed": "very_fast", "autonomy_level": "very_high", "typical_response_time_hours": 2},
            "performance_history": {"bids_submitted_ytd": 247, "allocations_won": 89, "win_rate": 0.36, "average_spread_paid": 420, "payments_on_time": 247, "on_time_rate": 1.0},
            "status": "active"
        },
        {
            "_id": "PA-002", "tier": "major",
            "institution": {"name": "CalPERS", "type": "Public Pension Fund", "headquarters": "Sacramento, CA"},
            "risk_appetite": {"total_capital_available": 3000000000, "current_deployed": 2100000000, "available_capacity": 900000000, "max_single_ticket": 400000000, "min_ticket": 50000000, "credit_rating_range": {"min": "A-", "max": "AAA", "sweet_spot": "A to AA"}, "target_all_in_yield": 5.5, "min_acceptable_yield": 4.0},
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
            "risk_appetite": {"total_capital_available": 4000000000, "current_deployed": 2900000000, "available_capacity": 1100000000, "max_single_ticket": 500000000, "min_ticket": 30000000, "credit_rating_range": {"min": "BBB-", "max": "AAA", "sweet_spot": "BBB+ to A"}, "target_all_in_yield": 5.0, "min_acceptable_yield": 3.8},
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
            "risk_appetite": {"total_capital_available": 5000000000, "current_deployed": 3200000000, "available_capacity": 1800000000, "max_single_ticket": 600000000, "min_ticket": 75000000, "credit_rating_range": {"min": "BBB", "max": "AAA", "sweet_spot": "A- to AA"}, "target_all_in_yield": 4.5, "min_acceptable_yield": 3.5},
            "sector_preferences": {"preferred": ["Infrastructure", "Project Finance", "Utilities"], "neutral": ["Industrial", "TMT"], "avoid": ["Speculative Tech", "Crypto"]},
            "strategy": {"investment_style": "conservative", "bidding_behavior": "patient_relationship_focused", "spread_sensitivity": "high"},
            "decision_making": {"speed": "very_slow", "autonomy_level": "low", "typical_response_time_hours": 72},
            "performance_history": {"bids_submitted_ytd": 112, "allocations_won": 96, "win_rate": 0.86, "average_spread_paid": 245, "payments_on_time": 112, "on_time_rate": 1.0},
            "status": "active"
        },
        {
            "_id": "PA-005", "tier": "major",
            "institution": {"name": "Palmer Square Capital", "type": "CLO Manager", "headquarters": "Kansas City, MO"},
            "risk_appetite": {"total_capital_available": 1200000000, "current_deployed": 900000000, "available_capacity": 300000000, "max_single_ticket": 75000000, "min_ticket": 5000000, "credit_rating_range": {"min": "B-", "max": "BBB-", "sweet_spot": "B+ to BB"}, "target_all_in_yield": 8.5, "min_acceptable_yield": 7.0},
            "sector_preferences": {"preferred": ["Business Services", "Healthcare", "Technology"], "neutral": ["Consumer", "Media"], "avoid": ["Oil & Gas", "Airlines"]},
            "strategy": {"investment_style": "moderate", "bidding_behavior": "competitive_fast", "spread_sensitivity": "low"},
            "decision_making": {"speed": "very_fast", "autonomy_level": "very_high", "typical_response_time_hours": 1},
            "performance_history": {"bids_submitted_ytd": 892, "allocations_won": 250, "win_rate": 0.28, "average_spread_paid": 445, "payments_on_time": 889, "on_time_rate": 0.997},
            "status": "active"
        },
        
        # MINOR (10 of 30 for demo)
        {"_id": "PA-101", "tier": "minor", "institution": {"name": "PNC Bank", "type": "US Regional Bank", "headquarters": "Pittsburgh, PA"}, "risk_appetite": {"total_capital_available": 800000000, "current_deployed": 580000000, "available_capacity": 220000000, "max_single_ticket": 100000000, "min_ticket": 15000000, "credit_rating_range": {"min": "BBB-", "max": "A+", "sweet_spot": "BBB to A-"}, "target_all_in_yield": 5.8, "min_acceptable_yield": 4.5}, "strategy": {"investment_style": "moderate", "bidding_behavior": "relationship_price_conscious"}, "performance_history": {"bids_submitted_ytd": 89, "allocations_won": 40, "win_rate": 0.45, "average_spread_paid": 365}, "status": "active"},
        {"_id": "PA-102", "tier": "minor", "institution": {"name": "Ares Management", "type": "Private Credit Fund", "headquarters": "Los Angeles, CA"}, "risk_appetite": {"total_capital_available": 1100000000, "current_deployed": 780000000, "available_capacity": 320000000, "max_single_ticket": 200000000, "min_ticket": 20000000, "credit_rating_range": {"min": "B", "max": "BB+", "sweet_spot": "B+ to BB"}, "target_all_in_yield": 11.0, "min_acceptable_yield": 9.0}, "strategy": {"investment_style": "aggressive", "bidding_behavior": "fast_decisive"}, "performance_history": {"bids_submitted_ytd": 198, "allocations_won": 81, "win_rate": 0.41, "average_spread_paid": 475}, "status": "active"},
        {"_id": "PA-103", "tier": "minor", "institution": {"name": "MetLife Investment Management", "type": "Insurance Company", "headquarters": "New York, NY"}, "risk_appetite": {"total_capital_available": 1500000000, "current_deployed": 1200000000, "available_capacity": 300000000, "max_single_ticket": 250000000, "min_ticket": 40000000, "credit_rating_range": {"min": "A-", "max": "AAA", "sweet_spot": "A to AA"}, "target_all_in_yield": 4.8, "min_acceptable_yield": 3.8}, "strategy": {"investment_style": "conservative", "bidding_behavior": "methodical_selective"}, "constraints": {"esg_requirements": True, "min_esg_score": 72}, "performance_history": {"bids_submitted_ytd": 156, "allocations_won": 81, "win_rate": 0.52, "average_spread_paid": 295}, "status": "active"},
        {"_id": "PA-104", "tier": "minor", "institution": {"name": "Golub Capital", "type": "BDC", "headquarters": "New York, NY"}, "risk_appetite": {"total_capital_available": 700000000, "current_deployed": 520000000, "available_capacity": 180000000, "max_single_ticket": 80000000, "min_ticket": 10000000, "credit_rating_range": {"min": "B", "max": "BB+", "sweet_spot": "B+ to BB"}, "target_all_in_yield": 10.0, "min_acceptable_yield": 8.5}, "strategy": {"investment_style": "moderate", "bidding_behavior": "competitive_fast"}, "performance_history": {"bids_submitted_ytd": 245, "allocations_won": 88, "win_rate": 0.36, "average_spread_paid": 435}, "status": "active"},
        {"_id": "PA-105", "tier": "minor", "institution": {"name": "Davidson Kempner", "type": "Hedge Fund - Distressed", "headquarters": "New York, NY"}, "risk_appetite": {"total_capital_available": 600000000, "current_deployed": 380000000, "available_capacity": 220000000, "max_single_ticket": 100000000, "min_ticket": 15000000, "credit_rating_range": {"min": "CCC", "max": "BB-", "sweet_spot": "CCC+ to B"}, "target_all_in_yield": 16.0, "min_acceptable_yield": 12.0}, "strategy": {"investment_style": "very_aggressive", "bidding_behavior": "opportunistic"}, "performance_history": {"bids_submitted_ytd": 42, "allocations_won": 18, "win_rate": 0.43, "average_spread_paid": 680}, "status": "active"},
        {"_id": "PA-106", "tier": "minor", "institution": {"name": "KeyBank", "type": "US Regional Bank", "headquarters": "Cleveland, OH"}, "risk_appetite": {"total_capital_available": 650000000, "current_deployed": 480000000, "available_capacity": 170000000, "max_single_ticket": 80000000, "min_ticket": 15000000, "credit_rating_range": {"min": "BBB-", "max": "A", "sweet_spot": "BBB"}, "target_all_in_yield": 5.5, "min_acceptable_yield": 4.2}, "strategy": {"investment_style": "moderate", "bidding_behavior": "relationship_price_conscious"}, "performance_history": {"bids_submitted_ytd": 76, "allocations_won": 32, "win_rate": 0.42, "average_spread_paid": 375}, "status": "active"},
        {"_id": "PA-107", "tier": "minor", "institution": {"name": "Blue Owl Capital", "type": "Private Credit Fund", "headquarters": "New York, NY"}, "risk_appetite": {"total_capital_available": 950000000, "current_deployed": 700000000, "available_capacity": 250000000, "max_single_ticket": 150000000, "min_ticket": 25000000, "credit_rating_range": {"min": "B+", "max": "BB+", "sweet_spot": "BB"}, "target_all_in_yield": 9.5, "min_acceptable_yield": 8.0}, "strategy": {"investment_style": "aggressive", "bidding_behavior": "fast_decisive"}, "performance_history": {"bids_submitted_ytd": 165, "allocations_won": 62, "win_rate": 0.38, "average_spread_paid": 455}, "status": "active"},
        {"_id": "PA-108", "tier": "minor", "institution": {"name": "Ontario Teachers' Pension", "type": "Pension Fund", "headquarters": "Toronto, Canada"}, "risk_appetite": {"total_capital_available": 2200000000, "current_deployed": 1650000000, "available_capacity": 550000000, "max_single_ticket": 350000000, "min_ticket": 50000000, "credit_rating_range": {"min": "A-", "max": "AAA", "sweet_spot": "A to AA"}, "target_all_in_yield": 5.2, "min_acceptable_yield": 4.0}, "strategy": {"investment_style": "conservative", "bidding_behavior": "methodical_selective"}, "constraints": {"esg_requirements": True, "min_esg_score": 78}, "performance_history": {"bids_submitted_ytd": 58, "allocations_won": 41, "win_rate": 0.71, "average_spread_paid": 275}, "status": "active"},
        {"_id": "PA-109", "tier": "minor", "institution": {"name": "Barings LLC", "type": "CLO Manager", "headquarters": "Charlotte, NC"}, "risk_appetite": {"total_capital_available": 850000000, "current_deployed": 620000000, "available_capacity": 230000000, "max_single_ticket": 60000000, "min_ticket": 5000000, "credit_rating_range": {"min": "B-", "max": "BB+", "sweet_spot": "B to BB-"}, "target_all_in_yield": 8.2, "min_acceptable_yield": 7.0}, "strategy": {"investment_style": "moderate", "bidding_behavior": "competitive_fast"}, "performance_history": {"bids_submitted_ytd": 678, "allocations_won": 195, "win_rate": 0.29, "average_spread_paid": 450}, "status": "active"},
        {"_id": "PA-110", "tier": "minor", "institution": {"name": "Prudential Investment Management", "type": "Insurance Company", "headquarters": "Newark, NJ"}, "risk_appetite": {"total_capital_available": 1800000000, "current_deployed": 1400000000, "available_capacity": 400000000, "max_single_ticket": 300000000, "min_ticket": 50000000, "credit_rating_range": {"min": "A-", "max": "AAA", "sweet_spot": "A to AA"}, "target_all_in_yield": 4.5, "min_acceptable_yield": 3.5}, "strategy": {"investment_style": "conservative", "bidding_behavior": "methodical_selective"}, "constraints": {"esg_requirements": True, "min_esg_score": 70}, "performance_history": {"bids_submitted_ytd": 142, "allocations_won": 78, "win_rate": 0.55, "average_spread_paid": 280}, "status": "active"}
    ]
    
    db.participant_agents.delete_many({})
    db.participant_agents.insert_many(participants)
    print(f"✅ Seeded {len(participants)} participant agents")


def seed_demo_syndications():
    """Seed sample syndications in various states"""
    # Anchor date: Jan 1, 2023
    now = datetime(2023, 1, 1, 9, 0, 0)
    
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
    print(f"✅ Seeded {len(syndications)} demo syndications")


def main():
    print("\n🌱 Seeding SyndiMatch Database...\n")
    
    seed_originator_agents()
    seed_participant_agents()
    seed_demo_syndications()
    
    print("\n🎉 Database seeding complete!\n")
    
    # Print summary
    print("Collections summary:")
    print(f"  • originator_agents: {db.originator_agents.count_documents({})}")
    print(f"  • participant_agents: {db.participant_agents.count_documents({})}")
    print(f"  • syndications: {db.syndications.count_documents({})}")


if __name__ == "__main__":
    main()
