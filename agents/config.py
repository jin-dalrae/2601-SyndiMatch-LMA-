"""
SyndiMatch Agent Orchestration - Configuration
"""

import os
from dotenv import load_dotenv

load_dotenv()

# MongoDB
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DATABASE_NAME = "syndimatch"

# Anthropic
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
AGENT_MODEL = "claude-sonnet-4-20250514"

# Coinbase x402
COINBASE_API_KEY = os.getenv("COINBASE_API_KEY", "")
COINBASE_API_SECRET = os.getenv("COINBASE_API_SECRET", "")

# WebSocket
WS_PORT = int(os.getenv("WS_PORT", "8765"))

# Agent Settings
AUCTION_ROUND_DURATION_SECONDS = 30  # For demo, normally minutes
MAX_AUCTION_ROUNDS = 10
MIN_SUBSCRIPTION_RATE = 0.80
EARLY_CLOSE_THRESHOLD = 0.95

# Payment Settings
COMMITMENT_FEE_DUE_HOURS = 24
LATE_PAYMENT_PENALTY_BPS = 50  # Annual rate
GRACE_PERIOD_HOURS = 4
