#!/bin/bash
set -euo pipefail

BASE_URL="${AGENTS_API_URL:-http://localhost:8000/api}"

echo "Agents API: ${BASE_URL}"
curl -fsS "${BASE_URL}/health" >/dev/null
curl -fsS "${BASE_URL}/ready" >/dev/null
echo "✅ Agents API smoke test passed"
