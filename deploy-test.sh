#!/bin/bash

# Script triển khai hệ thống test.vphone.vn
# Chạy lệnh: ./deploy-test.sh

echo "🚀 Bắt đầu triển khai hệ thống test.vphone.vn..."

# Dừng các container cũ nếu có
echo "⏹️  Dừng các container cũ..."
docker-compose -f docker-compose.test.yml down

# Xóa các image cũ để build lại
echo "🧹 Dọn dẹp images cũ..."
docker-compose -f docker-compose.test.yml down --rmi all

# Build và khởi chạy
echo "🔨 Build và khởi chạy containers..."
docker-compose -f docker-compose.test.yml up --build -d

# Kiểm tra trạng thái
echo "⏳ Chờ các services khởi động..."
sleep 30

echo "📊 Kiểm tra trạng thái containers:"
docker-compose -f docker-compose.test.yml ps

echo "✅ Triển khai hoàn tất!"
echo "🌐 Hệ thống test.vphone.vn đang chạy trên:"
echo "   - MongoDB: Port 27018"
echo "   - Backend API: Port 4001"
echo "   - Frontend: Port 8081"
echo "   - Nginx: Port 8082"
echo ""
echo "🔍 Để xem logs:"
echo "   docker-compose -f docker-compose.test.yml logs -f" 