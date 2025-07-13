#!/bin/bash

# Script test user creation trên VPS
echo "🔧 Testing user creation on VPS..."

# Test 1: Health check
echo "1. Testing health check..."
curl -s http://localhost:4000/api/health

# Test 2: Test user creation endpoint
echo "2. Testing user creation endpoint..."
curl -s http://localhost:4000/api/test-user-creation

# Test 3: Test branches endpoint
echo "3. Testing branches endpoint..."
curl -s http://localhost:4000/api/branches

# Test 4: Test user registration (with dummy data)
echo "4. Testing user registration..."
curl -s -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "123456",
    "full_name": "Test User",
    "role": "nhan_vien_ban_hang",
    "branch_id": "test-branch-id",
    "branch_name": "Test Branch"
  }'

# Test 5: Check Docker logs for user creation
echo "5. Checking Docker logs for user creation..."
docker logs vphone-backend --tail 30 | grep -i "register\|user\|error"

echo "✅ User creation test completed!" 