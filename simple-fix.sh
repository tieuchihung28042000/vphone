#!/bin/bash

# Simple Fix Script - Dễ debug từng bước
echo "🔧 Simple Fix - VPhone System"
echo "============================="

# Step 1: Cleanup everything
echo "1. 🧹 Cleanup all:"
docker stop $(docker ps -q) 2>/dev/null || true
docker rm $(docker ps -aq) 2>/dev/null || true
docker system prune -f
sudo systemctl stop nginx

echo "✅ Cleanup done"

# Step 2: Start only one test system first
echo -e "\n2. 🚀 Starting TEST system only:"
docker-compose -f docker-compose.test.yml up -d --build

echo "⏳ Waiting 60 seconds for test system..."
sleep 60

# Step 3: Check test system
echo -e "\n3. 📊 Check test system:"
docker-compose -f docker-compose.test.yml ps

echo -e "\n📋 Test system logs:"
echo "Backend logs:"
docker-compose -f docker-compose.test.yml logs --tail=5 backend-test
echo -e "\nFrontend logs:"  
docker-compose -f docker-compose.test.yml logs --tail=5 frontend-test

# Step 4: Test ports
echo -e "\n4. 🧪 Test ports:"
echo "Port 4001 (backend):"
curl -I http://127.0.0.1:4001/health 2>/dev/null && echo "✅ OK" || echo "❌ FAIL"
echo "Port 8081 (frontend):"
curl -I http://127.0.0.1:8081 2>/dev/null && echo "✅ OK" || echo "❌ FAIL"

# Step 5: Start nginx
echo -e "\n5. 🌐 Starting nginx:"
sudo systemctl start nginx

echo "Testing test.vphone.vn:"
curl -I http://test.vphone.vn/health 2>/dev/null && echo "✅ OK" || echo "❌ FAIL"

echo -e "\n📝 Next steps if working:"
echo "- Test website: http://test.vphone.vn"
echo "- If OK, run: docker-compose -f docker-compose.app.yml up -d --build"
echo "- Then test: http://app.vphone.vn"

echo -e "\n🔍 If not working, check:"
echo "- docker-compose -f docker-compose.test.yml logs -f"
echo "- sudo tail -f /var/log/nginx/error.log" 