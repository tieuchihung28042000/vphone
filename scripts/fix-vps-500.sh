#!/bin/bash

# Script khắc phục lỗi 500 trên VPS
echo "🔧 Fixing VPS 500 error..."

# Step 1: Stop containers
echo "1. Stopping containers..."
docker compose down

# Step 2: Remove old images
echo "2. Removing old images..."
docker image prune -f

# Step 3: Rebuild with no cache
echo "3. Rebuilding with no cache..."
docker compose build --no-cache

# Step 4: Start containers
echo "4. Starting containers..."
docker compose up -d

# Step 5: Wait for services
echo "5. Waiting for services..."
sleep 30

# Step 6: Check logs
echo "6. Checking logs..."
docker logs vphone-backend --tail 20

# Step 7: Test health
echo "7. Testing health..."
curl -s http://localhost:4000/api/health

echo "✅ Fix completed!" 