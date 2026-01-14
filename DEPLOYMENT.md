# SyndiMatch Deployment

This repo runs as two services:
- Node.js API + frontend (`server/index.js`)
- Python agents service (`agents/server.py`)

## Prereqs

- MongoDB reachable via `MONGODB_URI`
- Node 18+ for built-in `fetch`
- Python 3.11+ for agents

## Environment

Required:
- `MONGODB_URI`

Optional:
- `AGENTS_SERVICE_URL` (Node -> Agents)
- `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`
- `CDP_API_KEY_NAME`, `CDP_API_KEY_PRIVATE_KEY`, `CDP_NETWORK`

## Local

```bash
# Agents
cd agents
python -m uvicorn server:app --host 0.0.0.0 --port 8000

# Node API + UI
npm start
```

## Cloud Run (recommended)

### Agents service

See `agents/CLOUDRUN_DEPLOYMENT.md` for full steps. At minimum:

```bash
gcloud run deploy syndimatch-agents \
  --source ./agents \
  --region us-west1 \
  --allow-unauthenticated \
  --set-env-vars "MONGODB_URI=your-uri,ANTHROPIC_API_KEY=your-key,CDP_NETWORK=base-sepolia"
```

### Node API + UI

See `NODEJS_DEPLOYMENT.md` for full steps. At minimum:

```bash
gcloud run deploy syndimatch-api \
  --source . \
  --region us-west1 \
  --allow-unauthenticated \
  --set-env-vars "MONGODB_URI=your-uri,AGENTS_SERVICE_URL=https://your-agents-url"
```

## Troubleshooting

- Node quick fixes: `QUICK_FIX.md`
- Cloud Run troubleshooting: `TROUBLESHOOTING.md`
