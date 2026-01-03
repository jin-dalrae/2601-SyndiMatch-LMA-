# Node.js Server Deployment Guide

## Architecture

Your Node.js server (`server/index.js`) now acts as the main API server and calls the Python agents service when needed:

```
┌─────────────────────────┐
│  Node.js Server         │  ← Main API (Express)
│  - MongoDB access       │  ← Handles all data
│  - Frontend serving     │  ← Serves HTML/CSS/JS
│  - API endpoints        │  ← REST API
└─────────────────────────┘
           ↓ HTTP calls
┌─────────────────────────┐
│  Python Agents Service  │  ← Cloud Run
│  - Orchestration        │  ← LangGraph workflows
│  - AI agents            │  ← LangChain/Anthropic
└─────────────────────────┘
```

## Benefits

1. **No Python import issues** - Python service is separate
2. **Simpler deployment** - Node.js is easier to deploy
3. **Better separation** - API layer vs. business logic
4. **Scalability** - Can scale services independently

## Environment Variables

Add to your `.env` file:

```bash
# MongoDB (already set)
MONGODB_URI=your-mongodb-uri

# Python Agents Service URL
AGENTS_SERVICE_URL=https://syndimatch-77249120146.us-west1.run.app
# Or for local development:
# AGENTS_SERVICE_URL=http://localhost:8000
```

## Deployment Options

### Option 1: Deploy Node.js to Cloud Run (Recommended)

1. **Create Dockerfile for Node.js server**:
```dockerfile
FROM node:18-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY server/ ./server/
COPY . .
EXPOSE 8080
ENV PORT=8080
CMD ["node", "server/index.js"]
```

2. **Deploy**:
```bash
gcloud run deploy syndimatch-api \
  --source . \
  --region us-west1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --set-env-vars "MONGODB_URI=your-uri,AGENTS_SERVICE_URL=https://syndimatch-77249120146.us-west1.run.app"
```

### Option 2: Deploy to Railway/Heroku

1. **Add `Procfile`**:
```
web: node server/index.js
```

2. **Set environment variables** in Railway/Heroku dashboard

3. **Deploy**:
```bash
git push railway main
# or
git push heroku main
```

### Option 3: Deploy to Firebase Functions (Not Recommended)

Firebase Functions has cold start issues and isn't ideal for Express apps.

## API Endpoints

Your Node.js server now has these endpoints:

### Existing Endpoints (MongoDB)
- `GET /api/syndications` - List all syndications
- `GET /api/syndications/:id` - Get specific syndication
- `POST /api/syndications` - Create syndication (stores in DB)
- `GET /api/participants` - List participants
- `GET /api/payments` - List payments
- `GET /api/agents` - Get agent overview

### New Endpoints (Python Agents)
- `POST /api/syndications/run` - Run orchestration (calls Python)
- `POST /api/syndications/resume` - Resume syndication (calls Python)
- `GET /api/syndications/:id/status` - Get status from agents
- `GET /api/agents/health` - Check agents service health

## Testing

1. **Start Node.js server locally**:
```bash
npm start
# or
node server/index.js
```

2. **Test agents integration**:
```bash
# Check agents service health
curl http://localhost:3001/api/agents/health

# Run a syndication
curl -X POST http://localhost:3001/api/syndications/run \
  -H "Content-Type: application/json" \
  -d '{"originator_id": "OA-001"}'
```

## Frontend Integration

Your frontend (`index.html`) already calls `/api/*` endpoints, so it will automatically use the Node.js server. No changes needed!

## Next Steps

1. ✅ Deploy Python agents to Cloud Run (already done)
2. ✅ Update Node.js server with integration endpoints (done)
3. ⏳ Deploy Node.js server to Cloud Run/Railway/Heroku
4. ⏳ Set `AGENTS_SERVICE_URL` environment variable
5. ⏳ Test the integration

## Troubleshooting

### Agents service unavailable
- Check `AGENTS_SERVICE_URL` is correct
- Verify Python service is running
- Check Cloud Run service logs

### Import errors in Python
- Python service is separate now, so Node.js won't have these issues
- Python service still needs proper imports (use relative imports)

### CORS issues
- Node.js server has CORS enabled
- Python service should also have CORS enabled

