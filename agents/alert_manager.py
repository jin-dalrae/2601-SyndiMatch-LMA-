"""
SyndiMatch - Alert Manager
Handles creation and storage of system alerts and notifications
"""

import logging
from datetime import datetime
from typing import Optional, Dict, Any
from . import db

logger = logging.getLogger(__name__)

class AlertManager:
    @staticmethod
    def create_alert(
        syndication_id: str, 
        alert_type: str, 
        severity: str, 
        message: str,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """
        Create a new alert and store it in the database
        
        Args:
            syndication_id: ID of related syndication
            alert_type: Category of alert (e.g. 'low_participation', 'payment_failed')
            severity: 'info', 'warning', 'high', 'critical'
            message: Human readable alert message
            metadata: Optional additional data
        """
        alert = {
            "syndication_id": syndication_id,
            "type": alert_type,
            "severity": severity,
            "message": message,
            "metadata": metadata or {},
            "timestamp": datetime.utcnow(),
            "status": "new",  # new, acknowledged, resolved
            "created_at": datetime.utcnow()
        }
        
        try:
            # Save to alerts collection
            db.get_collection("alerts").insert_one(alert)
            
            # Log based on severity
            log_msg = f"ALERT [{severity.upper()}]: {message} ({syndication_id})"
            if severity == "critical":
                logger.error(log_msg)
            elif severity in ["high", "warning"]:
                logger.warning(log_msg)
            else:
                logger.info(log_msg)
                
        except Exception as e:
            logger.error(f"Failed to persist alert: {e}")
