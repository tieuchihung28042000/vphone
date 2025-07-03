#!/bin/bash

# Script sửa lỗi repositories Ubuntu
# Sử dụng: ./scripts/fix-repositories.sh

set -e

echo "🔧 Sửa lỗi repositories Ubuntu..."

# Sửa lỗi Cloudflare repository
echo "🗑️  Xóa Cloudflare repository bị lỗi..."
sudo rm -f /etc/apt/sources.list.d/cloudflare*.list 2>/dev/null || true
sudo rm -f /etc/apt/sources.list.d/cloudflared*.list 2>/dev/null || true

# Sửa lỗi Tailscale repository nếu có
echo "🔍 Kiểm tra Tailscale repository..."
if [ -f /etc/apt/sources.list.d/tailscale.list ]; then
    echo "✅ Tailscale repository OK"
else
    echo "⚠️  Tailscale repository không tồn tại"
fi

# Cập nhật package list
echo "📦 Cập nhật package list..."
sudo apt-get update 2>&1 | grep -v "does not have a Release file" || true

# Kiểm tra các repository quan trọng
echo "🔍 Kiểm tra repositories quan trọng..."

# Kiểm tra Docker repository
if apt-cache policy docker-ce | grep -q "download.docker.com"; then
    echo "✅ Docker repository OK"
else
    echo "⚠️  Docker repository có vấn đề"
fi

# Kiểm tra MongoDB repository
if apt-cache policy mongodb-org | grep -q "repo.mongodb.org"; then
    echo "✅ MongoDB repository OK"
else
    echo "⚠️  MongoDB repository có vấn đề"
fi

# Hiển thị danh sách repositories
echo "📋 Danh sách repositories hiện tại:"
find /etc/apt/sources.list.d/ -name "*.list" -exec basename {} \; 2>/dev/null | sort || true

echo ""
echo "✅ Hoàn tất sửa lỗi repositories!"
echo "📝 Lưu ý: Các lỗi repository không quan trọng đã được bỏ qua"
echo "🚀 Bây giờ có thể cài đặt MongoDB và Nginx bình thường" 