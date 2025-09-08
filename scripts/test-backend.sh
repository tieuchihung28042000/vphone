#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:4000}"
TOKEN="${TOKEN:-}"

AUTH_ARGS=()
if [ -n "$TOKEN" ]; then
  AUTH_ARGS=( -H "Authorization: Bearer $TOKEN" )
fi

echo "== Health =="
curl -s "$BASE_URL/api/health" | jq . || true

echo "== Financial report (summary) =="
curl -s "${BASE_URL}/api/report/financial-report/summary?from=$(date +%Y-%m-01)&to=$(date +%Y-%m-%d)&branch=all" | jq . || true

echo "== Cashbook contents suggestions =="
curl -s "${AUTH_ARGS[@]}" "${BASE_URL}/api/cashbook/contents?limit=10" | jq . || true

echo "== Activity logs (first page) =="
curl -s "${AUTH_ARGS[@]}" "${BASE_URL}/api/activity-logs?page=1&limit=10" | jq . || true

echo "== Return import/export list (auth required) =="
curl -s "${AUTH_ARGS[@]}" "${BASE_URL}/api/return-import" | jq . || true
curl -s "${AUTH_ARGS[@]}" "${BASE_URL}/api/return-export" | jq . || true

echo "Done."


