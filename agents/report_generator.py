"""
SyndiMatch - AI Report Generator
Uses Google Gemini for fast report generation
"""

import os
import httpx
from datetime import datetime
from typing import Dict, Any, List, Optional
import logging
import json

logger = logging.getLogger(__name__)

# Gemini API Configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = "gemini-2.0-flash-exp"
GEMINI_ENDPOINT = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"


class ReportGenerator:
    """
    AI-powered report generator using Google Gemini.
    Generates:
    - Bidding reasons (<50 words)
    - Selection reasons
    - Syndication introductions
    - Quarterly reports
    """
    
    def __init__(self):
        self.api_key = GEMINI_API_KEY
        self.demo_mode = not self.api_key or self.api_key == "your_gemini_api_key_here"
        
        if self.demo_mode:
            logger.warning("ReportGenerator running in DEMO mode - generating mock reports")
    
    async def _call_gemini(self, prompt: str, max_tokens: int = 100) -> str:
        """Make API call to Gemini (Async)"""
        if self.demo_mode:
            logger.info(f"[ReportGenerator Demo] Prompt: {prompt[:100]}...")
            return self._generate_mock_response(prompt)
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{GEMINI_ENDPOINT}?key={self.api_key}",
                    json={
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {
                            "maxOutputTokens": max_tokens,
                            "temperature": 0.7
                        }
                    },
                    timeout=30.0
                )
                response.raise_for_status()
                data = response.json()
                return data["candidates"][0]["content"]["parts"][0]["text"]
        except Exception as e:
            logger.error(f"Gemini API error (async): {e}")
            return self._generate_mock_response(prompt)
    
    def _call_gemini_sync(self, prompt: str, max_tokens: int = 100) -> str:
        """Synchronous Gemini call"""
        if self.demo_mode:
            # Log prompt in demo mode for transparency
            logger.info(f"[ReportGenerator Demo] Prompt: {prompt[:100]}...")
            return self._generate_mock_response(prompt)
        
        try:
            # Use a context manager for httpx.Client to ensure proper cleanup
            with httpx.Client() as client:
                response = client.post(
                    f"{GEMINI_ENDPOINT}?key={self.api_key}",
                    json={
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {
                            "maxOutputTokens": max_tokens,
                            "temperature": 0.7
                        }
                    },
                    timeout=30.0
                )
                response.raise_for_status()
                data = response.json()
                return data["candidates"][0]["content"]["parts"][0]["text"]
        except Exception as e:
            logger.error(f"Gemini API error (sync): {e}")
            return self._generate_mock_response(prompt)
    
    def _generate_mock_response(self, prompt: str) -> str:
        """Generate mock response for demo mode - all under 50 words"""
        if "bidding reason" in prompt.lower():
            return "Strong 9.2% yield meets threshold. Healthcare sector aligns with portfolio. Conservative allocation within limits."
        elif "selection" in prompt.lower():
            return "Competitive spread bid with 100% on-time payment history. Strategic relationship value with originator justified allocation."
        elif "introduction" in prompt.lower():
            return "Premium LBO from JPMorgan. BB+ tech borrower with stable cash flows. 420bps spread, $400M target."
        elif "quarterly" in prompt.lower():
            return "Q4: 12 deals closed, $3.2B volume. 42% win rate, 385bps avg spread. Top: Apollo (89 wins). Platform revenue: $3.2M."
        elif "decision" in prompt.lower():
            return "I evaluated the risk-reward profile and determined this opportunity fits our investment mandate."
        return "Report generated."
    
    def generate_bidding_reason(
        self,
        participant_profile: Dict[str, Any],
        syndication: Dict[str, Any],
        bid_amount: int,
        spread: int
    ) -> str:
        """Generate <50 word bidding reason."""
        prompt = f"""Write exactly 1-2 sentences (under 50 words) explaining why this investor is bidding.

Investor: {participant_profile.get('institution', {}).get('name', 'Fund')} ({participant_profile.get('institution', {}).get('type', 'Fund')})
Target yield: {participant_profile.get('risk_appetite', {}).get('target_all_in_yield', 8)}%

Loan: {syndication.get('loan_details', {}).get('borrower_name', 'Company')} | {syndication.get('loan_details', {}).get('industry', 'Sector')} | {syndication.get('loan_details', {}).get('credit_rating', 'BB')} rated | {spread}bps spread | ${bid_amount:,} bid

Be specific and concise. No labels."""

        return self._call_gemini_sync(prompt, max_tokens=60)
    
    def generate_selection_reason(
        self,
        participant_profile: Dict[str, Any],
        allocation: Dict[str, Any],
        syndication: Dict[str, Any]
    ) -> str:
        """Generate <50 word selection reason."""
        prompt = f"""Write 1-2 sentences (under 50 words) explaining why this participant was selected.

Selected: {allocation.get('institution_name', 'Investor')}
Allocated: ${allocation.get('final_allocation', 0):,} of ${allocation.get('original_bid_amount', 0):,} bid
Method: {allocation.get('allocation_method', 'market clearing')}
Spread: {allocation.get('final_spread', 0)}bps

Be specific. No labels."""

        return self._call_gemini_sync(prompt, max_tokens=60)
    
    def generate_syndication_introduction(self, syndication: Dict[str, Any]) -> str:
        """Generate <50 word syndication intro."""
        loan = syndication.get('loan_details', {})
        pricing = syndication.get('pricing', {})
        
        prompt = f"""Write 1-2 sentences (under 50 words) introducing this loan opportunity.

{syndication.get('originator', 'Bank')} | {loan.get('borrower_name', 'Company')} | {loan.get('industry', 'Sector')} | {loan.get('loan_type', 'Loan')} | {loan.get('credit_rating', 'BBB')} | ${loan.get('syndication_target', 0):,} target | {pricing.get('initial_spread', 400)}bps

Compelling but factual. No headers."""

        return self._call_gemini_sync(prompt, max_tokens=60)
    
    def generate_quarterly_report(
        self,
        syndications: List[Dict[str, Any]],
        participants: List[Dict[str, Any]],
        quarter: str = "Q4 2024"
    ) -> str:
        """Generate <50 word quarterly summary."""
        completed = [s for s in syndications if s.get('status') == 'completed']
        total_volume = sum(s.get('loan_details', {}).get('total_amount', 0) for s in completed)
        
        prompt = f"""{quarter} summary in under 50 words:
- Closed: {len(completed)} deals
- Volume: ${total_volume:,}
- Participants: {len(participants)} active

Include key metrics only. No headers."""

        return self._call_gemini_sync(prompt, max_tokens=60)
    
    def generate_agent_decision_report(
        self,
        agent_type: str,
        agent_id: str,
        action: str,
        context: Dict[str, Any]
    ) -> str:
        """
        Generate a brief report explaining an agent's decision.
        """
        # Handle JSON truncation safely
        context_str = json.dumps(context, default=str)
        if len(context_str) > 500:
            context_str = context_str[:500].rsplit("}", 1)[0] + "}"
            
        prompt = f"""Generate a brief AI agent decision report (under 40 words).
 
Agent: {agent_type} ({agent_id})
Action: {action}
Context: {context_str}
 
Explain the reasoning concisely in first person ("I decided...")."""
 
        return self._call_gemini_sync(prompt, max_tokens=80)


# Singleton instance
report_generator = ReportGenerator()


# Convenience functions with type hints
def generate_bidding_reason(participant: Dict[str, Any], syndication: Dict[str, Any], amount: int, spread: int) -> str:
    return report_generator.generate_bidding_reason(participant, syndication, amount, spread)
 
def generate_selection_reason(participant: Dict[str, Any], allocation: Dict[str, Any], syndication: Dict[str, Any]) -> str:
    return report_generator.generate_selection_reason(participant, allocation, syndication)
 
def generate_syndication_intro(syndication: Dict[str, Any]) -> str:
    return report_generator.generate_syndication_introduction(syndication)
 
def generate_quarterly_report(syndications: List[Dict[str, Any]], participants: List[Dict[str, Any]], quarter: str = "Q4 2024") -> str:
    return report_generator.generate_quarterly_report(syndications, participants, quarter)
