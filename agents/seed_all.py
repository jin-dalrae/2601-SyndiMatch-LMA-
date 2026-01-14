"""
SyndiMatch - Enhanced Comprehensive Database Seed Script
Seeds all collections with realistic agent and syndication data
Including ESG ratings, geography, demo bids, and allocations
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

# Current date for demo (use 2025)
NOW = datetime.utcnow()


def seed_originator_agents():
    """Seed originator agents (major banks) with full profiles"""
    originators = [
        {
            "_id": "OA-001",
            "institution": {
                "name": "JPMorgan Chase",
                "division": "Corporate & Investment Bank",
                "headquarters": "New York, NY",
                "global_rank": 1,
                "market_share": 0.145
            },
            "entity": "JPMorgan Chase",  # Legacy field
            "headquarters": "New York, NY",
            "origination_capability": {
                "typical_deal_size": {"min": 100000000, "max": 5000000000},
                "industries": ["Technology", "Healthcare", "Industrial", "Consumer", "Energy"],
                "geographies": ["North America", "Europe", "Asia Pacific"]
            },
            "syndication_strategy": {
                "hold_percentage_range": {"min": 0.15, "max": 0.35},
                "preferred_participants": ["PA-002", "PA-003", "PA-004"],
                "pricing_style": "competitive"
            },
            "track_record": {
                "completed_syndications_ytd": 47,
                "failed_syndications_ytd": 3,
                "total_volume_ytd": 28500000000,
                "average_oversubscription": 1.23
            },
            "status": "active",
            "active_loans": 2,
            "success_rate": 94,
            "total_fees_ytd": 0,
            "fees_by_type": {}
        },
        {
            "_id": "OA-002",
            "institution": {"name": "Bank of America", "division": "Global Corporate & Investment Banking", "headquarters": "Charlotte, NC", "global_rank": 2, "market_share": 0.118},
            "entity": "Bank of America",
            "headquarters": "Charlotte, NC",
            "origination_capability": {"typical_deal_size": {"min": 75000000, "max": 3000000000}, "industries": ["Industrial", "Utilities", "Real Estate", "Healthcare"], "geographies": ["North America", "Europe"]},
            "syndication_strategy": {"hold_percentage_range": {"min": 0.20, "max": 0.40}, "preferred_participants": ["PA-001", "PA-005"], "pricing_style": "relationship_focused"},
            "track_record": {"completed_syndications_ytd": 42, "failed_syndications_ytd": 2, "total_volume_ytd": 22100000000, "average_oversubscription": 1.18},
            "status": "active", "active_loans": 1, "success_rate": 96, "total_fees_ytd": 0, "fees_by_type": {}
        },
        {
            "_id": "OA-003",
            "institution": {"name": "Citigroup", "division": "Corporate & Investment Banking", "headquarters": "New York, NY", "global_rank": 3, "market_share": 0.098},
            "entity": "Citigroup",
            "headquarters": "New York, NY",
            "origination_capability": {"typical_deal_size": {"min": 100000000, "max": 4000000000}, "industries": ["Technology", "Telecom", "Financial Services"], "geographies": ["North America", "Europe", "Asia Pacific", "Latin America"]},
            "syndication_strategy": {"hold_percentage_range": {"min": 0.15, "max": 0.30}, "preferred_participants": ["PA-003", "PA-004"], "pricing_style": "aggressive"},
            "track_record": {"completed_syndications_ytd": 38, "failed_syndications_ytd": 4, "total_volume_ytd": 19800000000, "average_oversubscription": 1.15},
            "status": "active", "active_loans": 2, "success_rate": 91, "total_fees_ytd": 0, "fees_by_type": {}
        },
        {
            "_id": "OA-004",
            "institution": {"name": "Goldman Sachs", "division": "Investment Banking", "headquarters": "New York, NY", "global_rank": 4, "market_share": 0.087},
            "entity": "Goldman Sachs",
            "headquarters": "New York, NY",
            "origination_capability": {"typical_deal_size": {"min": 200000000, "max": 10000000000}, "industries": ["Technology", "Healthcare", "Financial Services", "Energy"], "geographies": ["North America", "Europe", "Asia Pacific"]},
            "syndication_strategy": {"hold_percentage_range": {"min": 0.10, "max": 0.25}, "preferred_participants": ["PA-001", "PA-002"], "pricing_style": "premium"},
            "track_record": {"completed_syndications_ytd": 35, "failed_syndications_ytd": 3, "total_volume_ytd": 32500000000, "average_oversubscription": 1.35},
            "status": "active", "active_loans": 0, "success_rate": 92, "total_fees_ytd": 0, "fees_by_type": {}
        },
        {
            "_id": "OA-005",
            "institution": {"name": "Wells Fargo", "division": "Corporate & Investment Banking", "headquarters": "San Francisco, CA", "global_rank": 5, "market_share": 0.072},
            "entity": "Wells Fargo",
            "headquarters": "San Francisco, CA",
            "origination_capability": {"typical_deal_size": {"min": 50000000, "max": 2000000000}, "industries": ["Real Estate", "Industrial", "Utilities", "Agriculture"], "geographies": ["North America"]},
            "syndication_strategy": {"hold_percentage_range": {"min": 0.25, "max": 0.45}, "preferred_participants": ["PA-101", "PA-106"], "pricing_style": "relationship_focused"},
            "track_record": {"completed_syndications_ytd": 52, "failed_syndications_ytd": 7, "total_volume_ytd": 15200000000, "average_oversubscription": 1.08},
            "status": "active", "active_loans": 1, "success_rate": 88, "total_fees_ytd": 0, "fees_by_type": {}
        },
        {
            "_id": "OA-006",
            "institution": {"name": "BNP Paribas", "division": "Corporate & Institutional Banking", "headquarters": "Paris, France", "global_rank": 6, "market_share": 0.065},
            "entity": "BNP Paribas",
            "headquarters": "Paris, France",
            "origination_capability": {"typical_deal_size": {"min": 100000000, "max": 3000000000}, "industries": ["Industrial", "Infrastructure", "Renewable Energy", "Utilities"], "geographies": ["Europe", "North America", "Middle East"]},
            "syndication_strategy": {"hold_percentage_range": {"min": 0.20, "max": 0.35}, "preferred_participants": ["PA-003", "PA-108"], "pricing_style": "relationship_focused"},
            "track_record": {"completed_syndications_ytd": 41, "failed_syndications_ytd": 3, "total_volume_ytd": 18900000000, "average_oversubscription": 1.12},
            "status": "active", "active_loans": 1, "success_rate": 93, "total_fees_ytd": 0, "fees_by_type": {}
        },
        {
            "_id": "OA-007",
            "institution": {"name": "Barclays", "division": "Investment Bank", "headquarters": "London, UK", "global_rank": 7, "market_share": 0.058},
            "entity": "Barclays",
            "headquarters": "London, UK",
            "origination_capability": {"typical_deal_size": {"min": 75000000, "max": 2500000000}, "industries": ["Financial Services", "Consumer", "Telecom", "Industrial"], "geographies": ["Europe", "North America"]},
            "syndication_strategy": {"hold_percentage_range": {"min": 0.18, "max": 0.32}, "preferred_participants": ["PA-003", "PA-007"], "pricing_style": "competitive"},
            "track_record": {"completed_syndications_ytd": 36, "failed_syndications_ytd": 4, "total_volume_ytd": 14500000000, "average_oversubscription": 1.10},
            "status": "active", "active_loans": 0, "success_rate": 90, "total_fees_ytd": 0, "fees_by_type": {}
        },
        {
            "_id": "OA-008",
            "institution": {"name": "MUFG Bank", "division": "Global Corporate & Investment Banking", "headquarters": "Tokyo, Japan", "global_rank": 8, "market_share": 0.052},
            "entity": "MUFG Bank",
            "headquarters": "Tokyo, Japan",
            "origination_capability": {"typical_deal_size": {"min": 100000000, "max": 3500000000}, "industries": ["Infrastructure", "Project Finance", "Utilities", "Industrial"], "geographies": ["Asia Pacific", "North America", "Europe"]},
            "syndication_strategy": {"hold_percentage_range": {"min": 0.25, "max": 0.40}, "preferred_participants": ["PA-004", "PA-108"], "pricing_style": "conservative"},
            "track_record": {"completed_syndications_ytd": 39, "failed_syndications_ytd": 2, "total_volume_ytd": 21300000000, "average_oversubscription": 1.20},
            "status": "active", "active_loans": 1, "success_rate": 95, "total_fees_ytd": 0, "fees_by_type": {}
        }
    ]
    
    # Canonical collection name used by app: originator
    db["originator"].delete_many({})
    db["originator"].insert_many(originators)
    # Backward compatibility for older scripts
    db.originator_agents.delete_many({})
    db.originator_agents.insert_many(originators)
    print(f"✅ Seeded {len(originators)} originator agents (originator + originator_agents)")


def seed_participant_agents():
<<<<<<< HEAD
    """Seed 15 diverse participant agents with full profiles"""
=======
    """Seed diverse participant agents"""
    # Base participants
>>>>>>> syndication-change
    participants = [
        # MAJOR (5)
        {
            "_id": "PA-001", "tier": "major",
            "institution": {"name": "Apollo Global Management", "type": "Private Credit Fund", "headquarters": "New York, NY"},
<<<<<<< HEAD
            "risk_appetite": {"total_capital_available": 2500000000, "current_deployed": 1800000000, "available_capacity": 700000000, "max_single_ticket": 300000000, "min_ticket": 25000000, "credit_rating_range": {"min": "B-", "max": "BBB+", "minimum": "B-", "maximum": "BBB+", "sweet_spot": "BB to BB+"}, "target_all_in_yield": 10.5, "min_acceptable_yield": 8.0},
=======
            "risk_appetite": {"total_capital_available": 2500000000, "max_single_ticket": 300000000, "min_ticket": 25000000, "credit_rating_range": {"min": "B-", "max": "BBB+", "sweet_spot": "BB to BB+"}, "target_all_in_yield": 10.5, "min_acceptable_yield": 8.0},
>>>>>>> syndication-change
            "sector_preferences": {"preferred": ["Technology", "Healthcare", "Business Services"], "neutral": ["Industrial", "Consumer"], "avoid": ["Oil & Gas", "Retail"]},
            "geographic_preferences": {"preferred": ["North America"], "neutral": ["Europe"], "avoid": ["Middle East"]},
            "constraints": {"esg_requirements": False},
            "current_portfolio": {"number_of_loans": 85, "total_exposure": 1800000000, "sector_allocations": {"Technology": 0.35, "Healthcare": 0.28, "Business Services": 0.22, "Industrial": 0.15}},
            "strategy": {"investment_style": "aggressive", "bidding_behavior": "fast_decisive", "spread_sensitivity": "low"},
            "decision_making": {"speed": "very_fast", "autonomy_level": "very_high", "typical_response_time_hours": 2},
            "performance_history": {"bids_submitted_ytd": 247, "allocations_won": 89, "win_rate": 0.36, "average_spread_paid": 420, "payments_on_time": 247, "on_time_rate": 1.0},
            "payment_stats": {"total_payments": 247, "on_time_payments": 247, "total_delay_hours": 0, "reliability_score": 100},
            "status": "active"
        },
        {
            "_id": "PA-002", "tier": "major",
            "institution": {"name": "CalPERS", "type": "Public Pension Fund", "headquarters": "Sacramento, CA"},
<<<<<<< HEAD
            "risk_appetite": {"total_capital_available": 3000000000, "current_deployed": 2100000000, "available_capacity": 900000000, "max_single_ticket": 400000000, "min_ticket": 50000000, "credit_rating_range": {"min": "A-", "max": "AAA", "minimum": "A-", "maximum": "AAA", "sweet_spot": "A to AA"}, "target_all_in_yield": 5.5, "min_acceptable_yield": 4.0},
=======
            "risk_appetite": {"total_capital_available": 3000000000, "max_single_ticket": 400000000, "min_ticket": 50000000, "credit_rating_range": {"min": "A-", "max": "AAA", "sweet_spot": "A to AA"}, "target_all_in_yield": 5.5, "min_acceptable_yield": 4.0},
>>>>>>> syndication-change
            "sector_preferences": {"preferred": ["Infrastructure", "Utilities", "Healthcare"], "neutral": ["Industrial"], "avoid": ["Cannabis", "Weapons", "Tobacco"]},
            "geographic_preferences": {"preferred": ["North America", "Europe"], "neutral": ["Asia Pacific"], "avoid": []},
            "constraints": {"esg_requirements": True, "min_esg_score": 75},
            "current_portfolio": {"number_of_loans": 52, "total_exposure": 2100000000, "sector_allocations": {"Infrastructure": 0.40, "Utilities": 0.25, "Healthcare": 0.20, "Industrial": 0.15}},
            "strategy": {"investment_style": "conservative", "bidding_behavior": "methodical_selective", "spread_sensitivity": "moderate"},
            "decision_making": {"speed": "slow", "autonomy_level": "low", "typical_response_time_hours": 48},
            "performance_history": {"bids_submitted_ytd": 67, "allocations_won": 49, "win_rate": 0.73, "average_spread_paid": 285, "payments_on_time": 67, "on_time_rate": 1.0},
            "payment_stats": {"total_payments": 67, "on_time_payments": 67, "total_delay_hours": 0, "reliability_score": 100},
            "status": "active"
        },
        {
            "_id": "PA-003", "tier": "major",
            "institution": {"name": "BNP Paribas Asset Management", "type": "European Bank", "headquarters": "Paris, France"},
<<<<<<< HEAD
            "risk_appetite": {"total_capital_available": 4000000000, "current_deployed": 2900000000, "available_capacity": 1100000000, "max_single_ticket": 500000000, "min_ticket": 30000000, "credit_rating_range": {"min": "BBB-", "max": "AAA", "minimum": "BBB-", "maximum": "AAA", "sweet_spot": "BBB+ to A"}, "target_all_in_yield": 5.0, "min_acceptable_yield": 3.8},
=======
            "risk_appetite": {"total_capital_available": 4000000000, "max_single_ticket": 500000000, "min_ticket": 30000000, "credit_rating_range": {"min": "BBB-", "max": "AAA", "sweet_spot": "BBB+ to A"}, "target_all_in_yield": 5.0, "min_acceptable_yield": 3.8},
>>>>>>> syndication-change
            "sector_preferences": {"preferred": ["Renewable Energy", "Infrastructure", "Industrial"], "neutral": ["Healthcare", "Consumer"], "avoid": ["Coal", "Weapons"]},
            "geographic_preferences": {"preferred": ["Europe", "North America"], "neutral": ["Asia Pacific"], "avoid": []},
            "constraints": {"esg_requirements": True, "min_esg_score": 70},
            "current_portfolio": {"number_of_loans": 78, "total_exposure": 2900000000, "sector_allocations": {"Infrastructure": 0.32, "Renewable Energy": 0.28, "Industrial": 0.25, "Healthcare": 0.15}},
            "strategy": {"investment_style": "moderate", "bidding_behavior": "relationship_price_conscious", "spread_sensitivity": "moderate"},
            "decision_making": {"speed": "moderate", "autonomy_level": "moderate", "typical_response_time_hours": 18},
            "performance_history": {"bids_submitted_ytd": 134, "allocations_won": 98, "win_rate": 0.73, "average_spread_paid": 320, "payments_on_time": 134, "on_time_rate": 1.0},
            "payment_stats": {"total_payments": 134, "on_time_payments": 134, "total_delay_hours": 0, "reliability_score": 100},
            "status": "active"
        },
        {
            "_id": "PA-004", "tier": "major",
            "institution": {"name": "MUFG Bank", "type": "Japanese Bank", "headquarters": "Tokyo, Japan"},
<<<<<<< HEAD
            "risk_appetite": {"total_capital_available": 5000000000, "current_deployed": 3200000000, "available_capacity": 1800000000, "max_single_ticket": 600000000, "min_ticket": 75000000, "credit_rating_range": {"min": "BBB", "max": "AAA", "minimum": "BBB", "maximum": "AAA", "sweet_spot": "A- to AA"}, "target_all_in_yield": 4.5, "min_acceptable_yield": 3.5},
=======
            "risk_appetite": {"total_capital_available": 5000000000, "max_single_ticket": 600000000, "min_ticket": 75000000, "credit_rating_range": {"min": "BBB", "max": "AAA", "sweet_spot": "A- to AA"}, "target_all_in_yield": 4.5, "min_acceptable_yield": 3.5},
>>>>>>> syndication-change
            "sector_preferences": {"preferred": ["Infrastructure", "Project Finance", "Utilities"], "neutral": ["Industrial", "TMT"], "avoid": ["Speculative Tech", "Crypto"]},
            "geographic_preferences": {"preferred": ["Asia Pacific", "North America"], "neutral": ["Europe"], "avoid": []},
            "constraints": {"esg_requirements": False},
            "current_portfolio": {"number_of_loans": 63, "total_exposure": 3200000000, "sector_allocations": {"Infrastructure": 0.45, "Utilities": 0.25, "Industrial": 0.20, "TMT": 0.10}},
            "strategy": {"investment_style": "conservative", "bidding_behavior": "patient_relationship_focused", "spread_sensitivity": "high"},
            "decision_making": {"speed": "very_slow", "autonomy_level": "low", "typical_response_time_hours": 72},
            "performance_history": {"bids_submitted_ytd": 112, "allocations_won": 96, "win_rate": 0.86, "average_spread_paid": 245, "payments_on_time": 112, "on_time_rate": 1.0},
            "payment_stats": {"total_payments": 112, "on_time_payments": 112, "total_delay_hours": 0, "reliability_score": 100},
            "status": "active"
        },
        {
            "_id": "PA-005", "tier": "major",
            "institution": {"name": "Palmer Square Capital", "type": "CLO Manager", "headquarters": "Kansas City, MO"},
<<<<<<< HEAD
            "risk_appetite": {"total_capital_available": 1200000000, "current_deployed": 900000000, "available_capacity": 300000000, "max_single_ticket": 75000000, "min_ticket": 5000000, "credit_rating_range": {"min": "B-", "max": "BBB-", "minimum": "B-", "maximum": "BBB-", "sweet_spot": "B+ to BB"}, "target_all_in_yield": 8.5, "min_acceptable_yield": 7.0},
=======
            "risk_appetite": {"total_capital_available": 1200000000, "max_single_ticket": 75000000, "min_ticket": 5000000, "credit_rating_range": {"min": "B-", "max": "BBB-", "sweet_spot": "B+ to BB"}, "target_all_in_yield": 8.5, "min_acceptable_yield": 7.0},
>>>>>>> syndication-change
            "sector_preferences": {"preferred": ["Business Services", "Healthcare", "Technology"], "neutral": ["Consumer", "Media"], "avoid": ["Oil & Gas", "Airlines"]},
            "geographic_preferences": {"preferred": ["North America"], "neutral": ["Europe"], "avoid": ["Latin America"]},
            "constraints": {"esg_requirements": False},
            "current_portfolio": {"number_of_loans": 142, "total_exposure": 900000000, "sector_allocations": {"Business Services": 0.35, "Healthcare": 0.30, "Technology": 0.25, "Consumer": 0.10}},
            "strategy": {"investment_style": "moderate", "bidding_behavior": "competitive_fast", "spread_sensitivity": "low"},
            "decision_making": {"speed": "very_fast", "autonomy_level": "very_high", "typical_response_time_hours": 1},
            "performance_history": {"bids_submitted_ytd": 892, "allocations_won": 250, "win_rate": 0.28, "average_spread_paid": 445, "payments_on_time": 889, "on_time_rate": 0.997},
            "payment_stats": {"total_payments": 892, "on_time_payments": 889, "total_delay_hours": 18, "reliability_score": 98},
            "status": "active"
        },
        
        # MINOR (10)
<<<<<<< HEAD
        {"_id": "PA-101", "tier": "minor", "institution": {"name": "PNC Bank", "type": "US Regional Bank", "headquarters": "Pittsburgh, PA"}, "risk_appetite": {"total_capital_available": 800000000, "current_deployed": 580000000, "available_capacity": 220000000, "max_single_ticket": 100000000, "min_ticket": 15000000, "credit_rating_range": {"min": "BBB-", "max": "A+", "minimum": "BBB-", "maximum": "A+", "sweet_spot": "BBB to A-"}, "target_all_in_yield": 5.8, "min_acceptable_yield": 4.5}, "sector_preferences": {"preferred": ["Industrial", "Real Estate"], "neutral": ["Consumer"], "avoid": []}, "geographic_preferences": {"preferred": ["North America"], "neutral": [], "avoid": []}, "current_portfolio": {"number_of_loans": 45, "total_exposure": 580000000}, "strategy": {"investment_style": "moderate", "bidding_behavior": "relationship_price_conscious"}, "performance_history": {"bids_submitted_ytd": 89, "allocations_won": 40, "win_rate": 0.45, "average_spread_paid": 365}, "payment_stats": {"total_payments": 89, "on_time_payments": 89, "reliability_score": 100}, "status": "active"},
        {"_id": "PA-102", "tier": "minor", "institution": {"name": "Ares Management", "type": "Private Credit Fund", "headquarters": "Los Angeles, CA"}, "risk_appetite": {"total_capital_available": 1100000000, "current_deployed": 780000000, "available_capacity": 320000000, "max_single_ticket": 200000000, "min_ticket": 20000000, "credit_rating_range": {"min": "B", "max": "BB+", "minimum": "B", "maximum": "BB+", "sweet_spot": "B+ to BB"}, "target_all_in_yield": 11.0, "min_acceptable_yield": 9.0}, "sector_preferences": {"preferred": ["Technology", "Healthcare"], "neutral": ["Business Services"], "avoid": ["Retail"]}, "geographic_preferences": {"preferred": ["North America"], "neutral": ["Europe"], "avoid": []}, "current_portfolio": {"number_of_loans": 68, "total_exposure": 780000000}, "strategy": {"investment_style": "aggressive", "bidding_behavior": "fast_decisive"}, "performance_history": {"bids_submitted_ytd": 198, "allocations_won": 81, "win_rate": 0.41, "average_spread_paid": 475}, "payment_stats": {"total_payments": 198, "on_time_payments": 195, "reliability_score": 97}, "status": "active"},
        {"_id": "PA-103", "tier": "minor", "institution": {"name": "MetLife Investment Management", "type": "Insurance Company", "headquarters": "New York, NY"}, "risk_appetite": {"total_capital_available": 1500000000, "current_deployed": 1200000000, "available_capacity": 300000000, "max_single_ticket": 250000000, "min_ticket": 40000000, "credit_rating_range": {"min": "A-", "max": "AAA", "minimum": "A-", "maximum": "AAA", "sweet_spot": "A to AA"}, "target_all_in_yield": 4.8, "min_acceptable_yield": 3.8}, "sector_preferences": {"preferred": ["Infrastructure", "Utilities"], "neutral": ["Industrial"], "avoid": ["Cannabis"]}, "geographic_preferences": {"preferred": ["North America", "Europe"], "neutral": [], "avoid": []}, "constraints": {"esg_requirements": True, "min_esg_score": 72}, "current_portfolio": {"number_of_loans": 38, "total_exposure": 1200000000}, "strategy": {"investment_style": "conservative", "bidding_behavior": "methodical_selective"}, "performance_history": {"bids_submitted_ytd": 156, "allocations_won": 81, "win_rate": 0.52, "average_spread_paid": 295}, "payment_stats": {"total_payments": 156, "on_time_payments": 156, "reliability_score": 100}, "status": "active"},
        {"_id": "PA-104", "tier": "minor", "institution": {"name": "Golub Capital", "type": "BDC", "headquarters": "New York, NY"}, "risk_appetite": {"total_capital_available": 700000000, "current_deployed": 520000000, "available_capacity": 180000000, "max_single_ticket": 80000000, "min_ticket": 10000000, "credit_rating_range": {"min": "B", "max": "BB+", "minimum": "B", "maximum": "BB+", "sweet_spot": "B+ to BB"}, "target_all_in_yield": 10.0, "min_acceptable_yield": 8.5}, "sector_preferences": {"preferred": ["Business Services", "Healthcare"], "neutral": ["Technology"], "avoid": []}, "geographic_preferences": {"preferred": ["North America"], "neutral": [], "avoid": []}, "current_portfolio": {"number_of_loans": 92, "total_exposure": 520000000}, "strategy": {"investment_style": "moderate", "bidding_behavior": "competitive_fast"}, "performance_history": {"bids_submitted_ytd": 245, "allocations_won": 88, "win_rate": 0.36, "average_spread_paid": 435}, "payment_stats": {"total_payments": 245, "on_time_payments": 243, "reliability_score": 98}, "status": "active"},
        {"_id": "PA-105", "tier": "minor", "institution": {"name": "Davidson Kempner", "type": "Hedge Fund - Distressed", "headquarters": "New York, NY"}, "risk_appetite": {"total_capital_available": 600000000, "current_deployed": 380000000, "available_capacity": 220000000, "max_single_ticket": 100000000, "min_ticket": 15000000, "credit_rating_range": {"min": "CCC", "max": "BB-", "minimum": "CCC", "maximum": "BB-", "sweet_spot": "CCC+ to B"}, "target_all_in_yield": 16.0, "min_acceptable_yield": 12.0}, "sector_preferences": {"preferred": ["Distressed", "Restructuring"], "neutral": ["Industrial"], "avoid": []}, "geographic_preferences": {"preferred": ["North America", "Europe"], "neutral": [], "avoid": []}, "current_portfolio": {"number_of_loans": 28, "total_exposure": 380000000}, "strategy": {"investment_style": "very_aggressive", "bidding_behavior": "opportunistic"}, "performance_history": {"bids_submitted_ytd": 42, "allocations_won": 18, "win_rate": 0.43, "average_spread_paid": 680}, "payment_stats": {"total_payments": 42, "on_time_payments": 40, "reliability_score": 92}, "status": "active"},
        {"_id": "PA-106", "tier": "minor", "institution": {"name": "KeyBank", "type": "US Regional Bank", "headquarters": "Cleveland, OH"}, "risk_appetite": {"total_capital_available": 650000000, "current_deployed": 480000000, "available_capacity": 170000000, "max_single_ticket": 80000000, "min_ticket": 15000000, "credit_rating_range": {"min": "BBB-", "max": "A", "minimum": "BBB-", "maximum": "A", "sweet_spot": "BBB"}, "target_all_in_yield": 5.5, "min_acceptable_yield": 4.2}, "sector_preferences": {"preferred": ["Industrial", "Real Estate"], "neutral": ["Healthcare"], "avoid": []}, "geographic_preferences": {"preferred": ["North America"], "neutral": [], "avoid": []}, "current_portfolio": {"number_of_loans": 52, "total_exposure": 480000000}, "strategy": {"investment_style": "moderate", "bidding_behavior": "relationship_price_conscious"}, "performance_history": {"bids_submitted_ytd": 76, "allocations_won": 32, "win_rate": 0.42, "average_spread_paid": 375}, "payment_stats": {"total_payments": 76, "on_time_payments": 76, "reliability_score": 100}, "status": "active"},
        {"_id": "PA-107", "tier": "minor", "institution": {"name": "Blue Owl Capital", "type": "Private Credit Fund", "headquarters": "New York, NY"}, "risk_appetite": {"total_capital_available": 950000000, "current_deployed": 700000000, "available_capacity": 250000000, "max_single_ticket": 150000000, "min_ticket": 25000000, "credit_rating_range": {"min": "B+", "max": "BB+", "minimum": "B+", "maximum": "BB+", "sweet_spot": "BB"}, "target_all_in_yield": 9.5, "min_acceptable_yield": 8.0}, "sector_preferences": {"preferred": ["Technology", "Healthcare"], "neutral": ["Business Services"], "avoid": []}, "geographic_preferences": {"preferred": ["North America"], "neutral": ["Europe"], "avoid": []}, "current_portfolio": {"number_of_loans": 58, "total_exposure": 700000000}, "strategy": {"investment_style": "aggressive", "bidding_behavior": "fast_decisive"}, "performance_history": {"bids_submitted_ytd": 165, "allocations_won": 62, "win_rate": 0.38, "average_spread_paid": 455}, "payment_stats": {"total_payments": 165, "on_time_payments": 163, "reliability_score": 97}, "status": "active"},
        {"_id": "PA-108", "tier": "minor", "institution": {"name": "Ontario Teachers' Pension", "type": "Pension Fund", "headquarters": "Toronto, Canada"}, "risk_appetite": {"total_capital_available": 2200000000, "current_deployed": 1650000000, "available_capacity": 550000000, "max_single_ticket": 350000000, "min_ticket": 50000000, "credit_rating_range": {"min": "A-", "max": "AAA", "minimum": "A-", "maximum": "AAA", "sweet_spot": "A to AA"}, "target_all_in_yield": 5.2, "min_acceptable_yield": 4.0}, "sector_preferences": {"preferred": ["Infrastructure", "Utilities"], "neutral": ["Industrial"], "avoid": ["Tobacco", "Weapons"]}, "geographic_preferences": {"preferred": ["North America", "Europe"], "neutral": ["Asia Pacific"], "avoid": []}, "constraints": {"esg_requirements": True, "min_esg_score": 78}, "current_portfolio": {"number_of_loans": 42, "total_exposure": 1650000000}, "strategy": {"investment_style": "conservative", "bidding_behavior": "methodical_selective"}, "performance_history": {"bids_submitted_ytd": 58, "allocations_won": 41, "win_rate": 0.71, "average_spread_paid": 275}, "payment_stats": {"total_payments": 58, "on_time_payments": 58, "reliability_score": 100}, "status": "active"},
        {"_id": "PA-109", "tier": "minor", "institution": {"name": "Barings LLC", "type": "CLO Manager", "headquarters": "Charlotte, NC"}, "risk_appetite": {"total_capital_available": 850000000, "current_deployed": 620000000, "available_capacity": 230000000, "max_single_ticket": 60000000, "min_ticket": 5000000, "credit_rating_range": {"min": "B-", "max": "BB+", "minimum": "B-", "maximum": "BB+", "sweet_spot": "B to BB-"}, "target_all_in_yield": 8.2, "min_acceptable_yield": 7.0}, "sector_preferences": {"preferred": ["Business Services", "Technology"], "neutral": ["Healthcare"], "avoid": []}, "geographic_preferences": {"preferred": ["North America"], "neutral": ["Europe"], "avoid": []}, "current_portfolio": {"number_of_loans": 128, "total_exposure": 620000000}, "strategy": {"investment_style": "moderate", "bidding_behavior": "competitive_fast"}, "performance_history": {"bids_submitted_ytd": 678, "allocations_won": 195, "win_rate": 0.29, "average_spread_paid": 450}, "payment_stats": {"total_payments": 678, "on_time_payments": 672, "reliability_score": 96}, "status": "active"},
        {"_id": "PA-110", "tier": "minor", "institution": {"name": "Prudential Investment Management", "type": "Insurance Company", "headquarters": "Newark, NJ"}, "risk_appetite": {"total_capital_available": 1800000000, "current_deployed": 1400000000, "available_capacity": 400000000, "max_single_ticket": 300000000, "min_ticket": 50000000, "credit_rating_range": {"min": "A-", "max": "AAA", "minimum": "A-", "maximum": "AAA", "sweet_spot": "A to AA"}, "target_all_in_yield": 4.5, "min_acceptable_yield": 3.5}, "sector_preferences": {"preferred": ["Infrastructure", "Utilities", "Healthcare"], "neutral": ["Industrial"], "avoid": ["Cannabis"]}, "geographic_preferences": {"preferred": ["North America", "Europe"], "neutral": [], "avoid": []}, "constraints": {"esg_requirements": True, "min_esg_score": 70}, "current_portfolio": {"number_of_loans": 35, "total_exposure": 1400000000}, "strategy": {"investment_style": "conservative", "bidding_behavior": "methodical_selective"}, "performance_history": {"bids_submitted_ytd": 142, "allocations_won": 78, "win_rate": 0.55, "average_spread_paid": 280}, "payment_stats": {"total_payments": 142, "on_time_payments": 142, "reliability_score": 100}, "status": "active"}
=======
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
>>>>>>> syndication-change
    ]
    
    # Process and randomize deployment
    for p in participants:
        total = p["risk_appetite"]["total_capital_available"]
        # Randomize current deployment between 40-80%
        deployed = int(total * random.uniform(0.4, 0.8))
        p["risk_appetite"]["current_deployed"] = deployed
        p["risk_appetite"]["available_capacity"] = total - deployed
        p["risk_appetite"]["reserved_for_bids"] = 0
        
        # Default credit ratings if missing
        if "credit_rating_range" not in p["risk_appetite"]:
            p["risk_appetite"]["credit_rating_range"] = {"min": "B", "max": "A", "sweet_spot": "BB to BBB"}
            p["risk_appetite"]["target_all_in_yield"] = 6.5
            p["risk_appetite"]["min_acceptable_yield"] = 5.0
            
        # Default sector preferences if missing
        if "sector_preferences" not in p:
            p["sector_preferences"] = {"preferred": ["Industrial", "Consumer"], "neutral": ["Healthcare"], "avoid": ["Speculative"]}

    # Canonical collection name used by app: participants
    db["participants"].delete_many({})
    db["participants"].insert_many(participants)
    # Backward compatibility for older scripts
    db.participant_agents.delete_many({})
    db.participant_agents.insert_many(participants)
    print(f"✅ Seeded {len(participants)} participant agents with randomized deployment (participants + participant_agents)")


def seed_demo_syndications():
<<<<<<< HEAD
    """Seed sample syndications with ESG ratings and geography"""
=======
    """Seed sample syndications in various states with relative dates"""
    now = datetime.utcnow()
    
>>>>>>> syndication-change
    syndications = [
        {
            "_id": "SYND-2025-001",
            "syndication_id": "SYND-2025-001",
            "originator_agent_id": "OA-001",
            "originator": "JPMorgan Chase",
            "status": "negotiating",
            "loan_details": {
                "borrower_name": "TechNova Inc.",
                "industry": "Technology",
                "loan_type": "Leveraged Buyout",
                "credit_rating": "BB+",
                "total_amount": 500000000,
                "currency": "USD",
                "originator_hold": 100000000,
                "syndication_target": 400000000,
                "geography": "North America",
                "esg_score": 72,
                "maturity_years": 7,
                "seniority": "Senior Secured First Lien",
                "amortization": "1% p.a.",
                "call_protection": "101 (Y1-2)"
            },
            "esg_rating": 72,
            "geography": "North America",
            "pricing": {"base_rate": "SOFR", "initial_spread": 450, "commitment_fee": 0.5, "arrangement_fee": 2.0, "upfront_fee": 1.0},
            "timeline": {
                "broadcast_date": (NOW - timedelta(hours=24)).isoformat(),
                "target_close_date": (NOW + timedelta(hours=24)).isoformat()
            },
            "current_round": 3,
            "current_spread": 420,
            "total_committed": 370000000,
            "subscription_rate": 0.925,
            "negotiation_state": {"current_round": 3, "current_spread": 420, "total_committed": 370000000, "subscription_rate": 0.925, "active_bids": 8},
            "bids": [],
            "allocations": [],
            "auction_history": [
                {"round": 1, "spread": 450, "total_committed": 280000000, "subscription_rate": 0.70, "bids_count": 6, "timestamp": (NOW - timedelta(hours=20)).isoformat()},
                {"round": 2, "spread": 435, "total_committed": 330000000, "subscription_rate": 0.825, "bids_count": 7, "timestamp": (NOW - timedelta(hours=16)).isoformat()},
                {"round": 3, "spread": 420, "total_committed": 370000000, "subscription_rate": 0.925, "bids_count": 8, "timestamp": (NOW - timedelta(hours=12)).isoformat()}
            ],
            "negotiation_agent_id": "NA-SYND-2025-001",
            "errors": [],
            "warnings": [],
            "created_at": (NOW - timedelta(hours=24)).isoformat(),
            "updated_at": NOW.isoformat()
        },
        {
            "_id": "SYND-2025-002",
            "syndication_id": "SYND-2025-002",
            "originator_agent_id": "OA-002",
            "originator": "Bank of America",
            "status": "settlement",
            "loan_details": {
                "borrower_name": "Atlas Manufacturing Corp.",
                "industry": "Industrial",
                "loan_type": "Corporate Refinancing",
                "credit_rating": "BBB-",
                "total_amount": 350000000,
                "currency": "USD",
                "originator_hold": 70000000,
                "syndication_target": 280000000,
                "geography": "North America",
                "esg_score": 68,
                "maturity_years": 5,
                "seniority": "Senior Unsecured",
                "amortization": "Bullet",
                "call_protection": "None"
            },
            "esg_rating": 68,
            "geography": "North America",
            "pricing": {"base_rate": "SOFR", "initial_spread": 385, "commitment_fee": 0.5, "arrangement_fee": 2.0, "upfront_fee": 1.0},
            "timeline": {
                "broadcast_date": (NOW - timedelta(days=5)).isoformat(),
                "target_close_date": (NOW - timedelta(days=2)).isoformat(),
                "funding_date": (NOW + timedelta(days=3)).isoformat()
            },
            "current_round": 5,
            "current_spread": 385,
            "total_committed": 280000000,
            "subscription_rate": 1.0,
            "negotiation_state": {"current_round": 5, "current_spread": 385, "total_committed": 280000000, "subscription_rate": 1.0, "active_bids": 6},
            "negotiation_agent_id": "NA-SYND-2025-002",
            "settlement_agent_id": "SA-SYND-2025-002",
            "errors": [],
            "warnings": [],
            "created_at": (NOW - timedelta(days=5)).isoformat(),
            "updated_at": NOW.isoformat()
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
                "syndication_target": 220000000,
                "geography": "North America",
                "esg_score": 85,
                "maturity_years": 6,
                "seniority": "Senior Secured First Lien",
                "amortization": "Bullet",
                "call_protection": "101 (Y1)"
            },
            "esg_rating": 85,
            "geography": "North America",
            "pricing": {"base_rate": "SOFR", "initial_spread": 450, "commitment_fee": 0.5, "arrangement_fee": 2.0, "upfront_fee": 1.0},
            "timeline": {
                "broadcast_date": NOW.isoformat(),
                "target_close_date": (NOW + timedelta(hours=48)).isoformat()
            },
            "current_round": 0,
            "current_spread": 450,
            "total_committed": 0,
            "subscription_rate": 0.0,
            "errors": [],
            "warnings": [],
            "created_at": NOW.isoformat(),
            "updated_at": NOW.isoformat()
        }
    ]
    
    # Canonical collection name used by app: syndication_original
    db["syndication_original"].delete_many({})
    db["syndication_original"].insert_many(syndications)
    # Backward compatibility for older scripts
    db.syndications.delete_many({})
    db.syndications.insert_many(syndications)
    print(f"✅ Seeded {len(syndications)} demo syndications with relative dates (syndication_original + syndications)")


def seed_demo_bids():
    """Seed demo bids for the negotiating syndication"""
    bids = [
        {"_id": "BID-001-001", "syndication_id": "SYND-2025-001", "bid_status": "active", "participant_agent_id": "PA-001", "institution_name": "Apollo Global Management", "institution_type": "Private Credit Fund", "bid_amount": 75000000, "spread_bid": 420, "all_in_yield": 8.7, "min_allocation": 37500000, "max_allocation": 75000000, "submitted_at": (NOW - timedelta(hours=20)).isoformat(), "auction_round": 3, "portfolio_fit_score": 0.85, "rank_by_amount": 1, "rank_by_spread": 3},
        {"_id": "BID-001-002", "syndication_id": "SYND-2025-001", "bid_status": "active", "participant_agent_id": "PA-005", "institution_name": "Palmer Square Capital", "institution_type": "CLO Manager", "bid_amount": 50000000, "spread_bid": 420, "all_in_yield": 8.7, "min_allocation": 25000000, "max_allocation": 50000000, "submitted_at": (NOW - timedelta(hours=19)).isoformat(), "auction_round": 3, "portfolio_fit_score": 0.78, "rank_by_amount": 2, "rank_by_spread": 3},
        {"_id": "BID-001-003", "syndication_id": "SYND-2025-001", "bid_status": "active", "participant_agent_id": "PA-102", "institution_name": "Ares Management", "institution_type": "Private Credit Fund", "bid_amount": 60000000, "spread_bid": 415, "all_in_yield": 8.65, "min_allocation": 30000000, "max_allocation": 60000000, "submitted_at": (NOW - timedelta(hours=18)).isoformat(), "auction_round": 3, "portfolio_fit_score": 0.82, "rank_by_amount": 3, "rank_by_spread": 1},
        {"_id": "BID-001-004", "syndication_id": "SYND-2025-001", "bid_status": "active", "participant_agent_id": "PA-104", "institution_name": "Golub Capital", "institution_type": "BDC", "bid_amount": 40000000, "spread_bid": 420, "all_in_yield": 8.7, "min_allocation": 20000000, "max_allocation": 40000000, "submitted_at": (NOW - timedelta(hours=17)).isoformat(), "auction_round": 3, "portfolio_fit_score": 0.75, "rank_by_amount": 5, "rank_by_spread": 3},
        {"_id": "BID-001-005", "syndication_id": "SYND-2025-001", "bid_status": "active", "participant_agent_id": "PA-107", "institution_name": "Blue Owl Capital", "institution_type": "Private Credit Fund", "bid_amount": 55000000, "spread_bid": 418, "all_in_yield": 8.68, "min_allocation": 27500000, "max_allocation": 55000000, "submitted_at": (NOW - timedelta(hours=16)).isoformat(), "auction_round": 3, "portfolio_fit_score": 0.80, "rank_by_amount": 4, "rank_by_spread": 2},
        {"_id": "BID-001-006", "syndication_id": "SYND-2025-001", "bid_status": "active", "participant_agent_id": "PA-109", "institution_name": "Barings LLC", "institution_type": "CLO Manager", "bid_amount": 35000000, "spread_bid": 420, "all_in_yield": 8.7, "min_allocation": 17500000, "max_allocation": 35000000, "submitted_at": (NOW - timedelta(hours=15)).isoformat(), "auction_round": 3, "portfolio_fit_score": 0.72, "rank_by_amount": 6, "rank_by_spread": 3},
        {"_id": "BID-001-007", "syndication_id": "SYND-2025-001", "bid_status": "active", "participant_agent_id": "PA-101", "institution_name": "PNC Bank", "institution_type": "US Regional Bank", "bid_amount": 30000000, "spread_bid": 420, "all_in_yield": 8.7, "min_allocation": 15000000, "max_allocation": 30000000, "submitted_at": (NOW - timedelta(hours=14)).isoformat(), "auction_round": 3, "portfolio_fit_score": 0.68, "rank_by_amount": 7, "rank_by_spread": 3},
        {"_id": "BID-001-008", "syndication_id": "SYND-2025-001", "bid_status": "active", "participant_agent_id": "PA-106", "institution_name": "KeyBank", "institution_type": "US Regional Bank", "bid_amount": 25000000, "spread_bid": 420, "all_in_yield": 8.7, "min_allocation": 12500000, "max_allocation": 25000000, "submitted_at": (NOW - timedelta(hours=13)).isoformat(), "auction_round": 3, "portfolio_fit_score": 0.65, "rank_by_amount": 8, "rank_by_spread": 3}
    ]
    
    db.bids.delete_many({})
    db.bids.insert_many(bids)
    print(f"✅ Seeded {len(bids)} demo bids")


def seed_demo_allocations():
    """Seed demo allocations for settlement syndication"""
    allocations = {
        "_id": "ALLOC-SYND-2025-002",
        "syndication_id": "SYND-2025-002",
        "allocation_status": "provisional",
        "negotiation_agent_id": "NA-SYND-2025-002",
        "allocations": [
            {"_id": "ALLOC-BID-002-001", "bid_id": "BID-002-001", "participant_agent_id": "PA-003", "institution_name": "BNP Paribas Asset Management", "institution_type": "European Bank", "original_bid_amount": 80000000, "original_spread_bid": 385, "final_allocation": 75000000, "allocation_percentage": 0.268, "final_spread": 385, "allocation_method": "pro_rata", "commitment_status": "confirmed", "commitment_letter_signed": True, "fees": {"commitment_fee": 375000, "arrangement_fee": 1500000, "total_fees": 1875000}},
            {"_id": "ALLOC-BID-002-002", "bid_id": "BID-002-002", "participant_agent_id": "PA-004", "institution_name": "MUFG Bank", "institution_type": "Japanese Bank", "original_bid_amount": 100000000, "original_spread_bid": 385, "final_allocation": 90000000, "allocation_percentage": 0.321, "final_spread": 385, "allocation_method": "pro_rata", "commitment_status": "confirmed", "commitment_letter_signed": True, "fees": {"commitment_fee": 450000, "arrangement_fee": 1800000, "total_fees": 2250000}},
            {"_id": "ALLOC-BID-002-003", "bid_id": "BID-002-003", "participant_agent_id": "PA-101", "institution_name": "PNC Bank", "institution_type": "US Regional Bank", "original_bid_amount": 50000000, "original_spread_bid": 385, "final_allocation": 45000000, "allocation_percentage": 0.161, "final_spread": 385, "allocation_method": "pro_rata", "commitment_status": "confirmed", "commitment_letter_signed": True, "fees": {"commitment_fee": 225000, "arrangement_fee": 900000, "total_fees": 1125000}},
            {"_id": "ALLOC-BID-002-004", "bid_id": "BID-002-004", "participant_agent_id": "PA-106", "institution_name": "KeyBank", "institution_type": "US Regional Bank", "original_bid_amount": 40000000, "original_spread_bid": 385, "final_allocation": 35000000, "allocation_percentage": 0.125, "final_spread": 385, "allocation_method": "pro_rata", "commitment_status": "confirmed", "commitment_letter_signed": True, "fees": {"commitment_fee": 175000, "arrangement_fee": 700000, "total_fees": 875000}},
            {"_id": "ALLOC-BID-002-005", "bid_id": "BID-002-005", "participant_agent_id": "PA-110", "institution_name": "Prudential Investment Management", "institution_type": "Insurance Company", "original_bid_amount": 40000000, "original_spread_bid": 385, "final_allocation": 35000000, "allocation_percentage": 0.125, "final_spread": 385, "allocation_method": "pro_rata", "commitment_status": "confirmed", "commitment_letter_signed": True, "fees": {"commitment_fee": 175000, "arrangement_fee": 700000, "total_fees": 875000}}
        ],
        "auction_results": {"total_rounds": 5, "final_spread": 385, "clearing_spread": 385, "total_bids_received": 6, "winning_bids": 5, "close_reason": "fully_subscribed", "subscription_rate": 1.0},
        "created_at": (NOW - timedelta(days=2)).isoformat()
    }
    
    db.allocations.delete_many({})
    db.allocations.insert_one(allocations)
    print(f"✅ Seeded demo allocations for SYND-2025-002")


def seed_demo_payments():
    """Seed demo payments for settlement syndication"""
    payments = [
        {"_id": "PAY-002-003-COMM", "payment_agent_id": "PAY-SYND-2025-002", "syndication_id": "SYND-2025-002", "allocation_id": "ALLOC-BID-002-001", "payer": {"participant_agent_id": "PA-003", "institution_name": "BNP Paribas Asset Management"}, "recipient": {"type": "originator", "agent_id": "OA-002"}, "payment_type": "commitment_fee", "amount_due": 375000, "amount_paid": 375000, "currency": "USD", "due_date": (NOW - timedelta(days=1)).isoformat(), "payment_status": "completed", "is_on_time": True, "completed_at": (NOW - timedelta(days=1, hours=2)).isoformat(), "created_at": (NOW - timedelta(days=2)).isoformat()},
        {"_id": "PAY-002-004-COMM", "payment_agent_id": "PAY-SYND-2025-002", "syndication_id": "SYND-2025-002", "allocation_id": "ALLOC-BID-002-002", "payer": {"participant_agent_id": "PA-004", "institution_name": "MUFG Bank"}, "recipient": {"type": "originator", "agent_id": "OA-002"}, "payment_type": "commitment_fee", "amount_due": 450000, "amount_paid": 450000, "currency": "USD", "due_date": (NOW - timedelta(days=1)).isoformat(), "payment_status": "completed", "is_on_time": True, "completed_at": (NOW - timedelta(days=1, hours=5)).isoformat(), "created_at": (NOW - timedelta(days=2)).isoformat()},
        {"_id": "PAY-002-101-COMM", "payment_agent_id": "PAY-SYND-2025-002", "syndication_id": "SYND-2025-002", "allocation_id": "ALLOC-BID-002-003", "payer": {"participant_agent_id": "PA-101", "institution_name": "PNC Bank"}, "recipient": {"type": "originator", "agent_id": "OA-002"}, "payment_type": "commitment_fee", "amount_due": 225000, "amount_paid": 225000, "currency": "USD", "due_date": (NOW - timedelta(days=1)).isoformat(), "payment_status": "completed", "is_on_time": True, "completed_at": (NOW - timedelta(days=1, hours=3)).isoformat(), "created_at": (NOW - timedelta(days=2)).isoformat()},
        {"_id": "PAY-002-106-COMM", "payment_agent_id": "PAY-SYND-2025-002", "syndication_id": "SYND-2025-002", "allocation_id": "ALLOC-BID-002-004", "payer": {"participant_agent_id": "PA-106", "institution_name": "KeyBank"}, "recipient": {"type": "originator", "agent_id": "OA-002"}, "payment_type": "commitment_fee", "amount_due": 175000, "amount_paid": 175000, "currency": "USD", "due_date": (NOW - timedelta(days=1)).isoformat(), "payment_status": "completed", "is_on_time": True, "completed_at": (NOW - timedelta(days=1, hours=4)).isoformat(), "created_at": (NOW - timedelta(days=2)).isoformat()},
        {"_id": "PAY-002-110-COMM", "payment_agent_id": "PAY-SYND-2025-002", "syndication_id": "SYND-2025-002", "allocation_id": "ALLOC-BID-002-005", "payer": {"participant_agent_id": "PA-110", "institution_name": "Prudential Investment Management"}, "recipient": {"type": "originator", "agent_id": "OA-002"}, "payment_type": "commitment_fee", "amount_due": 175000, "amount_paid": 175000, "currency": "USD", "due_date": (NOW - timedelta(days=1)).isoformat(), "payment_status": "completed", "is_on_time": True, "completed_at": (NOW - timedelta(days=1, hours=6)).isoformat(), "created_at": (NOW - timedelta(days=2)).isoformat()}
    ]
    
    db.payment_history.delete_many({})
    db.payment_history.insert_many(payments)
    print(f"✅ Seeded {len(payments)} demo payments")


def main():
    print("\n🌱 Seeding SyndiMatch Database...\n")
    
    seed_originator_agents()
    seed_participant_agents()
    seed_demo_syndications()
    seed_demo_bids()
    seed_demo_allocations()
    seed_demo_payments()
    
    print("\n🎉 Database seeding complete!\n")
    
    # Print summary and sample data
    print("Collections summary:")
<<<<<<< HEAD
    print(f"  • originator_agents: {db.originator_agents.count_documents({})}")
    print(f"  • participant_agents: {db.participant_agents.count_documents({})}")
    print(f"  • syndications: {db.syndications.count_documents({})}")
    print(f"  • bids: {db.bids.count_documents({})}")
    print(f"  • allocations: {db.allocations.count_documents({})}")
    print(f"  • payment_history: {db.payment_history.count_documents({})}")
=======
    print(f"  • originator (canonical): {db['originator'].count_documents({})}")
    print(f"  • originator_agents (legacy): {db.originator_agents.count_documents({})}")
    print(f"  • participants (canonical): {db['participants'].count_documents({})}")
    print(f"  • participant_agents (legacy): {db.participant_agents.count_documents({})}")
    print(f"  • syndication_original (canonical): {db['syndication_original'].count_documents({})}")
    print(f"  • syndications (legacy): {db.syndications.count_documents({})}")
    
    print("\nSample records:")
    sample_o = db["originator"].find_one()
    if sample_o:
        print(f"  • Originator: {sample_o['entity']} ({sample_o['_id']})")
    
    sample_p = db["participants"].find_one()
    if sample_p:
        print(f"  • Participant: {sample_p['institution']['name']} (Deployed: {sample_p['risk_appetite']['current_deployed']:,})")
    
    sample_s = db["syndication_original"].find_one()
    if sample_s:
        print(f"  • Syndication: {sample_s['loan_details']['borrower_name']} (Status: {sample_s['status']})")
>>>>>>> syndication-change


if __name__ == "__main__":
    main()
