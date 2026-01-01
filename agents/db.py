"""
SyndiMatch - MongoDB Database Client
"""

from pymongo import MongoClient
from pymongo.database import Database
from typing import Optional
import logging

from config import MONGODB_URI, DATABASE_NAME

logger = logging.getLogger(__name__)

_client: Optional[MongoClient] = None
_db: Optional[Database] = None


def get_database() -> Database:
    """Get MongoDB database connection"""
    global _client, _db
    
    if _db is None:
        _client = MongoClient(MONGODB_URI)
        _db = _client[DATABASE_NAME]
        logger.info(f"Connected to MongoDB: {DATABASE_NAME}")
    
    return _db


def get_collection(name: str):
    """Get a specific collection"""
    return get_database()[name]


# Collection shortcuts
def syndications():
    return get_collection("syndications")

def bids():
    return get_collection("bids")

def allocations():
    return get_collection("allocations")

def payment_agents():
    return get_collection("payment_agents")

def payment_history():
    return get_collection("payment_history")

def participant_agents():
    return get_collection("participant_agents")

def originator_agents():
    return get_collection("originator_agents")

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
