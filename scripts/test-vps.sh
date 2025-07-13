#!/bin/bash

# Script test VPS sau khi deploy
echo "🔧 Testing VPS deployment..."

# Test 1: Health check
echo "1. Testing health check..."
curl -s http://localhost:4000/api/health | jq .

# Test 2: Test user creation
echo "2. Testing user creation..."
curl -s http://localhost:4000/api/test-user-creation | jq .

# Test 3: Test return models
echo "3. Testing return models..."
curl -s http://localhost:4000/api/test-return-models | jq .

# Test 4: Test return import route
echo "4. Testing return import route..."
curl -s http://localhost:4000/api/return-import | jq .

# Test 5: Test return export route
echo "5. Testing return export route..."
curl -s http://localhost:4000/api/return-export | jq .

# Test 6: Check Docker logs
echo "6. Checking Docker logs..."
docker logs vphone-backend --tail 50

echo "✅ Test completed!" 