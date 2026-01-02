"""
SyndiMatch - Coinbase x402 Integration
Payment processing via Coinbase CDP SDK on Base L2

Real integration with:
- Base Sepolia (testnet) or Base Mainnet
- Gasless USDC transfers
- CDP Account management
"""

import os
import hashlib
import secrets
from datetime import datetime
from typing import Dict, Any, Optional, Literal
from dataclasses import dataclass
from enum import Enum
import asyncio
import db
from config import (
    CDP_API_KEY_NAME, CDP_API_KEY_PRIVATE_KEY, CDP_NETWORK,
    COINBASE_API_KEY, COINBASE_API_SECRET
)
import logging

logger = logging.getLogger(__name__)

# Try to import CDP SDK (v1.35+)
try:
    from cdp import CdpClient, EvmServerAccount
    CDP_AVAILABLE = True
except ImportError:
    CDP_AVAILABLE = False
    logger.warning("CDP SDK not installed. Install with: pip install cdp-sdk")


class PaymentStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    CONFIRMED = "confirmed"
    FAILED = "failed"


class Network(str, Enum):
    BASE = "base"  # Base L2 mainnet
    BASE_SEPOLIA = "base-sepolia"  # Base L2 testnet
    ETHEREUM = "ethereum"
    POLYGON = "polygon"


@dataclass
class PaymentResult:
    """Result of a payment transaction"""
    transaction_id: str
    transaction_hash: str
    status: PaymentStatus
    amount: int
    currency: str
    network: Network
    gas_used: float
    gas_currency: str
    confirmation_blocks: int
    from_address: str
    to_address: str
    metadata: Dict[str, Any]
    timestamp: datetime
    error: Optional[str] = None


