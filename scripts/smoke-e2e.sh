#!/usr/bin/env bash
set -euo pipefail

BACKEND_URL="${BACKEND_URL:-http://localhost:8000}"
HEALTH_ENDPOINT="${SUMMON_HEALTH_ENDPOINT:-/health}"
SUMMON_ENDPOINT="${SUMMON_ENDPOINT:-/api/summon}"
PYTHON_BIN="${PYTHON_BIN:-}"

require_bin() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$1" >&2
    exit 127
  fi
}

require_bin curl

if [ -z "$PYTHON_BIN" ]; then
  if command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN=python3
  else
    PYTHON_BIN=python
  fi
fi
require_bin "$PYTHON_BIN"

health_url="${BACKEND_URL%/}$HEALTH_ENDPOINT"
summon_url="${BACKEND_URL%/}$SUMMON_ENDPOINT"

printf 'Checking backend health: %s\n' "$health_url"
for attempt in $(seq 1 30); do
  if curl --fail --silent --show-error "$health_url" >/tmp/personal-agent-os-health.json; then
    break
  fi
  if [ "$attempt" -eq 30 ]; then
    printf 'Backend health check failed after %s attempts\n' "$attempt" >&2
    exit 1
  fi
  sleep 1
done
"$PYTHON_BIN" -m json.tool /tmp/personal-agent-os-health.json >/dev/null 2>&1 || true
printf 'Backend health OK\n'

payload='{"source":"smoke-e2e","message":"Smoke test summon","metadata":{"test":true}}'

printf 'Checking summon endpoint: %s\n' "$summon_url"
curl --fail --silent --show-error \
  --request POST \
  --header 'Content-Type: application/json' \
  --data "$payload" \
  "$summon_url" >/tmp/personal-agent-os-summon.json
"$PYTHON_BIN" -m json.tool /tmp/personal-agent-os-summon.json >/dev/null 2>&1 || true
printf 'Summon endpoint OK\n'
