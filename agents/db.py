"""
SyndiMatch - Enhanced MongoDB Database Client
With connection pooling, error handling, indexes, and health checks
"""

from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.database import Database
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
from typing import Optional, Dict, Any, List
import logging
import os

from .config import MONGODB_URI, DATABASE_NAME

logger = logging.getLogger(__name__)

_client: Optional[MongoClient] = None
_db: Optional[Database] = None
_indexes_created = False


def get_database() -> Database:
    """Get MongoDB database connection with proper error handling"""
    global _client, _db
    
    if _db is None:
<<<<<<< HEAD
        try:
            _client = MongoClient(
                MONGODB_URI,
                serverSelectionTimeoutMS=5000,
                connectTimeoutMS=10000,
                socketTimeoutMS=10000,
                maxPoolSize=50,
                minPoolSize=5,
                maxIdleTimeMS=30000,
                retryWrites=True,
                retryReads=True
            )
            
            # Test connection
            _client.admin.command('ping')
            _db = _client[DATABASE_NAME]
            logger.info(f"✓ Connected to MongoDB: {DATABASE_NAME}")
            
            # Ensure indexes on first connection
            _ensure_indexes()
            
        except (ConnectionFailure, ServerSelectionTimeoutError) as e:
            logger.error(f"❌ MongoDB connection failed: {e}")
            raise ConnectionError(f"Cannot connect to MongoDB: {e}")
        except Exception as e:
            logger.error(f"❌ MongoDB error: {e}")
            raise
=======
        _client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
        _db = _client[DATABASE_NAME]
        logger.info(f"Connected to MongoDB: {DATABASE_NAME}")
>>>>>>> syndication-change
    
    return _db


def _ensure_indexes():
    """Create required indexes for optimal performance"""
    global _indexes_created
    
    if _indexes_created:
        return
    
    try:
        db = _db
        
        # Syndications indexes
        db.syndications.create_index([("status", ASCENDING)])
        db.syndications.create_index([("originator_agent_id", ASCENDING)])
        db.syndications.create_index([("created_at", DESCENDING)])
        
        # Bids indexes
        db.bids.create_index([("syndication_id", ASCENDING), ("bid_status", ASCENDING)])
        db.bids.create_index([("participant_agent_id", ASCENDING)])
        db.bids.create_index([("spread_bid", ASCENDING)])
        
        # Payment history indexes
        db.payment_history.create_index([("syndication_id", ASCENDING), ("payment_status", ASCENDING)])
        db.payment_history.create_index([("due_date", ASCENDING)])
        db.payment_history.create_index([("payment_type", ASCENDING)])
        
        # Allocations indexes
        db.allocations.create_index([("syndication_id", ASCENDING)])
        
        # Agent indexes
        db.participant_agents.create_index([("status", ASCENDING)])
        db.originator_agents.create_index([("status", ASCENDING)])
        
        # Events index
        db.syndication_events.create_index([("syndication_id", ASCENDING), ("timestamp", DESCENDING)])
        
        _indexes_created = True
        logger.info("✓ Database indexes ensured")
        
    except Exception as e:
        logger.warning(f"Failed to create indexes: {e}")


def health_check() -> Dict[str, Any]:
    """Check database health and return stats"""
    try:
        db = get_database()
        
        # Ping database
        db.command('ping')
        
        # Get stats
        stats = db.command('dbStats')
        
        return {
            "status": "healthy",
            "database": DATABASE_NAME,
            "collections": db.list_collection_names(),
            "size_mb": round(stats.get('dataSize', 0) / 1024 / 1024, 2),
            "num_objects": stats.get('objects', 0),
            "indexes": stats.get('indexes', 0)
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }


def get_collection(name: str):
    """Get a specific collection"""
    return get_database()[name]


# ============== Collection Shortcuts ==============

def syndications():
    """Point to the canonical syndications collection"""
    return get_collection("syndication_original")

def bids():
    return get_collection("bids")

def allocations():
    return get_collection("allocations")

def payment_agents():
    return get_collection("payment_agents")

def payment_history():
    return get_collection("payment_history")

def participant_agents():
    """Point to the richer participants collection"""
    return get_collection("participants")

def originator_agents():
    """Point to the richer originator collection"""
    return get_collection("originator")

