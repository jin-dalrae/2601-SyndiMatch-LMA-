# SyndiMatch

AI-native loan syndication platform. Three-role demo (Platform Admin, Originator, Participant) over a Node API and a Python LangGraph agent service backed by MongoDB. Includes mock x402 micropayments and a built-in market simulation.

Business case lives in [PITCH_DECK.md](PITCH_DECK.md) and [PROJECT_DESCRIPTION.md](PROJECT_DESCRIPTION.md). This README covers what the code does and how to run it.

---

## Status

What works on `refactor/main` @ `f005f5c`, verified by clicking through a fresh local boot:

- Landing page → Platform Admin overview with seeded syndications in the pipeline
- Originator dashboard: create-and-announce form POSTs to `/api/syndications`, persists to MongoDB, UI updates
- Participant dashboard: 10 available deals (mix of seeded + client-side simulated), quick-bid buttons
- Python agents service boots in `SIMULATION_MODE` (no Anthropic / Gemini keys required)

Known issues, not blocking the demo:

- `GET /api/analytics/platform` returns 404; polled every 10s
- `POST /api/agents/bid` is flaky (~40% 502 rate via Node→Python proxy)
- Metrics bar (`47 Active Participants / $550M / 94.2% Success`) is hardcoded HTML
- `/api/all-data` merge logic duplicates syndications (matches on `_id` vs `id` inconsistently)
- Frontend mixes real API data with client-side `SimulationEngine` data, two sources of truth