class CoinbaseX402Client:
    """
    Coinbase CDP SDK Client for SyndiMatch payments.
    
    Features:
    - Real USDC transfers on Base L2
    - Gasless transactions (Coinbase covers gas)
    - Automatic account management
    - Testnet (Base Sepolia) support
    """
    
    USDC_CONTRACTS = {
        "base-sepolia": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        "base": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
    }
    
    def __init__(
        self,
        api_key_name: Optional[str] = None,
        api_key_private_key: Optional[str] = None,
        network: str = "base-sepolia"
    ):
        self.api_key_name = api_key_name or CDP_API_KEY_NAME
        self.api_key_private_key = api_key_private_key or CDP_API_KEY_PRIVATE_KEY
        self.network = network or CDP_NETWORK
        
        self.demo_mode = not CDP_AVAILABLE or not self.api_key_name
        self.client = None
        self.account = None
        
        if self.demo_mode:
            logger.warning("x402 Client running in DEMO mode - install cdp-sdk and configure API keys for real transactions")
        else:
            self._initialize_cdp()
    
    async def initialize(self):
        """Async initialization of CDP SDK and account"""
        if self.demo_mode or self.client:
            return
            
        try:
            # Create CDP client with API credentials
            self.client = CdpClient(
                api_key_id=self.api_key_name,
                api_key_secret=self.api_key_private_key
            )
            
            # Create or load EVM account
            self.account = await self.client.evm.create_account(
                name="syndimatch-platform"
            )
            
            logger.info(f"CDP Account ready: {self.account.address[:16]}... on {self.network}")
                    
        except Exception as e:
            logger.error(f"CDP initialization failed: {e}")
            self.demo_mode = True

    def _initialize_cdp(self):
        """Legacy sync init - now just triggers async via run if possible"""
        # This is primarily for backward compatibility during instantiation 
        # Real initialization should happen via await client.initialize()
        pass
    
    async def create_payment(
        self,
        to_address: str,
        amount: int,
        from_address: Optional[str] = None,
        currency: str = "usdc",
        network: Optional[Network] = None,
        metadata: Optional[Dict[str, Any]] = None,
        gasless: bool = True
    ) -> PaymentResult:
        """
        Create and execute a payment transaction.
        Transfers FROM the configured CDP Account by default.
        """
        # Ensure initialized
        if not self.client and not self.demo_mode:
            await self.initialize()

        nw = network or Network(self.network)
        from_addr = from_address or (self.account.address if self.account else "0x_vault")
        
        logger.info(f"Creating x402 payment: {amount} {currency} to {to_address} on {nw.value}")
        
        if self.demo_mode:
            return self._simulate_payment(from_addr, to_address, amount, currency, nw, metadata)
        
        try:
            # 1. Asset identifier (usually 'usdc')
            asset_id = currency.lower()
            
            # 2. Execute Transfer
            # Note: 1.35.0 uses to, amount, token, network
            transfer = await self.account.transfer(
                to=to_address,
                amount=amount,
                token=asset_id,
                network=nw.value
            )
            
            # 3. Wait for transaction hash
            
            # 4. Construct Result
            tx_hash = transfer.transaction_hash
            status = PaymentStatus.PENDING
            if transfer.status == "complete":
                status = PaymentStatus.CONFIRMED
            elif transfer.status == "failed":
                status = PaymentStatus.FAILED
                
            return PaymentResult(
                transaction_id=transfer.transfer_id,
                transaction_hash=tx_hash,
                status=status,
                amount=amount,
                currency=currency,
                network=network,
                gas_used=0.0, # CDP SDK might abstract this
                gas_currency="ETH",
                confirmation_blocks=0,
                from_address=self.account.address,
                to_address=to_address,
                metadata=metadata or {},
                timestamp=datetime.utcnow()
            )
            
        except Exception as e:
            logger.error(f"CDP Transfer failed: {e}")
            return PaymentResult(
                transaction_id=f"failed-{secrets.token_hex(8)}",
                transaction_hash="",
                status=PaymentStatus.FAILED,
                amount=amount,
                currency=currency,
                network=network,
                gas_used=0,
                gas_currency="ETH",
                confirmation_blocks=0,
                from_address=from_address,
                to_address=to_address,
                metadata=metadata or {},
                timestamp=datetime.utcnow(),
                error=str(e)
            )
    
    def _simulate_payment(
        self,
        from_address: str,
        to_address: str,
        amount: int,
        currency: str,
        network: Network,
        metadata: Optional[Dict[str, Any]]
    ) -> PaymentResult:
        """Simulate a payment for demo/testing"""
        
        # Generate deterministic but unique hashes
        tx_data = f"{from_address}:{to_address}:{amount}:{datetime.utcnow().isoformat()}"
        tx_hash = "0x" + hashlib.sha256(tx_data.encode()).hexdigest()
        tx_id = f"x402-tx-{secrets.token_hex(12)}"
        
        # Simulate realistic gas costs for Base L2
        gas_used = 0.00001 + secrets.randbelow(100) * 0.0000001  # ~$0.01-0.02
        
        logger.info(f"[DEMO] x402 Transaction simulated: {tx_hash[:20]}...")
        
        return PaymentResult(
            transaction_id=tx_id,
            transaction_hash=tx_hash,
            status=PaymentStatus.CONFIRMED,
            amount=amount,
            currency=currency,
            network=network,
            gas_used=round(gas_used, 8),
            gas_currency="ETH",
            confirmation_blocks=12,  # Base L2 ~2 seconds per block
            from_address=from_address,
            to_address=to_address,
            metadata=metadata or {},
            timestamp=datetime.utcnow()
        )
    
    async def create_escrow(
        self,
        escrow_id: str,
        total_amount: int,
        currency: str = "USDC",
        release_conditions: list[str] = None
    ) -> Dict[str, Any]:
        """
        Create an escrow account for a syndication.
        
        Args:
            escrow_id: Unique identifier for the escrow
            total_amount: Maximum amount to be held
            currency: Currency for the escrow
            release_conditions: Conditions that must be met for release
        
        Returns:
            Escrow details including wallet address
        """
        wallet_address = f"escrow-{escrow_id}-wallet"
        
        if self.demo_mode:
            return {
                "escrow_id": escrow_id,
                "wallet_address": wallet_address,
                "total_amount": total_amount,
                "current_balance": 0,
                "currency": currency,
                "network": Network.BASE.value,
                "status": "active",
                "release_conditions": release_conditions or [
                    "all_signatures_collected",
                    "all_compliance_checks_passed",
                    "funding_date_reached"
                ],
                "created_at": datetime.utcnow().isoformat()
            }
        
        # Real API call
        response = await self.client.post("/escrows", json={
            "escrow_id": escrow_id,
            "total_amount": str(total_amount),
            "currency": currency,
            "release_conditions": release_conditions or []
        })
        return response.json()
    
    async def release_escrow(
        self,
        escrow_id: str,
        to_address: str,
        amount: int
    ) -> PaymentResult:
        """
        Release funds from escrow to recipient.
        
        Args:
            escrow_id: The escrow to release from
            to_address: Recipient address (usually borrower)
            amount: Amount to release
        
        Returns:
            PaymentResult for the release transaction
        """
        escrow_wallet = f"escrow-{escrow_id}-wallet"
        
        return await self.create_payment(
            from_address=escrow_wallet,
            to_address=to_address,
            amount=amount,
            currency="USDC",
            network=Network.BASE,
            metadata={
                "type": "escrow_release",
                "escrow_id": escrow_id
            }
        )
    
    async def get_transaction_status(self, transaction_id: str) -> Dict[str, Any]:
        """Get the current status of a transaction"""
        if self.demo_mode:
            return {
                "transaction_id": transaction_id,
                "status": "confirmed",
                "confirmations": 12,
                "finalized": True
            }
        
        response = await self.client.get(f"/transactions/{transaction_id}")
        return response.json()
    
    async def get_wallet_balance(self, wallet_address: str) -> Dict[str, Any]:
        """Get balance for a wallet address"""
        if self.demo_mode:
            return {
                "wallet_address": wallet_address,
                "balances": {
                    "USDC": random.randint(0, 1000000000),
                    "ETH": round(random.uniform(0, 10), 6)
                }
            }
        
        response = await self.client.get(f"/wallets/{wallet_address}/balance")
        return response.json()
    
    def close(self):
        """Close the HTTP client"""
        if self.client:
            self.client.close()


