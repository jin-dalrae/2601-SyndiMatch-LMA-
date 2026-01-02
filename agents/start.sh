#!/bin/bash
# Startup script for Cloud Run

# Get port from environment (Cloud Run sets this)
PORT=${PORT:-8080}

# Run the FastAPI server
exec uvicorn server:app --host 0.0.0.0 --port $PORT

