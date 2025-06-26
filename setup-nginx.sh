#!/bin/bash

# Script cài đặt và cấu hình nginx cho VPS
echo "🌐 Cài đặt Nginx cho VPhone System"
echo "=================================="

# Cài đặt nginx
echo "📦 Cài đặt nginx..."
sudo apt update
sudo apt install -y nginx

# Dừng nginx để cấu hình
echo "⏹️  Dừng nginx để cấu hình..."
sudo systemctl stop nginx

# Backup cấu hình nginx gốc
echo "💾 Backup cấu hình nginx gốc..."
sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup

# Copy cấu hình nginx-production.conf
echo "📋 Copy cấu hình nginx mới..."
sudo cp nginx-production.conf /etc/nginx/sites-available/vphone

# Xóa cấu hình default
sudo rm -f /etc/nginx/sites-enabled/default

# Enable cấu hình vphone
sudo ln -sf /etc/nginx/sites-available/vphone /etc/nginx/sites-enabled/

# Test cấu hình nginx
echo "🧪 Test cấu hình nginx..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Cấu hình nginx hợp lệ!"
    
    # Khởi động nginx
    echo "🚀 Khởi động nginx..."
    sudo systemctl start nginx
    sudo systemctl enable nginx
    
    echo "📊 Trạng thái nginx:"
    sudo systemctl status nginx --no-pager
    
    echo ""
    echo "✅ Nginx đã được cài đặt và cấu hình thành công!"
    echo "🌐 Nginx đang lắng nghe trên port 80 cho:"
    echo "   - test.vphone.vn"
    echo "   - app.vphone.vn"
    
else
    echo "❌ Cấu hình nginx có lỗi!"
    echo "🔍 Kiểm tra lại file nginx-production.conf"
    exit 1
fi

echo ""
echo "🔗 Bước tiếp theo:"
echo "1. Cấu hình DNS: test.vphone.vn → IP-VPS"
echo "2. Cấu hình DNS: app.vphone.vn → IP-VPS"
echo "3. Chạy ./full-deploy.sh để deploy cả 2 hệ thống" 