#!/bin/bash
echo "🧪 Testing Backend APIs..."

# Get token
echo "1. Getting auth token..."
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@vphone.vn","password":"123456"}' | jq -r .token)

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Login failed"
  exit 1
fi

echo "✅ Token obtained: ${TOKEN:0:20}..."

# Test financial report
echo "2. Testing financial report..."
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/report/financial-report/summary | jq .

# Test cashbook contents
echo "3. Testing cashbook contents..."
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/cashbook/contents | jq .

# Test activity logs
echo "4. Testing activity logs..."
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:4000/api/activity-logs?page=1&limit=5" | jq .

echo "✅ All API tests completed!"
