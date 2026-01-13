#!/bin/bash
set -euo pipefail

if [ -z "${MONGODB_URI:-}" ]; then
  echo "MONGODB_URI is not set. Update .env and export it before seeding."
  exit 1
fi

python agents/seed_all.py
