
import asyncio
import logging
from datetime import datetime
import sys
import os

# Add parent directory to path to import agents
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'agents')))

import db
from orchestrator import run_syndication
from event_bus import EventBus
from events import SyndicationOpened, BidReceived, SettlementStageCompleted, PaymentProcessed, SyndicationCompleted

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
    EventBus.subscribe_all(verifier.handle_event)
    
    # 3. Run a small syndication
    originator_id = "OA-001"
    logger.info(f"Running syndication for {originator_id}...")
    
    # We run it in a thread since it might be blocking or have its own loop
    try:
        # Note: run_syndication handles its own state and DB interactions
        # It now returns the initial state which contains the syndication_id
        initial_state = run_syndication(originator_id)
    except Exception as e:
        logger.error(f"Syndication run failed: {e}")
        return False

    # 4. Wait for completion and verify via MongoDB Audit Log
    import time
    
    # Wait a few seconds for all handlers to finish processing events into the audit log
    time.sleep(2)
    
    synd_id = initial_state["syndication_id"]
    audit_events = list(db.get_collection("audit_log").find({"syndication_id": synd_id}))
    
    logger.info(f"--- Verification Results for {synd_id} ---")
    logger.info(f"Total audit events found: {len(audit_events)}")
    
    received_types = [e["event_type"] for e in audit_events]
    found_reasoning = {}
    
    for event_doc in audit_events:
        etype = event_doc["event_type"]
        payload = event_doc.get("payload", {})
        if "reasoning" in payload and payload["reasoning"]:
            found_reasoning[etype] = True
            logger.info(f"✅ Found {etype} with reasoning: {payload['reasoning'][:50]}...")
        else:
            logger.warning(f"❌ Found {etype} WITHOUT reasoning in audit log")
            
    required_events = ['SyndicationOpened', 'BidReceived', 'SettlementStageCompleted', 'PaymentProcessed', 'SyndicationCompleted']
    missing_events = [e for e in required_events if e not in received_types]
    missing_reasoning = [e for e in required_events if e not in found_reasoning]
    
    if not missing_events:
        logger.info("✅ ALL required events were emitted")
    else:
        logger.error(f"❌ Missing events: {missing_events}")
        
    if not missing_reasoning:
        logger.info("✅ ALL events contain reasoning metadata")
    else:
        logger.warning(f"❌ Missing reasoning in: {missing_reasoning}")
        
    success = len(missing_events) == 0 and len(missing_reasoning) == 0
    return success

if __name__ == "__main__":
    success = asyncio.run(verify_phase_5())
    if success:
        logger.info("✨ Phase 5 Verification PASSED")
        sys.exit(0)
    else:
        logger.error("💥 Phase 5 Verification FAILED")
        sys.exit(1)
