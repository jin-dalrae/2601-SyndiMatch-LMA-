#!/bin/bash
set -euo pipefail

# Pull MONGODB_URI from .env if not already exported
if [ -z "${MONGODB_URI:-}" ] && [ -f .env ]; then
  set -a; . ./.env; set +a
fi

if [ -z "${MONGODB_URI:-}" ]; then
  echo "MONGODB_URI is not set. Update .env or export it before seeding."
  exit 1
fi

# Prefer the project venv if present
if [ -x .venv/bin/python ]; then
  PYTHON=.venv/bin/python
else
  PYTHON="${PYTHON:-python3}"
fi

"$PYTHON" agents/seed_all.py
