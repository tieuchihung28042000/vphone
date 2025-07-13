#!/bin/bash

# Script test VPS sau khi deploy
echo "🔧 Testing VPS deployment..."

# Test 1: Health check
echo "1. Testing health check..."
curl -s http://localhost:4000/api/health | jq .

# Test 2: Test return models
echo "2. Testing return models..."
curl -s http://localhost:4000/api/test-return-models | jq .

# Test 3: Test return import route
echo "3. Testing return import route..."
curl -s http://localhost:4000/api/return-import | jq .

# Test 4: Test return export route
echo "4. Testing return export route..."
curl -s http://localhost:4000/api/return-export | jq .

# Test 5: Check Docker logs
echo "5. Checking Docker logs..."
docker logs vphone-backend --tail 50

echo "✅ Test completed!" 