def negotiation_agents():
    return get_collection("negotiation_agents")

def settlement_agents():
    return get_collection("settlement_agents")

def payments():
    return get_collection("payments")

def transactions():
    return get_collection("transactions")

def payment_summaries():
    return get_collection("payment_summaries")

def syndication_events():
    return get_collection("syndication_events")

def alerts():
    return get_collection("alerts")

def escrow_releases():
    return get_collection("escrow_releases")


# ============== Query Helpers ==============

def get_active_syndications(limit: int = 20) -> List[Dict]:
    """Get active syndications with proper projection"""
    return list(syndications().find(
        {"status": {"$in": ["open", "negotiating", "closing", "settlement"]}},
        projection={
            "_id": 1,
            "originator": 1,
            "loan_details": 1,
            "pricing": 1,
            "timeline": 1,
            "current_round": 1,
            "current_spread": 1,
            "subscription_rate": 1,
            "status": 1,
            "esg_rating": 1,
            "geography": 1
        }
    ).limit(limit).sort("created_at", DESCENDING))


def get_participant_bids(participant_id: str, syndication_id: str = None) -> List[Dict]:
    """Get bids by participant"""
    query = {"participant_agent_id": participant_id}
    if syndication_id:
        query["syndication_id"] = syndication_id
    return list(bids().find(query).sort("submitted_at", DESCENDING))


def get_pending_payments(syndication_id: str = None) -> List[Dict]:
    """Get pending payments, optionally filtered by syndication"""
    query = {"payment_status": {"$in": ["pending", "retry"]}}
    if syndication_id:
        query["syndication_id"] = syndication_id
    return list(payment_history().find(query).sort("due_date", ASCENDING))


def get_syndication_with_details(syndication_id: str) -> Optional[Dict]:
    """Get syndication with related data"""
    synd = syndications().find_one({"_id": syndication_id})
    if not synd:
        return None
    
    # Add related data
    synd["_bids"] = list(bids().find({"syndication_id": syndication_id}))
    synd["_allocations"] = allocations().find_one({"syndication_id": syndication_id})
    synd["_payments"] = list(payment_history().find({"syndication_id": syndication_id}))
    
    return synd


# ============== Bulk Operations ==============

def bulk_update_bids(updates: List[Dict]) -> int:
    """Bulk update bids efficiently"""
    if not updates:
        return 0
    
    from pymongo import UpdateOne
    
    operations = [
        UpdateOne({"_id": u["_id"]}, {"$set": u["update"]})
        for u in updates
    ]
    
    result = bids().bulk_write(operations, ordered=False)
    return result.modified_count


# ============== Migration Support ==============

def get_db_version() -> int:
    """Get current database schema version"""
    metadata = get_collection("_metadata").find_one({"_id": "version"})
    return metadata.get("version", 0) if metadata else 0


def run_migrations():
    """Run pending database migrations"""
    current = get_db_version()
    target = 2  # Current target version
    
    if current >= target:
        return
    
    logger.info(f"Running migrations from v{current} to v{target}")
    
    if current < 1:
        # Migration 1: Add ESG ratings
        syndications().update_many(
            {"esg_rating": {"$exists": False}},
            {"$set": {"esg_rating": 70}}
        )
        logger.info("Migration 1: Added ESG ratings")
    
    if current < 2:
        # Migration 2: Add geography
        syndications().update_many(
            {"geography": {"$exists": False}},
            {"$set": {"geography": "North America"}}
        )
        logger.info("Migration 2: Added geography")
    
    # Update version
    get_collection("_metadata").replace_one(
        {"_id": "version"},
        {"_id": "version", "version": target},
        upsert=True
    )
    
    logger.info(f"Migrations complete. DB version: {target}")


def close_connection():
    """Close MongoDB connection"""
    global _client, _db, _indexes_created
    if _client:
        _client.close()
        _client = None
        _db = None
        _indexes_created = False
        logger.info("MongoDB connection closed")


def ping_database() -> bool:
    """Ping MongoDB to verify connectivity."""
    try:
        db = get_database()
        db.command({"ping": 1})
        return True
    except Exception as exc:
        logger.error(f"MongoDB ping failed: {exc}")
        return False
