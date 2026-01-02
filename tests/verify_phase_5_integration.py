
import asyncio
import logging
from datetime import datetime
import sys
import os

# Add parent directory to path to import agents
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'agents')))

import db
from orchestrator import run_syndication
from events import EventBus, SyndicationOpened, BidReceived, SettlementStageCompleted, PaymentProcessed, SyndicationCompleted

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("Phase5Verifier")

class EventVerifier:
    def __init__(self):
        self.received_events = []
        self.found_reasoning = {}
        
    def handle_event(self, event):
        event_type = event.__class__.__name__
        self.received_events.append(event_type)
        
        # Check for reasoning
        if hasattr(event, 'reasoning') and event.reasoning:
            logger.info(f"✅ Received {event_type} with reasoning: {event.reasoning[:50]}...")
            self.found_reasoning[event_type] = True
        else:
            logger.warning(f"❌ Received {event_type} WITHOUT reasoning")

async def verify_phase_5():
    logger.info("🚀 Starting Phase 5 Integration Verification")
    
    # 1. Setup Database
    db.get_database()
    
    # 2. Setup Event Listener
    verifier = EventVerifier()
    EventBus.subscribe(SyndicationOpened, verifier.handle_event)
    EventBus.subscribe(BidReceived, verifier.handle_event)
    EventBus.subscribe(SettlementStageCompleted, verifier.handle_event)
    EventBus.subscribe(PaymentProcessed, verifier.handle_event)
    EventBus.subscribe(SyndicationCompleted, verifier.handle_event)
    
    # 3. Run a small syndication
    originator_id = "ORG-JPM-001"
    logger.info(f"Running syndication for {originator_id}...")
    
    # We run it in a thread since it might be blocking or have its own loop
    try:
        # Note: run_syndication handles its own state and DB interactions
        run_syndication(originator_id)
    except Exception as e:
        logger.error(f"Syndication run failed: {e}")
        return False

    # 4. Analyze results
    required_events = ['SyndicationOpened', 'BidReceived', 'SettlementStageCompleted', 'PaymentProcessed', 'SyndicationCompleted']
    missing_events = [e for e in required_events if e not in verifier.received_events]
    missing_reasoning = [e for e in required_events if e not in verifier.found_reasoning]
    
    logger.info("--- Verification Summary ---")
    logger.info(f"Total events received: {len(verifier.received_events)}")
    
    if not missing_events:
        logger.info("✅ All required events were emitted.")
    else:
        logger.error(f"❌ Missing events: {missing_events}")
        
    if not missing_reasoning:
        logger.info("✅ All required events contained reasoning data.")
    else:
        logger.error(f"❌ Missing reasoning in: {missing_reasoning}")
        
    return not missing_events and not missing_reasoning

if __name__ == "__main__":
    success = asyncio.run(verify_phase_5())
    if success:
        logger.info("✨ Phase 5 Verification PASSED")
        sys.exit(0)
    else:
        logger.error("💥 Phase 5 Verification FAILED")
        sys.exit(1)