# Synchronous wrapper for non-async contexts
class X402Client:
    """Synchronous wrapper for CoinbaseX402Client"""
    
    def __init__(self, api_key: Optional[str] = None, api_secret: Optional[str] = None):
        self.api_key = api_key or COINBASE_API_KEY
        self.api_secret = api_secret or COINBASE_API_SECRET
        
        # Use the async client internally
        self.async_client = CoinbaseX402Client()
        self.demo_mode = self.async_client.demo_mode
        
        if self.demo_mode:
            logger.warning("x402 Client running in DEMO mode")
        else:
            logger.info(f"x402 Client initialized in REAL mode on {self.async_client.network}")

    @property
    def account(self):
        return self.async_client.account

    @property
    def network(self):
        return self.async_client.network
    
    def create_payment(
        self,
        from_address: str,
        to_address: str,
        amount: int,
        currency: str = "USDC",
        network: str = "base-sepolia",
        metadata: Optional[Dict[str, Any]] = None
    ) -> PaymentResult:
        """Synchronous payment creation using async client"""
        # Ensure we use keyword arguments for the internal async call
        args = {
            "from_address": from_address,
            "to_address": to_address,
            "amount": amount,
            "currency": currency,
            "network": Network(network),
            "metadata": metadata
        }
        
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                return asyncio.run_coroutine_threadsafe(
                    self.async_client.create_payment(**args), loop
                ).result()
        except RuntimeError:
            pass
            
        return asyncio.run(self.async_client.create_payment(**args))
    
    def send_payment(
        self,
        from_wallet: str,
        to_wallet: str,
        amount: int,
        currency: str = "USDC"
    ) -> str:
        """Simple send payment, returns transaction hash"""
        result = self.create_payment(from_wallet, to_wallet, amount, currency)
        return result.transaction_hash
    
    def collect_commitment_fee(
        self,
        participant_wallet: str,
        platform_wallet: str,
        commitment_amount: int,
        fee_percentage: float = 0.5
    ) -> PaymentResult:
        """
        Collect commitment fee when participant joins syndication.
        Standard fee: 0.5% of committed amount
        """
        fee_amount = int(commitment_amount * fee_percentage / 100)
        
        return self.create_payment(
            from_address=participant_wallet,
            to_address=platform_wallet,
            amount=fee_amount,
            currency="USDC",
            network="base",
            metadata={"type": "commitment_fee", "commitment_amount": commitment_amount}
        )
    
    def collect_break_fee(
        self,
        participant_wallet: str,
        originator_wallet: str,
        committed_amount: int,
        penalty_percentage: float = 0.2
    ) -> PaymentResult:
        """
        Collect break-up penalty when participant drops out.
        Default: 0.2% of committed amount
        """
        penalty_amount = int(committed_amount * penalty_percentage / 100)
        
        logger.warning(f"Break fee triggered: ${penalty_amount:,} from {participant_wallet[:16]}...")
        
        return self.create_payment(
            from_address=participant_wallet,
            to_address=originator_wallet,
            amount=penalty_amount,
            currency="USDC",
            network="base",
            metadata={"type": "break_fee", "committed_amount": committed_amount}
        )
    
    def deposit_to_escrow(
        self,
        from_wallet: str,
        escrow_id: str,
        amount: int
    ) -> PaymentResult:
        """
        Deposit funds to syndication escrow account.
        Funds held until all docs signed.
        """
        escrow_wallet = f"escrow-{escrow_id}-wallet"
        
        return self.create_payment(
            from_address=from_wallet,
            to_address=escrow_wallet,
            amount=amount,
            currency="USDC",
            network="base",
            metadata={"type": "escrow_deposit", "escrow_id": escrow_id}
        )
    
    def release_escrow(
        self,
        escrow_id: str,
        borrower_wallet: str,
        total_amount: int,
        platform_fee_pct: float = 0.1
    ) -> tuple[PaymentResult, PaymentResult]:
        """
        Release escrow funds to borrower, collecting platform fee.
        """
        platform_wallet = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e" # Platform vault address
        
        # Calculate platform fee
        platform_fee = int(total_amount * platform_fee_pct / 100)
        borrower_amount = total_amount - platform_fee
        
        # Pay borrower
        borrower_payment = self.create_payment(
            to_address=borrower_wallet,
            amount=borrower_amount,
            metadata={"type": "escrow_release", "escrow_id": escrow_id}
        )
        
        # Collect platform fee
        platform_payment = self.create_payment(
            to_address=platform_wallet,
            amount=platform_fee,
            metadata={"type": "platform_fee", "escrow_id": escrow_id}
        )
        
        return borrower_payment, platform_payment
    
    def issue_invoice(
        self,
        to_wallet: str,
        amount: int,
        due_date: datetime,
        invoice_type: str,
        syndication_id: str
    ) -> Dict[str, Any]:
        """
        Issue an x402 invoice (for penalties, late fees, etc.)
        Participant can pay via HTTP response.
        """
        invoice_id = f"INV-{syndication_id.split('-')[-1]}-{secrets.token_hex(4)}"
        
        invoice = {
            "invoice_id": invoice_id,
            "to_wallet": to_wallet,
            "amount": amount,
            "currency": "USDC",
            "network": "base",
            "due_date": due_date.isoformat(),
            "invoice_type": invoice_type,
            "syndication_id": syndication_id,
            "status": "pending",
            "payment_url": f"https://pay.syndimatch.com/invoice/{invoice_id}",
            "created_at": datetime.utcnow().isoformat()
        }
        
        logger.info(f"Invoice issued: {invoice_id} for ${amount:,}")
        
        return invoice


# Module-level instance for easy imports (async)
x402 = CoinbaseX402Client()
sync_x402 = X402Client()
