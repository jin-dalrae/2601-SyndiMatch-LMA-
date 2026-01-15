# SyndiMatch

AI-powered loan syndication platform with real-time dashboard, LangGraph multi-agent orchestration, and x402 blockchain payment integration.

## Problem

Loan syndication is slow, manual, and opaque. Originators coordinate dozens of counterparties over weeks, pricing discovery is inefficient, and operational overhead is high. Participants struggle to evaluate deals quickly and consistently while staying within portfolio and risk constraints.

## Solution

SyndiMatch automates the end-to-end workflow with specialized AI agents:

| Agent | Role |
|-------|------|
| **Originator** | Broadcasts loan opportunities with ESG scores and geographic data |
| **Participant** | Evaluates deals using LLM reasoning and submits competitive bids |
| **Negotiation** | Runs multi-round Dutch auctions to find clearing price |
| **Settlement** | Manages documentation, compliance, and signature collection |
| **Payment** | Processes x402 blockchain payments with retry logic |

A real-time dashboard surfaces pipeline status, agent decisions, and payment flows.

## Impact

- ⚡ **Faster**: Syndication timelines reduced from weeks to hours
- 👁️ **Transparent**: Full visibility into agent reasoning and pricing decisions
- 💰 **Efficient**: Lower operational cost through end-to-end automation
- 🎯 **Better Matching**: AI-driven participant selection based on risk appetite

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser UI (Vanilla JS)                  │
│  ┌──────────┐ ┌──────────────┐ ┌──────────┐ ┌───────────┐  │
│  │ Overview │ │ Orchestration│ │ Payments │ │ Analytics │  │
│  └──────────┘ └──────────────┘ └──────────┘ └───────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              Node.js API (server/index.js)                  │
│                          ↓                                  │
│                       MongoDB                               │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│           Python Agents Service (LangGraph)                 │
│  ┌────────────┐ ┌─────────────┐ ┌────────────┐             │
│  │ Originator │→│ Participants│→│ Negotiation│→ ...        │
│  └────────────┘ └─────────────┘ └────────────┘             │
└─────────────────────────────────────────────────────────────┘
```

## User Roles

| Role | Access | Key Features |
|------|--------|--------------|
| **Platform Admin** | Full system view | Simulation controls, all views |
| **Originator** | Create & track deals | Originate tab, pipeline, fee earnings |
| **Participant** | Bid on deals | Portfolio, my bids, auto-bidder |

## Quick Start (Local)

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

Create `.env` (do not commit secrets):

```bash
MONGODB_URI=mongodb://127.0.0.1:27017/syndimatch
PORT=3001

# Optional: agents service
AGENTS_SERVICE_URL=http://localhost:8000

# Optional: LLM providers
ANTHROPIC_API_KEY=your-key
GEMINI_API_KEY=your-key

# Optional: Coinbase x402
CDP_API_KEY_NAME=...
CDP_API_KEY_PRIVATE_KEY=...
CDP_NETWORK=base-sepolia
```

### 3) Start services

MongoDB must be running locally (or use Atlas).

```bash
# Terminal 1: Agents service (optional but recommended)
cd agents
python -m uvicorn server:app --host 0.0.0.0 --port 8000

# Terminal 2: Node.js API + UI
npm run dev
```

Open `http://localhost:3001`

### 4) Seed demo data (optional)

```bash
python agents/seed_all.py
```

## Demo Scenario

1. **Select Role**: Choose `[Originator] JPMorgan Chase`
2. **Create Deal**: Click `Originate` → `Quick Demo Deal` → `Create & Run`
3. **Watch Orchestration**: Switch to `Orchestration` tab to see agent workflow
4. **Track Pipeline**: Go to `Overview` to see deal progress through stages
5. **Start Simulation**: Click `▶ Start` to auto-generate additional deals

## Key Features

- **Role-Based UI**: Different navigation and views per user type
- **Real-Time Pipeline**: Kanban-style deal tracking (Open → Negotiating → Closing → Completed)
- **Agent Transparency**: Decision reasoning visible in Orchestration dashboard
- **Simulation Engine**: Time-accelerated market simulation with configurable speed
- **x402 Payments**: Mock blockchain settlement with escrow and fee processing

## API Highlights

| Endpoint | Description |
|----------|-------------|
| `GET /api/syndications` | List all syndications |
| `POST /api/syndications` | Create new syndication (originator-only) |
| `POST /api/syndications/run` | Trigger agent workflow |
| `GET /api/syndication-events` | Real-time event polling |
| `GET /api/agents/health` | Agent service status |
| `POST /api/x402/join-syndication` | Mock x402 payment |

See `server/index.js` for full API documentation.

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Production server |
| `npm run dev` | Development server with auto-reload |
| `npm run serve` | Static frontend only |

## Deployment

- Combined guide: `DEPLOYMENT.md`
- Node.js: `NODEJS_DEPLOYMENT.md`
- Cloud Run: `CLOUDRUN_DEPLOYMENT.md`
- Troubleshooting: `TROUBLESHOOTING.md`

## Security

- Never commit `.env` files with real secrets
- Use `.env.example` as a template
- Rotate any keys that were previously exposed

## License

ISC (see `package.json`)
