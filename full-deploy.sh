#!/bin/bash

# Script triển khai tổng hợp VPhone System
# Bao gồm dọn dẹp PM2 và deploy cả 2 hệ thống
echo "🚀 VPhone System - Triển Khai Tổng Hợp"
echo "======================================"

# Bước 1: Dọn dẹp hệ thống cũ
echo "🧹 Bước 1: Dọn dẹp hệ thống cũ (PM2, ports, v.v.)"
if [ -f "./cleanup-pm2.sh" ]; then
    ./cleanup-pm2.sh
else
    echo "⚠️  Không tìm thấy cleanup-pm2.sh, bỏ qua bước dọn dẹp"
fi

echo ""
echo "⏳ Chờ 10 giây để hệ thống ổn định..."
sleep 10

# Bước 2: Deploy test.vphone.vn
echo ""
echo "🎯 Bước 2: Triển khai test.vphone.vn"
if [ -f "./deploy-test.sh" ]; then
    ./deploy-test.sh
else
    echo "❌ Không tìm thấy deploy-test.sh"
    exit 1
fi

echo ""
echo "⏳ Chờ 30 giây trước khi deploy hệ thống thứ 2..."
sleep 30

# Bước 3: Deploy app.vphone.vn
echo ""
echo "🎯 Bước 3: Triển khai app.vphone.vn"
if [ -f "./deploy-app.sh" ]; then
    ./deploy-app.sh
else
    echo "❌ Không tìm thấy deploy-app.sh"
    exit 1
fi

# Bước 4: Kiểm tra tổng quan
echo ""
echo "📊 Bước 4: Kiểm tra tổng quan hệ thống"
echo "======================================"

echo "🐳 Docker containers đang chạy:"
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "🌐 Kiểm tra health endpoints:"
echo "Test environment: http://$(hostname -I | awk '{print $1}'):8082/health"
echo "App environment: http://$(hostname -I | awk '{print $1}'):8084/health"

echo ""
echo "🎉 Triển khai hoàn tất!"
echo "========================="
echo "✅ test.vphone.vn: Port 8082"
echo "✅ app.vphone.vn: Port 8084"
echo ""
echo "🔗 Cấu hình DNS:"
echo "   test.vphone.vn → VPS-IP:8082"
echo "   app.vphone.vn → VPS-IP:8084"
echo ""
echo "📚 Xem logs:"
echo "   docker-compose -f docker-compose.test.yml logs -f"
echo "   docker-compose -f docker-compose.app.yml logs -f" 