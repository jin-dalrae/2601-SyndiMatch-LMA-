"""
SyndiMatch Agent Orchestration - Enhanced Configuration
With environment detection, validation, and feature flags
"""

import os
import logging
from dotenv import load_dotenv

load_dotenv()

# ============== Environment Detection ==============
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
IS_PRODUCTION = ENVIRONMENT == "production"
IS_DEVELOPMENT = ENVIRONMENT == "development"
IS_TESTING = ENVIRONMENT == "test"

# ============== Logging Configuration ==============
LOG_LEVEL = os.getenv("LOG_LEVEL", "DEBUG" if IS_DEVELOPMENT else "INFO")
LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format=LOG_FORMAT
)
logger = logging.getLogger(__name__)

# ============== MongoDB ==============
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "syndimatch" if IS_PRODUCTION else "syndimatch_dev")

# ============== Anthropic (Claude) ==============
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
AGENT_MODEL = os.getenv("AGENT_MODEL", "claude-sonnet-4-20250514")
SIMULATION_MODE = not (ANTHROPIC_API_KEY and ANTHROPIC_API_KEY.startswith("sk-"))

if not ANTHROPIC_API_KEY and IS_PRODUCTION:
    logger.warning("ANTHROPIC_API_KEY not set - AI features will be disabled")

# ============== Google Gemini ==============
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash-exp")

# ============== Coinbase CDP (x402) ==============
CDP_API_KEY_NAME = os.getenv("CDP_API_KEY_NAME", "")
CDP_API_KEY_PRIVATE_KEY = os.getenv("CDP_API_KEY_PRIVATE_KEY", "").replace("\\n", "\n")
CDP_NETWORK = os.getenv("CDP_NETWORK", "base-sepolia" if IS_DEVELOPMENT else "base")

# Legacy variable names (backward compatibility)
COINBASE_API_KEY = os.getenv("COINBASE_API_KEY", CDP_API_KEY_NAME)
COINBASE_API_SECRET = os.getenv("COINBASE_API_SECRET", CDP_API_KEY_PRIVATE_KEY)

# ============== Server/WebSocket ==============
API_PORT = int(os.getenv("API_PORT", "8000"))
WS_PORT = int(os.getenv("WS_PORT", "8765"))
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
API_URL = os.getenv("API_URL", f"http://localhost:{API_PORT}")
WEBSOCKET_URL = os.getenv("WEBSOCKET_URL", f"ws://localhost:{WS_PORT}")

# ============== Agent Settings ==============
# Development: faster for demo; Production: realistic timing
if IS_PRODUCTION:
    AUCTION_ROUND_DURATION_SECONDS = int(os.getenv("AUCTION_ROUND_DURATION", "1800"))  # 30 min
    MAX_AUCTION_ROUNDS = int(os.getenv("MAX_AUCTION_ROUNDS", "15"))
else:
    AUCTION_ROUND_DURATION_SECONDS = int(os.getenv("AUCTION_ROUND_DURATION", "30"))  # 30 sec
    MAX_AUCTION_ROUNDS = int(os.getenv("MAX_AUCTION_ROUNDS", "5"))

MIN_SUBSCRIPTION_RATE = float(os.getenv("MIN_SUBSCRIPTION_RATE", "0.80"))
EARLY_CLOSE_THRESHOLD = float(os.getenv("EARLY_CLOSE_THRESHOLD", "0.95"))

# ============== Payment Settings ==============
COMMITMENT_FEE_DUE_HOURS = int(os.getenv("COMMITMENT_FEE_DUE_HOURS", "24"))
LATE_PAYMENT_PENALTY_BPS = int(os.getenv("LATE_PAYMENT_PENALTY_BPS", "50"))  # Annual rate
GRACE_PERIOD_HOURS = int(os.getenv("GRACE_PERIOD_HOURS", "4"))
PLATFORM_FEE_BPS = int(os.getenv("PLATFORM_FEE_BPS", "15"))  # 0.15%

# ============== Timeouts ==============
PARTICIPANT_EVALUATION_TIMEOUT_SECONDS = int(os.getenv("PARTICIPANT_TIMEOUT", "30"))
PAYMENT_PROCESSING_TIMEOUT_SECONDS = int(os.getenv("PAYMENT_TIMEOUT", "60"))
LLM_REQUEST_TIMEOUT_SECONDS = int(os.getenv("LLM_TIMEOUT", "30"))
DB_OPERATION_TIMEOUT_SECONDS = int(os.getenv("DB_TIMEOUT", "10"))

# ============== Rate Limiting ==============
ANTHROPIC_REQUESTS_PER_MINUTE = int(os.getenv("ANTHROPIC_RPM", "50"))
GEMINI_REQUESTS_PER_MINUTE = int(os.getenv("GEMINI_RPM", "60"))

# ============== Feature Flags ==============
ENABLE_WEB_SEARCH = os.getenv("ENABLE_WEB_SEARCH", "true").lower() == "true"
ENABLE_X402_PAYMENTS = os.getenv("ENABLE_X402_PAYMENTS", "false").lower() == "true"
ENABLE_AI_REPORTS = os.getenv("ENABLE_AI_REPORTS", "true").lower() == "true"
ENABLE_REAL_TIME_UPDATES = os.getenv("ENABLE_REAL_TIME_UPDATES", "true").lower() == "true"
ENABLE_EMAIL_NOTIFICATIONS = os.getenv("ENABLE_EMAIL", "false").lower() == "true"

# ============== Security ==============
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-prod")
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")
API_KEY_HEADER = "X-API-Key"

if IS_PRODUCTION and SECRET_KEY == "dev-secret-key-change-in-prod":
    logger.warning("Using default SECRET_KEY in production - this is insecure!")

# ============== Notification Settings ==============
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
NOTIFICATION_EMAIL_FROM = os.getenv("NOTIFICATION_EMAIL", "")

# ============== Configuration Summary (for debugging) ==============
def print_config_summary():
    """Print configuration summary for debugging"""
    logger.info(f"Environment: {ENVIRONMENT}")
    logger.info(f"Database: {DATABASE_NAME}")
    logger.info(f"API URL: {API_URL}")
    logger.info(f"WebSocket URL: {WEBSOCKET_URL}")
    logger.info(f"Anthropic API: {'configured' if ANTHROPIC_API_KEY else 'NOT SET'}")
    logger.info(f"Gemini API: {'configured' if GEMINI_API_KEY else 'NOT SET'}")
    logger.info(f"CDP/x402: {'configured' if CDP_API_KEY_NAME else 'NOT SET'}")
    logger.info(f"x402 Payments: {'enabled' if ENABLE_X402_PAYMENTS else 'disabled'}")
    logger.info(f"AI Reports: {'enabled' if ENABLE_AI_REPORTS else 'disabled'}")
