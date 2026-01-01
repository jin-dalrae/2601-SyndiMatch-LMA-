# Coinbase x402 Testnet Setup Guide

This guide shows how to connect SyndiMatch to Coinbase CDP for real USDC payments on Base Sepolia testnet.

## 1. Create CDP API Keys

1. Go to [Coinbase Developer Portal](https://portal.cdp.coinbase.com/)
2. Create a new project
3. Generate API keys (API Key Name + API Key Secret)
4. Download the JSON key file

## 2. Install CDP Python SDK

```bash
cd /Users/rae/Downloads/Developed/2601\ SyndiMatch\(LMA\)/agents
pip install cdp-sdk
```

## 3. Get Testnet Funds

### Option A: CDP Faucet (Recommended)
The SDK has built-in faucet support:
```python
from cdp import Cdp, Wallet

# Initialize CDP
Cdp.configure_from_json("path/to/cdp_api_key.json")

# Create wallet
wallet = Wallet.create(network_id="base-sepolia")

# Get testnet ETH for gas
faucet_tx = wallet.faucet()
print(f"Faucet TX: {faucet_tx.transaction_hash}")

# Get testnet USDC (gasless on Base!)
usdc_faucet = wallet.faucet(asset_id="usdc")
```

### Option B: Circle Faucet
Visit [faucet.circle.com](https://faucet.circle.com/) and request USDC for Base Sepolia.

## 4. Configure Environment

Update `.env` file:
```bash
# CDP Configuration
CDP_API_KEY_NAME=your_key_name
CDP_API_KEY_PRIVATE_KEY=your_private_key
CDP_WALLET_DATA=path/to/wallet_seed.json

# Network (testnet or mainnet)
CDP_NETWORK=base-sepolia  # For testing
# CDP_NETWORK=base-mainnet  # For production
```

## 5. USDC Contract Addresses

| Network | USDC Contract |
|---------|---------------|
| Base Sepolia (Testnet) | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| Base Mainnet | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

## 6. Gasless USDC Transfers

Coinbase covers gas fees for USDC transfers on Base! Use:
```python
transfer = wallet.transfer(
    amount=100,  # 100 USDC
    asset_id="usdc",
    destination="0xRecipientAddress",
    gasless=True  # Coinbase pays gas!
)
```

## 7. Key Limitations

- **Testnet**: Not real money, for testing only
- **Rate Limits**: CDP has API rate limits
- **Wallet Management**: Store wallet seeds securely
- **Gasless**: Only works for USDC on Base

## 8. Run the Payment Agent

```bash
cd agents
python3 -c "
from x402_client import X402Client
client = X402Client()
print('Demo mode:', client.demo_mode)
"
```

Once you configure real API keys, `demo_mode` will be `False` and real transactions will execute.