A refactor branch is in flight to address these — see [Roadmap](#roadmap).

---

## Quick start (local dev)

Prereqs: Node 18+, Python 3.10+, `mongod` (e.g. `brew install mongodb-community`).

```bash
# 1. MongoDB
brew services start mongodb-community

# 2. Node deps + Python venv
npm install
python3 -m venv .venv
.venv/bin/pip install -r agents/requirements.txt

# 3. Env (defaults point at localhost; no API keys required for the demo)
cp .env.example .env

# 4. Seed the database (canonical seeder — populates both collection name patterns)
.venv/bin/python agents/seed_all.py

# 5. Start the Node API on :3001
npm run dev

# 6. In a second shell, start the Python agents service on :8000
.venv/bin/python -m uvicorn agents.server:app --host 0.0.0.0 --port 8000

# 7. Open http://localhost:3001
```

Smoke tests once everything is up:

```bash
./scripts/smoke-node.sh     # checks Node /api/health + /api/ready
./scripts/smoke-agents.sh   # checks Python /api/health + /api/ready
```

### Notes

- `agents/seed_all.py` is the canonical seeder. It writes to both legacy (`participant_agents`, `originator_agents`, `syndications`) and current (`participants`, `originator`, `syndication_original`) collection names. Running `server/seed.js` alone is **not** enough — the Node API reads from the current-name collections, which only the Python seed populates.
- Node always uses DB name `syndimatch` (hardcoded in `server/db.js`). The Python config defaults to `syndimatch_dev` when `ENVIRONMENT=development`, so `.env.example` pins `DATABASE_NAME=syndimatch` to keep both services on the same DB.
- The agents service uses package-relative imports (`from .orchestrator`). Run it as `uvicorn agents.server:app` from the repo root, not `uvicorn server:app` from inside `agents/`. The included `agents/start.sh` detects context and picks the right form.
- No LLM keys are required to demo. `agents/config.py` sets `SIMULATION_MODE = True` whenever `ANTHROPIC_API_KEY` is unset, which short-circuits all real LLM calls to deterministic stubs.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (vanilla JS, 31 globals loaded via <script> tags)  │
│  index.html + js/ + styles/                                 │
└─────────────────────────────────────────────────────────────┘
                              │ fetch
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Node API  (Express 5 + MongoDB)                            │
│  server/index.js — all routes in one file (903 LOC)         │
│    /api/syndications, /api/participants, /api/originators   │
│    /api/x402/* (mock USDC payment flow on Base)             │
│    /api/agents/* (proxy to Python service)                  │
└─────────────────────────────────────────────────────────────┘
                              │ fetch (AGENTS_SERVICE_URL)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Python agents  (FastAPI + LangGraph)                       │
│  agents/server.py                                           │
│    OriginatorAgent — structures deals                       │
│    ParticipantAgent — evaluates and bids                    │
│    NegotiationAgent — multi-round Dutch auction             │
│    SettlementAgent — allocation + docs                      │
│    PaymentAgent — x402 fee flow                             │
│  SIMULATION_MODE skips real Anthropic/Gemini calls          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                       MongoDB (syndimatch)
```

### Roles

The role dropdown (top right) swaps the active view and feature set. Selector values come from `index.html:38-58`.

| Role | Value | Default view |
|------|-------|--------------|
| Platform Admin | `platform` | Command Center: live pipeline, agents, simulation controls |
| Originator (8 banks) | `originator:OA-001` … `OA-008` | Originator Dashboard: create deals, fee collection |
| Participant (8 institutions) | `participant:PA-001` … `PA-103` | Participant Dashboard: available deals, bid mgmt, portfolio |

### Demo flow

1. Open `http://localhost:3001` and click **Enter Platform** on the landing page.
2. Select an originator (e.g. `[Originator] JPMorgan Chase`). Click **Originate**.
3. Fill the form (or use **Randomize**) and click **Create & Announce**. The deal lands in MongoDB and appears in **Active Syndications** below.
4. Switch the role to a participant (e.g. `[Participant] Apollo Global`). Browse **Available Deals**.
5. Switch back to **Platform Admin** to see the simulation engine ticking through the pipeline.

---

## Project layout

```
.
├── index.html                 # SPA entry, loads 31 JS files via <script>
├── js/
│   ├── app.js                 # Bootstrap, view router, init order
│   ├── api-client.js          # HTTP client (timeout, retry, cache, dedup)
│   ├── api.js                 # Legacy wrapper around api-client (to be merged)
│   ├── app-state.js           # Pub/sub store
│   ├── router.js              # Hash + History API routing
│   ├── role-router.js         # Role-based view switching
│   ├── data.js                # SyndiData (mock + simulated state)
│   ├── simulation-engine.js   # Time-stepped market simulation (842 LOC)
│   ├── auto-bidder.js         # Client-side bid generator
│   ├── auto-generator.js      # Client-side syndication generator
│   ├── market-conditions.js   # Volatility / spread regime model
│   ├── agent-orchestration.js # Frontend agent state model
│   └── components/            # 16 components: dashboards, pipeline, payments, etc.
├── styles/                    # main, components, originator, participant, landing, form-enhanced
├── server/
│   ├── index.js               # Express app, all routes (903 LOC)
│   ├── db.js                  # Mongo connection
│   ├── seed.js                # Legacy seed (smaller dataset, partial coverage)
│   └── scripts/               # Ad-hoc Mongo inspection scripts (see scripts/README.md)
├── agents/
│   ├── server.py              # FastAPI app
│   ├── config.py              # Env + feature flags, SIMULATION_MODE toggle
│   ├── db.py                  # PyMongo connection
│   ├── orchestrator.py        # LangGraph workflow definition
│   ├── originator_agent.py    # Deal creation logic
│   ├── participant_agent.py   # Bidding logic
│   ├── negotiation_agent.py   # Dutch auction
│   ├── settlement_agent.py    # Allocation + docs
│   ├── payment_agent.py       # x402 fee + escrow flow
│   ├── x402_client.py         # Coinbase CDP client (mock-aware)
│   ├── event_bus.py           # In-process event dispatch
│   ├── seed_all.py            # Canonical seeder (run this one)
│   ├── start.sh               # Local + Cloud Run entrypoint
│   └── requirements.txt
├── scripts/
│   ├── seed-db.sh             # Wrapper around agents/seed_all.py
│   ├── smoke-node.sh          # curl /api/health + /api/ready
│   └── smoke-agents.sh
├── .env.example               # Defaults to localhost; copy to .env
├── PITCH_DECK.md              # Investor narrative
├── PROJECT_DESCRIPTION.md     # Long-form product description
└── package.json
```

---

## Configuration

All env vars are read from `.env` (and `.env.example` ships a complete dev default).

| Variable | Default | Notes |
|----------|---------|-------|
| `MONGODB_URI` | `mongodb://localhost:27017/syndimatch` | Local Mongo. For Atlas: `mongodb+srv://…` |
| `DATABASE_NAME` | `syndimatch` | Pin both Node and Python to the same DB |
| `ENVIRONMENT` | `development` | `development` enables verbose logging + shorter auction rounds |
| `PORT` | `3001` | Node API port |
| `AGENTS_SERVICE_URL` | `http://localhost:8000` | Node → Python proxy target |
| `ANTHROPIC_API_KEY` | unset | Leave unset to run in `SIMULATION_MODE` |
| `GEMINI_API_KEY` | unset | Optional, used for AI-generated reports |
| `CDP_API_KEY_NAME` / `CDP_API_KEY_PRIVATE_KEY` | unset | Coinbase CDP, for real x402 (mock works without) |
| `ENABLE_X402_PAYMENTS` | `false` | Toggle real x402; mock endpoints always work |

---

## API reference

Mounted on `:3001/api` (Node). Selected endpoints — full list in `server/index.js`.

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Liveness probe |
| `/ready` | GET | Pings MongoDB |
| `/all-data` | GET | Aggregate dashboard payload (DB + agents service merged) |
| `/syndications` | GET, POST | List or create syndications |
| `/syndications/:id` | GET | Single syndication |
| `/syndications/run` | POST | Trigger Python agent workflow (proxy) |
| `/participants` | GET | Participant institutions (15 seeded) |
| `/originators` | GET | Originator banks (8 seeded) |
| `/bids?syndId=…` | GET | Bids for a syndication |
| `/agents` | GET | All agents grouped by type |
| `/agents/{participants,originators,bid,allocate}` | GET, POST | Proxy to Python agents |
| `/payments`, `/payments/summary/:syndId` | GET | Completed payments and roll-ups |
| `/x402/join-syndication` | POST | Initiates HTTP 402 commitment-fee flow |
| `/x402/pay` | POST | Settles a pending x402 payment (mock) |
| `/x402/transactions` | GET | Completed mock USDC payments |
| `/syndication-events` | GET | Orchestrator event stream (Mongo-backed) |

Python agents service on `:8000` exposes `/api/health`, `/api/all-data`, `/api/syndication/run`, `/api/agents/bid`, `/api/agents/allocate`, `/api/x402/*`, and a WebSocket on `/ws`.

---

## Deployment

Full deploy guide: [DEPLOY.md](DEPLOY.md).

- **Cloud Run** — two services (Node + Python), each deployed from `--source`, both scaling to zero.
- **Firebase Hosting** — static frontend only; points at a separately-hosted Node API.
- **Local Docker** — root `Dockerfile` for Node, `agents/Dockerfile` for Python.

---

## Roadmap

The codebase is mid-refactor on `refactor/main`. Phases planned:

1. **Phase 1 — Baseline (done)**: local boot reproducible, demo verified.
2. **Phase 2 — Dead code + doc consolidation (done)**: removed orphaned `js/services/`, `js/components/{originator,participant}-view.js`, `server/agents-seed.js`; relocated `server/check_*.js` into `server/scripts/`; folded 6 deployment docs into one [DEPLOY.md](DEPLOY.md).
3. **Phase 3 — Backend modularize**: split `server/index.js` (903 LOC) into route modules; collapse `js/api.js` into `js/api-client.js`; fix the `/api/analytics/platform` 404 and `/api/agents/bid` 502 rate.
4. **Phase 4 — Vite + ESM frontend**: replace 31 `<script>` globals with ES modules; break up the 40–52 KB dashboard components; remove the dual mock/sim/API data-source confusion.

Beyond that:

- Real Anthropic / Gemini integration (currently SIMULATION_MODE)
- Real x402 / Coinbase CDP (currently mock)
- KYC/AML workflow, document parsing
- Multi-bank pilot, secondary trading, CLO integration

---

## License

ISC — see `package.json`.
