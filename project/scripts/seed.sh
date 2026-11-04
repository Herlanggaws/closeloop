#!/usr/bin/env bash
set -euo pipefail
API="${API_URL:-http://localhost:8080}"

echo "Registering demo user…"
REG=$(curl -sS -X POST "$API/api/auth/register" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Herlangga","email":"demo@closeloop.dev","password":"demo-demo-demo"}' || true)
TOKEN=$(echo "$REG" | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null || true)
if [ -z "$TOKEN" ]; then
  REG=$(curl -sS -X POST "$API/api/auth/login" -H 'Content-Type: application/json' -d '{"email":"demo@closeloop.dev","password":"demo-demo-demo"}')
  TOKEN=$(echo "$REG" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
fi

PROJ=$(curl -sS -X POST "$API/api/projects" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Bear Budget Web","platforms":["web"]}')
echo "$PROJ" | python3 -m json.tool
PROJECT_ID=$(echo "$PROJ" | python3 -c "import sys,json; print(json.load(sys.stdin)['project']['id'])")
PUBLIC_KEY=$(echo "$PROJ" | python3 -c "import sys,json; print(json.load(sys.stdin)['public_key'])")

MCP=$(curl -sS -X POST "$API/api/projects/$PROJECT_ID/mcp-tokens" -H "Authorization: Bearer $TOKEN")
MCP_TOKEN=$(echo "$MCP" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

REPORT=$(curl -sS -X POST "$API/v1/ingest/reports" -H "X-Closeloop-Key: $PUBLIC_KEY" -H 'Content-Type: application/json' \
  -d '{"type":"bug","message":"Transaction filter does not refresh after changing dates","platform":"web","email":"rina@example.com","user_id":"rina","app_version":"2.4.1","context":{"url":"/transactions","browser":"Safari 18"}}')
echo "$REPORT" | python3 -m json.tool

echo ""
echo "DEMO_ACCESS_TOKEN=$TOKEN"
echo "DEMO_PROJECT_ID=$PROJECT_ID"
echo "DEMO_PUBLIC_KEY=$PUBLIC_KEY"
echo "DEMO_MCP_TOKEN=$MCP_TOKEN"
echo "$PUBLIC_KEY" > /tmp/closeloop_public_key.txt
echo "$MCP_TOKEN" > /tmp/closeloop_mcp_token.txt
echo "$TOKEN" > /tmp/closeloop_access.txt
