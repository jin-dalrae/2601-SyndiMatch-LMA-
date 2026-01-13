#!/bin/bash
set -euo pipefail

BASE_URL="${NODE_API_URL:-http://localhost:3001/api}"

echo "Node API: ${BASE_URL}"
curl -fsS "${BASE_URL}/health" >/dev/null
curl -fsS "${BASE_URL}/ready" >/dev/null
echo "✅ Node API smoke test passed"
