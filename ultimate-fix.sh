#!/bin/bash

# Ultimate fix script cho VPhone System
echo "🔧 VPhone System - Ultimate Fix"
echo "==============================="

# Step 1: Complete cleanup
echo "1. 🧹 Dọn sạch hoàn toàn:"
echo "Stopping all containers..."
docker stop $(docker ps -aq) 2>/dev/null || true
docker rm $(docker ps -aq) 2>/dev/null || true
docker system prune -af
docker volume prune -f

echo "Stopping nginx system..."
sudo systemctl stop nginx 2>/dev/null || true

echo "✅ Cleanup completed"

# Step 2: Check and fix docker-compose files
echo -e "\n2. 🔍 Kiểm tra environment variables:"
echo "Checking VITE_API_URL in docker-compose files..."

# Fix VITE_API_URL cho test environment
if grep -q "VITE_API_URL: https://test.vphone.vn/api" docker-compose.test.yml; then
    echo "Fixing test VITE_API_URL to use HTTP..."
    sed -i 's|VITE_API_URL: https://test.vphone.vn/api|VITE_API_URL: http://test.vphone.vn/api|g' docker-compose.test.yml
fi

# Fix VITE_API_URL cho app environment  
if grep -q "VITE_API_URL: https://app.vphone.vn/api" docker-compose.app.yml; then
    echo "Fixing app VITE_API_URL to use HTTP..."
    sed -i 's|VITE_API_URL: https://app.vphone.vn/api|VITE_API_URL: http://app.vphone.vn/api|g' docker-compose.app.yml
fi

echo "✅ Environment variables fixed"

# Step 3: Start services step by step
echo -e "\n3. 🚀 Starting services step by step:"

# Start only databases first
echo "Starting databases..."
docker-compose -f docker-compose.test.yml up -d mongodb-test
docker-compose -f docker-compose.app.yml up -d mongodb-app

echo "Waiting for databases to be ready..."
sleep 45

# Start backends
echo "Starting backends..."
docker-compose -f docker-compose.test.yml up -d backend-test
docker-compose -f docker-compose.app.yml up -d backend-app

echo "Waiting for backends to be ready..."
sleep 30

# Check backend health
echo "Checking backend health..."
for i in {1..12}; do
    if curl -f http://127.0.0.1:4001/health >/dev/null 2>&1; then
        echo "✅ Test backend is healthy"
        break
    fi
    echo "⏳ Waiting for test backend... ($i/12)"
    sleep 5
done

for i in {1..12}; do
    if curl -f http://127.0.0.1:4002/health >/dev/null 2>&1; then
        echo "✅ App backend is healthy"
        break
    fi
    echo "⏳ Waiting for app backend... ($i/12)"
    sleep 5
done

# Start frontends
echo "Starting frontends..."
docker-compose -f docker-compose.test.yml up -d frontend-test
docker-compose -f docker-compose.app.yml up -d frontend-app

echo "Waiting for frontends to be ready..."
sleep 60

# Step 4: Check container status
echo -e "\n4. 📊 Checking container status:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Step 5: Check logs for any issues
echo -e "\n5. 🔍 Checking for issues:"
echo "Test frontend logs:"
docker-compose -f docker-compose.test.yml logs --tail=10 frontend-test

echo -e "\nApp frontend logs:"
docker-compose -f docker-compose.app.yml logs --tail=10 frontend-app

# Step 6: Test direct connections
echo -e "\n6. 🧪 Testing direct connections:"
curl -I -m 5 http://127.0.0.1:4001/health 2>/dev/null && echo "✅ Test backend OK" || echo "❌ Test backend failed"
curl -I -m 5 http://127.0.0.1:4002/health 2>/dev/null && echo "✅ App backend OK" || echo "❌ App backend failed"
curl -I -m 5 http://127.0.0.1:8081 2>/dev/null && echo "✅ Test frontend OK" || echo "❌ Test frontend failed"
curl -I -m 5 http://127.0.0.1:8083 2>/dev/null && echo "✅ App frontend OK" || echo "❌ App frontend failed"

# Step 7: Start nginx and test
echo -e "\n7. 🌐 Starting nginx and testing:"
sudo systemctl start nginx
sudo systemctl reload nginx

sleep 5

echo "Testing through nginx:"
curl -I -m 5 http://test.vphone.vn/health 2>/dev/null && echo "✅ test.vphone.vn health OK" || echo "❌ test.vphone.vn health failed"
curl -I -m 5 http://app.vphone.vn/health 2>/dev/null && echo "✅ app.vphone.vn health OK" || echo "❌ app.vphone.vn health failed"

# Step 8: Final status
echo -e "\n8. 📋 Final Status Report:"
echo "================================"
echo "🐳 Container Status:"
docker ps --format "table {{.Names}}\t{{.Status}}"

echo -e "\n🌐 Port Status:"
sudo netstat -tulpn | grep -E "(80|4001|4002|8081|8083)" | head -10

echo -e "\n🎯 Access URLs:"
echo "✅ Test Environment: http://test.vphone.vn (NOT https)"
echo "✅ App Environment: http://app.vphone.vn (NOT https)"

echo -e "\n🔧 If still issues, check:"
echo "- Docker logs: docker-compose -f docker-compose.test.yml logs -f"
echo "- Nginx logs: sudo tail -f /var/log/nginx/error.log"
echo "- System logs: journalctl -fu docker"

echo -e "\n🎉 Ultimate fix completed!" 