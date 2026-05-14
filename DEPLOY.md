# Deployment

This repo ships two services:

- **Node API + static frontend** — `server/index.js`, Express on port 3001.
- **Python agents service** — `agents/server.py`, FastAPI on port 8000.

Both talk to a shared MongoDB. The Node API proxies `/api/agents/*` and `/api/x402/*` to the Python service via `AGENTS_SERVICE_URL`.

For local development, see [README.md → Quick start](README.md#quick-start-local-dev). This doc covers production deployment.

## Cloud Run (recommended)

Two services, deployed independently. Both auto-scale to zero when idle.

### Agents service

```bash
gcloud run deploy syndimatch-agents \
  --source ./agents \
  --region us-west1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 3600 \
  --max-instances 10 \
  --min-instances 0 \
  --set-env-vars "MONGODB_URI=<atlas-uri>,DATABASE_NAME=syndimatch,ENVIRONMENT=production"
```

Optional vars (omit to stay in `SIMULATION_MODE`):

- `ANTHROPIC_API_KEY` — enables real Claude reasoning
- `GEMINI_API_KEY` — enables AI report generation
- `CDP_API_KEY_NAME`, `CDP_API_KEY_PRIVATE_KEY`, `CDP_NETWORK` — enables real x402 / USDC payments
- `ENABLE_X402_PAYMENTS=true` — flips x402 from mock to real

For secrets, prefer Secret Manager:

```bash
echo -n "<value>" | gcloud secrets create MONGODB_URI --data-file=-
gcloud run services update syndimatch-agents \
  --region us-west1 \
  --update-secrets MONGODB_URI=MONGODB_URI:latest,ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest
```

Memory sizing: LangGraph + LangChain are memory-hungry. Start at 2Gi; bump to 4Gi if you see OOMs in logs.

### Node API + frontend

```bash
gcloud run deploy syndimatch-api \
  --source . \
  --region us-west1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --timeout 300 \
  --set-env-vars "MONGODB_URI=<atlas-uri>,DATABASE_NAME=syndimatch,AGENTS_SERVICE_URL=<agents-url-from-above>"
```

Get the agents URL after deploying that service:

```bash
gcloud run services describe syndimatch-agents \
  --region us-west1 --format 'value(status.url)'
```

### Seeding production

```bash
# Atlas URI
export MONGODB_URI='mongodb+srv://...'
export DATABASE_NAME=syndimatch

.venv/bin/python agents/seed_all.py
```

The seeder is idempotent — running twice replaces the seed data, doesn't duplicate.

## Firebase Hosting (frontend only)

`firebase.json` configures static hosting for `index.html` + `js/` + `styles/`. The frontend points at whatever Node API the user has running.

```bash
firebase deploy --only hosting
# preview channel
firebase hosting:channel:deploy preview
```

To point the deployed frontend at a remote Node API, change the `baseUrl` in `js/api-client.js` (line 7) before building, or set `Config.API_URL` in `js/config.js`.

## Local Docker

The root `Dockerfile` builds the Node service. The agents service has its own `agents/Dockerfile`.

```bash
# Node
docker build -t syndimatch-api .
docker run -p 8080:8080 -e PORT=8080 -e MONGODB_URI=<uri> syndimatch-api

# Agents
docker build -t syndimatch-agents ./agents
docker run -p 8000:8000 -e MONGODB_URI=<uri> syndimatch-agents
```

For a fully self-contained demo, add a `mongo:7` container and link the three on a Docker network. No compose file ships today.

## Troubleshooting

### `Cannot find module '...'`
Missing npm dep. Check `package.json` lists every `require()` in `server/`.

### `MongoDB connection error: EBADNAME`
`.env` still has the `<cluster>` placeholder from the template. Set a real `MONGODB_URI`.

### `MongoServerSelectionError` on Atlas
Atlas IP allowlist doesn't include Cloud Run egress. Either allow `0.0.0.0/0` (least secure) or configure a Cloud Run egress connector with a static IP and allowlist that.

### `ModuleNotFoundError: No module named 'db'` (Python agents)
You ran `python -m uvicorn server:app` from `agents/`. Run from the repo root: `python -m uvicorn agents.server:app`. `agents/start.sh` auto-detects which form to use.

### Node API returns 502 on `/api/agents/*` proxy calls
Python agents service is down or unreachable. Check `AGENTS_SERVICE_URL` and confirm the agents service responds to `/api/health`.

### Port already in use
Node 3001, Python 8000, Mongo 27017. Find conflicts: `lsof -i :3001`. Kill: `kill $(lsof -t -i :3001)`.

### 502 Bad Gateway on Cloud Run
Server isn't listening on `0.0.0.0` or the PORT env var. Node code in `server/index.js:890` does this correctly — check that Dockerfile sets `PORT` if you're overriding.

### "fetch is not defined"
Node <18. Bump the Dockerfile to `node:20-slim`.

### Cloud Run quick health check

```bash
SERVICE_URL=$(gcloud run services describe syndimatch-api \
  --region us-west1 --format 'value(status.url)')
curl -fsS "$SERVICE_URL/api/health"      # Node
curl -fsS "$SERVICE_URL/api/ready"       # Node + Mongo
curl -fsS "$SERVICE_URL/api/agents/health"   # Node -> Python proxy
```

Service logs:

```bash
gcloud run services logs tail syndimatch-api --region us-west1
gcloud run services logs tail syndimatch-agents --region us-west1
```

## Resource sizing reference

| Service | Memory | CPU | Timeout | Notes |
|---------|--------|-----|---------|-------|
| `syndimatch-api` (Node) | 1Gi | 1 | 300s | Mostly Mongo proxy + static files |
| `syndimatch-agents` (Python) | 2Gi | 2 | 3600s | LangGraph workflows can run minutes |

Both start at `min-instances=0` for cost. Bump to `1` if cold-start latency matters.
