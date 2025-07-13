#!/bin/bash

echo "🔍 Debug VPS Deployment Status..."
echo "================================"

# 1. Check if VPS has latest code
echo "1. Checking VPS git status..."
echo "Run this on VPS: cd ~/sites/nguyenkieuanh.com && git log --oneline -5"
echo ""

# 2. Check if containers are running latest build
echo "2. Checking container status..."
echo "Run this on VPS: docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'"
echo ""

# 3. Check container logs
echo "3. Checking container logs..."
echo "Run this on VPS: docker logs vphone-backend --tail 50"
echo ""

# 4. Test API endpoints
echo "4. Testing API endpoints..."
echo "Health check:"
curl -s https://nguyenkieuanh.com/api/health | jq .
echo ""

echo "Test user creation endpoint:"
curl -s https://nguyenkieuanh.com/api/test-user-creation | jq .
echo ""

echo "Return export without auth (should show 'Access token required'):"
curl -s https://nguyenkieuanh.com/api/return-export
echo ""

echo "Return import without auth (should show 'Access token required'):"
curl -s https://nguyenkieuanh.com/api/return-import
echo ""

# 5. Check if models are properly imported
echo "5. Testing model imports..."
echo "Return models test:"
curl -s https://nguyenkieuanh.com/api/test-return-models | jq .
echo ""

# 6. Current local git status
echo "6. Local git status:"
echo "Current branch: $(git branch --show-current)"
echo "Latest commit: $(git log --oneline -1)"
echo "Remote status: $(git status --porcelain -b)"
echo ""

echo "🔧 DEPLOYMENT STEPS TO FIX:"
echo "================================"
echo "1. SSH to VPS: ssh your-user@your-vps"
echo "2. cd ~/sites/nguyenkieuanh.com"
echo "3. git pull origin main"
echo "4. docker-compose down"
echo "5. docker-compose build --no-cache"
echo "6. docker-compose up -d"
echo "7. docker logs vphone-backend --tail 20"
echo ""

echo "🎯 EXPECTED RESULTS AFTER DEPLOY:"
echo "================================"
echo "✅ /api/return-export should return 'Access token required' (not 404)"
echo "✅ /api/return-import should return 'Access token required' (not 404)"
echo "✅ /api/test-return-models should return model counts"
echo "✅ User creation should work without username null error"
echo "✅ Nhân viên bán hàng should only see Xuất hàng menu"
echo ""

echo "🚨 IF STILL NOT WORKING:"
echo "================================"
echo "1. Check if git pull actually pulled latest code"
echo "2. Verify docker build used --no-cache"
echo "3. Check if environment variables are set correctly"
echo "4. Verify MongoDB connection"
echo "5. Check if all models are properly imported in server.js" 