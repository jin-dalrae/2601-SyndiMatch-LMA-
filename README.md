# SyndiMatch

AI-powered loan syndication platform with a real-time dashboard, multi-agent orchestration, and a mock x402 payment flow.

## Problem

Loan syndication is slow, manual, and opaque. Originators coordinate dozens of counterparties over weeks, pricing discovery is inefficient, and operational overhead is high. Participants struggle to evaluate deals quickly and consistently while staying within portfolio and risk constraints.

## Solution

SyndiMatch automates the workflow with specialized AI agents that broadcast opportunities, run Dutch auctions for price discovery, and manage settlement. A real-time dashboard surfaces pipeline status, bids, and payments, while a mock x402 flow simulates blockchain-based fee collection and reconciliation.

## Impact

- Faster syndication timelines (weeks to hours).
- More transparent pricing and allocation decisions.
- Lower operational cost through end-to-end automation.
- Better matching between originators and institutional participants.

## What this repo contains

- Node.js API server that serves the frontend and reads/writes MongoDB.
- Python FastAPI agents service (LangGraph/LangChain) for orchestration.
- Vanilla JS dashboard UI with live pipeline, analytics, and payments views.

## Architecture

```
Browser UI
  ↓
Node.js API (server/index.js) ── MongoDB
  ↓
Python Agents Service (agents/server.py)
```

## Quick start (local)

### 1) Install dependencies

```bash
npm install
```

Optional (agents service):

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r agents/requirements.txt
```

### 2) Configure environment

Create or update `.env` (do not commit secrets):

```bash
MONGODB_URI=mongodb://127.0.0.1:27017/syndimatch
PORT=3001

# Optional: point Node.js to the agents service
AGENTS_SERVICE_URL=http://localhost:8000

# Optional: enable Gemini reports
GEMINI_API_KEY=your-key

# Optional: Coinbase/CDP config (used by agents/x402 client)
CDP_API_KEY_NAME=...
CDP_API_KEY_PRIVATE_KEY=...
CDP_NETWORK=base-sepolia
```

### 3) Start services

MongoDB must be running locally (or use Atlas in `MONGODB_URI`).

Start the agents service (optional but recommended for orchestration):

```bash
cd agents
python -m uvicorn server:app --host 0.0.0.0 --port 8000
```

Start the Node.js API + UI:

```bash
npm start
```

Open `http://localhost:3001`.

### 4) Seed demo data (optional)

```bash
python agents/seed_all.py
```

Or:

```bash
./scripts/seed-db.sh
```

### 5) Smoke tests (optional)

```bash
./scripts/smoke-node.sh
./scripts/smoke-agents.sh
```

## Scripts

- `npm start` / `npm run dev`: run the Node.js server.
- `npm run serve`: serve the frontend statically (no API).

## Demo mode

Use the “Demo” toggle in the header to force mock data when the backend isn’t running. The setting is stored in local storage and skips API calls until turned off.

## API highlights

- `GET /api/health`
- `GET /api/ready`
- `GET /api/syndications`
- `POST /api/syndications` (originator-only)
- `POST /api/syndications/run` (calls agents service)
- `GET /api/agents/health`
- `POST /api/x402/join-syndication` (mock x402 flow)

See `server/index.js` for the full list.

## Deployment notes

- Node.js deployment guide: `NODEJS_DEPLOYMENT.md`
- Cloud Run troubleshooting: `TROUBLESHOOTING.md`
- Quick fixes: `QUICK_FIX.md`

## License

ISC (see `package.json`)
