#!/usr/bin/env bash
set -euo pipefail

BACKEND_URL="${BACKEND_URL:-http://localhost:8000}"
DASHBOARD_URL="${DASHBOARD_URL:-http://localhost:5173}"
SUMMON_ENDPOINT="${SUMMON_ENDPOINT:-/api/summon}"
SUMMON_SOURCE="${SUMMON_SOURCE:-keyboard}"
SUMMON_MESSAGE="${SUMMON_MESSAGE:-Keyboard summon requested. Open the dashboard and prepare the agent.}"
PYTHON_BIN="${PYTHON_BIN:-}"

open_dashboard() {
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$DASHBOARD_URL" >/dev/null 2>&1 &
  elif command -v open >/dev/null 2>&1; then
    open "$DASHBOARD_URL" >/dev/null 2>&1 &
  else
    printf 'Dashboard: %s\n' "$DASHBOARD_URL"
  fi
}

json_escape() {
  if [ -z "$PYTHON_BIN" ]; then
    if command -v python3 >/dev/null 2>&1; then
      PYTHON_BIN=python3
    else
      PYTHON_BIN=python
    fi
  fi

  "$PYTHON_BIN" - "$1" <<'PY'
import json
import sys

print(json.dumps(sys.argv[1]))
PY
}

open_dashboard

payload=$(printf '{"source":%s,"message":%s,"metadata":{"trigger":"keyboard","dashboardUrl":%s}}' \
  "$(json_escape "$SUMMON_SOURCE")" \
  "$(json_escape "$SUMMON_MESSAGE")" \
  "$(json_escape "$DASHBOARD_URL")")

curl --fail --silent --show-error \
  --request POST \
  --header 'Content-Type: application/json' \
  --data "$payload" \
  "${BACKEND_URL%/}$SUMMON_ENDPOINT"

printf '\nSummon sent to %s%s\n' "${BACKEND_URL%/}" "$SUMMON_ENDPOINT"
