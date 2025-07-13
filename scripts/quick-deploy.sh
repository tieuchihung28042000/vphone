#!/bin/bash

# Script deploy nhanh - chỉ restart backend
echo "🔧 Quick deploy - restarting backend..."

# Step 1: Restart backend container
echo "1. Restarting backend container..."
docker compose restart vphone-backend

# Step 2: Wait for service
echo "2. Waiting for backend to start..."
sleep 10

# Step 3: Check health
echo "3. Checking health..."
curl -s http://localhost:4000/api/health | jq .

# Step 4: Test new endpoint
echo "4. Testing new endpoint..."
curl -s http://localhost:4000/api/test-user-creation | jq .

echo "✅ Quick deploy completed!" 