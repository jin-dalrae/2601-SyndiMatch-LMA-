"""
<<<<<<< HEAD
SyndiMatch Alert Manager
Monitors thresholds and creates alerts for critical events
"""

from typing import Dict, Any, Literal
from datetime import datetime
import logging

import db

logger = logging.getLogger(__name__)

AlertSeverity = Literal["critical", "high", "warning", "info"]
AlertType = Literal[
    "low_participation",
    "auction_failing", 
    "payment_failed",
    "settlement_failure",
    "syndication_failed",
    "incomplete_payment_collection",
    "threshold_breach"
]


class AlertManager:
    """Manage alerts for syndication workflow monitoring"""
    
    # Configurable thresholds
    THRESHOLDS = {
        "min_bids": 3,
        "min_subscription_rate": 0.80,
        "payment_collection_target": 0.95,
        "max_payment_retries": 3,
        "settlement_timeout_hours": 48
    }
    
    @staticmethod
    def create_alert(
        syndication_id: str,
        alert_type: str,
        severity: AlertSeverity,
        message: str,
        details: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Create and store an alert"""
        alert = {
            "syndication_id": syndication_id,
            "alert_type": alert_type,
            "severity": severity,
            "message": message,
            "details": details or {},
            "created_at": datetime.utcnow(),
            "acknowledged": False,
            "resolved": False
        }
        
        # Store in database
        result = db.get_collection("alerts").insert_one(alert)
        alert["_id"] = str(result.inserted_id)
        
        # Log based on severity
        log_msg = f"[ALERT:{severity.upper()}] {syndication_id} - {message}"
        if severity == "critical":
            logger.critical(log_msg)
        elif severity == "high":
            logger.error(log_msg)
        elif severity == "warning":
            logger.warning(log_msg)
        else:
            logger.info(log_msg)
        
        return alert
    
    @staticmethod
    def acknowledge_alert(alert_id: str, acknowledged_by: str = None) -> bool:
        """Mark an alert as acknowledged"""
        result = db.get_collection("alerts").update_one(
            {"_id": alert_id},
            {
                "$set": {
                    "acknowledged": True,
                    "acknowledged_at": datetime.utcnow(),
                    "acknowledged_by": acknowledged_by
                }
            }
        )
        return result.modified_count > 0
    
    @staticmethod
    def resolve_alert(alert_id: str, resolution: str = None) -> bool:
        """Mark an alert as resolved"""
        result = db.get_collection("alerts").update_one(
            {"_id": alert_id},
            {
                "$set": {
                    "resolved": True,
                    "resolved_at": datetime.utcnow(),
                    "resolution": resolution
                }
            }
        )
        return result.modified_count > 0
    
    @staticmethod
    def get_active_alerts(syndication_id: str = None) -> list:
        """Get all unresolved alerts, optionally filtered by syndication"""
        query = {"resolved": False}
        if syndication_id:
            query["syndication_id"] = syndication_id
        
        return list(db.get_collection("alerts").find(query).sort("created_at", -1))
    
    @staticmethod
    def get_alerts_by_severity(severity: AlertSeverity) -> list:
        """Get all alerts of a specific severity"""
        return list(db.get_collection("alerts").find(
            {"severity": severity, "resolved": False}
        ).sort("created_at", -1))
    
    @staticmethod
    def check_thresholds(state: Dict[str, Any]) -> list:
        """Check state against thresholds and create alerts if breached"""
        alerts_created = []
        syndication_id = state.get("syndication_id", "unknown")
        
        # Check bid count
        bids = state.get("bids", [])
        if len(bids) < AlertManager.THRESHOLDS["min_bids"]:
            alert = AlertManager.create_alert(
                syndication_id=syndication_id,
                alert_type="low_participation",
                severity="warning",
                message=f"Only {len(bids)} bids received (minimum: {AlertManager.THRESHOLDS['min_bids']})"
            )
            alerts_created.append(alert)
        
        # Check subscription rate
        subscription_rate = state.get("negotiation_state", {}).get("subscription_rate", 0)
        if 0 < subscription_rate < AlertManager.THRESHOLDS["min_subscription_rate"]:
            alert = AlertManager.create_alert(
                syndication_id=syndication_id,
                alert_type="auction_failing",
                severity="high",
                message=f"Subscription rate {subscription_rate*100:.1f}% below minimum {AlertManager.THRESHOLDS['min_subscription_rate']*100:.0f}%"
            )
            alerts_created.append(alert)
        
        return alerts_created
    
    @staticmethod
    def get_alert_summary() -> Dict[str, Any]:
        """Get summary of all alerts for dashboard"""
        alerts = list(db.get_collection("alerts").find({"resolved": False}))
        
        by_severity = {"critical": 0, "high": 0, "warning": 0, "info": 0}
        for alert in alerts:
            severity = alert.get("severity", "info")
            if severity in by_severity:
                by_severity[severity] += 1
        
        return {
            "total_active": len(alerts),
            "by_severity": by_severity,
            "requires_immediate_action": by_severity["critical"] + by_severity["high"]
        }
=======
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
>>>>>>> syndication-change
