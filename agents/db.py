"""
SyndiMatch - MongoDB Database Client
"""

from pymongo import MongoClient
from pymongo.database import Database
from typing import Optional
import logging

from .config import MONGODB_URI, DATABASE_NAME

logger = logging.getLogger(__name__)

_client: Optional[MongoClient] = None
_db: Optional[Database] = None


def get_database() -> Database:
    """Get MongoDB database connection"""
    global _client, _db
    
    if _db is None:
        _client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
        _db = _client[DATABASE_NAME]
        logger.info(f"Connected to MongoDB: {DATABASE_NAME}")
    
    return _db


def get_collection(name: str):
    """Get a specific collection"""
    return get_database()[name]


# Collection shortcuts
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


def close_connection():
    """Close MongoDB connection"""
    global _client, _db
    if _client:
        _client.close()
        _client = None
        _db = None
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
