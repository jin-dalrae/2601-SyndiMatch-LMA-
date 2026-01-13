# SyndiMatch

AI-powered loan syndication platform with a real-time dashboard, multi-agent orchestration, and a mock x402 payment flow.

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

## Scripts

- `npm start` / `npm run dev`: run the Node.js server.
- `npm run serve`: serve the frontend statically (no API).

## API highlights

- `GET /api/health`
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
