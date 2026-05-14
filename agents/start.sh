#!/bin/bash
# Startup script.
# Cloud Run: PORT env is set; Dockerfile copies agents/* to /app, so `server:app` resolves.
# Local dev: run this from the repo root so `agents.server:app` resolves with relative imports.

PORT=${PORT:-8000}

# Detect run context: if running from inside agents/ (Cloud Run /app layout), use server:app.
# Otherwise use the package-qualified path so relative imports in server.py work.
if [ -f "./orchestrator.py" ]; then
  APP_PATH="server:app"
else
  APP_PATH="agents.server:app"
fi

exec python -m uvicorn "$APP_PATH" --host 0.0.0.0 --port "$PORT"

