#!/bin/bash

# Script sửa toàn bộ vấn đề deploy
echo "🔧 Sửa Toàn Bộ Vấn Đề Deploy"
echo "============================"

# Bước 1: Dọn sạch toàn bộ
echo "1. 🧹 Dọn sạch containers cũ:"
docker-compose -f docker-compose.test.yml down --remove-orphans
docker-compose -f docker-compose.app.yml down --remove-orphans

# Xóa nginx containers cũ nếu có
docker stop vphone-app-nginx vphone-test-nginx 2>/dev/null || true
docker rm vphone-app-nginx vphone-test-nginx 2>/dev/null || true

# Dọn dẹp images
docker system prune -f

echo "✅ Dọn dẹp hoàn tất"

# Bước 2: Build lại từ đầu
echo -e "\n2. 🔨 Build lại từ đầu:"
echo "Building test environment..."
docker-compose -f docker-compose.test.yml build --no-cache

echo "Building app environment..."
docker-compose -f docker-compose.app.yml build --no-cache

# Bước 3: Start từng môi trường riêng biệt
echo -e "\n3. 🚀 Start containers:"
echo "Starting test environment..."
docker-compose -f docker-compose.test.yml up -d

echo "Waiting 30 seconds..."
sleep 30

echo "Starting app environment..."
docker-compose -f docker-compose.app.yml up -d

echo "Waiting 30 seconds..."
sleep 30

# Bước 4: Kiểm tra trạng thái
echo -e "\n4. 📊 Kiểm tra trạng thái:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Bước 5: Kiểm tra logs nếu có lỗi
echo -e "\n5. 🔍 Kiểm tra logs containers:"
echo "Test containers health:"
docker-compose -f docker-compose.test.yml ps

echo -e "\nApp containers health:"
docker-compose -f docker-compose.app.yml ps

# Bước 6: Test ports
echo -e "\n6. 🌐 Test ports:"
sleep 10
curl -I -m 5 http://127.0.0.1:4001/health 2>/dev/null && echo "✅ Test backend OK" || echo "❌ Test backend failed"
curl -I -m 5 http://127.0.0.1:4002/health 2>/dev/null && echo "✅ App backend OK" || echo "❌ App backend failed"
curl -I -m 5 http://127.0.0.1:8081 2>/dev/null && echo "✅ Test frontend OK" || echo "❌ Test frontend failed"
curl -I -m 5 http://127.0.0.1:8083 2>/dev/null && echo "✅ App frontend OK" || echo "❌ App frontend failed"

# Bước 7: Cập nhật nginx
echo -e "\n7. 🔄 Cập nhật nginx config:"
sudo cp nginx-production.conf /etc/nginx/sites-available/vphone
sudo nginx -t && sudo systemctl reload nginx

echo -e "\n8. 🎯 Test final:"
curl -I -m 5 http://test.vphone.vn/health 2>/dev/null && echo "✅ test.vphone.vn OK" || echo "❌ test.vphone.vn failed"
curl -I -m 5 http://app.vphone.vn/health 2>/dev/null && echo "✅ app.vphone.vn OK" || echo "❌ app.vphone.vn failed"

echo -e "\n🎉 Hoàn tất! Nếu vẫn lỗi, xem logs:"
echo "docker-compose -f docker-compose.test.yml logs"
echo "docker-compose -f docker-compose.app.yml logs" 