#!/bin/bash

# Script triển khai hệ thống app.vphone.vn
# Chạy lệnh: ./deploy-app.sh

echo "🚀 Bắt đầu triển khai hệ thống app.vphone.vn..."

# Dừng các container cũ nếu có
echo "⏹️  Dừng các container cũ..."
docker-compose -f docker-compose.app.yml down

# Xóa các image cũ để build lại
echo "🧹 Dọn dẹp images cũ..."
docker-compose -f docker-compose.app.yml down --rmi all

# Build và khởi chạy
echo "🔨 Build và khởi chạy containers..."
docker-compose -f docker-compose.app.yml up --build -d

# Kiểm tra trạng thái
echo "⏳ Chờ các services khởi động..."
sleep 30

echo "📊 Kiểm tra trạng thái containers:"
docker-compose -f docker-compose.app.yml ps

echo "✅ Triển khai hoàn tất!"
echo "🌐 Hệ thống app.vphone.vn đang chạy trên:"
echo "   - MongoDB: Port 27019"
echo "   - Backend API: Port 4002"
echo "   - Frontend: Port 8083"
echo "   - Nginx: Port 8084"
echo ""
echo "🔍 Để xem logs:"
echo "   docker-compose -f docker-compose.app.yml logs -f" 