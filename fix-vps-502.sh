#!/bin/bash

echo "🔧 SCRIPT TỰ ĐỘNG SỬA LỖI 502 BAD GATEWAY - VPS"
echo "=============================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Bước 1: Dừng tất cả services
echo "🛑 Bước 1: Dừng tất cả services..."
pm2 stop all
sudo systemctl stop nginx
print_status "Đã dừng PM2 và Nginx"

# Bước 2: Sửa MongoDB Authentication
echo "🗄️ Bước 2: Sửa MongoDB Authentication..."
sudo systemctl start mongod
sleep 3

# Tạo script MongoDB
cat > /tmp/fix_mongo.js << 'EOF'
use vphone
try {
    db.createUser({
        user: "vphone_admin",
        pwd: "vphone_secure_2024",
        roles: ["readWrite"]
    })
    print("✅ User vphone_admin đã được tạo thành công")
} catch(e) {
    if (e.code === 11000) {
        print("⚠️ User vphone_admin đã tồn tại")
    } else {
        print("❌ Lỗi tạo user: " + e.message)
    }
}
EOF

# Chạy script MongoDB
mongo < /tmp/fix_mongo.js
rm /tmp/fix_mongo.js
print_status "Đã sửa MongoDB authentication"

# Bước 3: Test MongoDB connection
echo "🧪 Bước 3: Test MongoDB connection..."
mongo -u vphone_admin -p vphone_secure_2024 --authenticationDatabase vphone --eval "print('MongoDB connection OK')" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    print_status "MongoDB connection thành công"
else
    print_error "MongoDB connection thất bại"
    
    # Thử tắt authentication tạm thời
    print_warning "Thử tắt authentication MongoDB..."
    sudo cp /etc/mongod.conf /etc/mongod.conf.backup
    sudo sed -i 's/^security:/# security:/' /etc/mongod.conf
    sudo sed -i 's/^  authorization: enabled/# authorization: enabled/' /etc/mongod.conf
    sudo systemctl restart mongod
    sleep 3
    
    # Tạo user lại
    mongo vphone --eval "
    try {
        db.createUser({
            user: 'vphone_admin',
            pwd: 'vphone_secure_2024',
            roles: ['readWrite']
        })
        print('User created successfully')
    } catch(e) {
        print('User already exists or error: ' + e.message)
    }
    "
    
    # Bật lại authentication
    sudo cp /etc/mongod.conf.backup /etc/mongod.conf
    sudo systemctl restart mongod
    sleep 3
    print_status "Đã sửa MongoDB với cách khác"
fi

# Bước 4: Sửa Nginx config trùng lặp
echo "🌐 Bước 4: Sửa Nginx config..."

# Xóa config cũ
sudo rm -f /etc/nginx/sites-enabled/default
sudo rm -f /etc/nginx/sites-enabled/vphone-*

# Tạo config mới cho app.vphone.vn
cat > /tmp/vphone-app.conf << 'EOF'
server {
    listen 80;
    server_name app.vphone.vn;
    
    root /root/vphone/iphone-inventory/dist;
    index index.html;
    
    client_max_body_size 50M;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # API routes
    location /api/ {
        proxy_pass http://localhost:4000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Health check
    location /health {
        proxy_pass http://localhost:4000/health;
        access_log off;
    }
    
    # Frontend routes
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

sudo mv /tmp/vphone-app.conf /etc/nginx/sites-available/
sudo ln -sf /etc/nginx/sites-available/vphone-app.conf /etc/nginx/sites-enabled/
print_status "Đã tạo Nginx config mới"

# Test nginx config
sudo nginx -t
if [ $? -ne 0 ]; then
    print_error "Nginx config có lỗi"
    exit 1
fi

# Bước 5: Khởi động lại tất cả
echo "🚀 Bước 5: Khởi động lại services..."

# Start MongoDB
sudo systemctl start mongod
sleep 3

# Start backend với PM2
cd /root/vphone/backend
pm2 start server.js --name "vphone-backend" --env production
sleep 5

# Start nginx
sudo systemctl start nginx
print_status "Đã khởi động tất cả services"

# Bước 6: Kiểm tra tất cả
echo "🔍 Bước 6: Kiểm tra hệ thống..."

# Check MongoDB
print_warning "Kiểm tra MongoDB..."
sudo systemctl is-active mongod
mongo -u vphone_admin -p vphone_secure_2024 --authenticationDatabase vphone --eval "print('MongoDB OK')" 2>/dev/null && print_status "MongoDB hoạt động" || print_error "MongoDB lỗi"

# Check PM2
print_warning "Kiểm tra PM2..."
pm2 list | grep "vphone-backend" && print_status "PM2 backend hoạt động" || print_error "PM2 backend lỗi"

# Check backend port
print_warning "Kiểm tra Backend port 4000..."
netstat -tulpn | grep :4000 && print_status "Backend port 4000 OK" || print_error "Backend port 4000 không hoạt động"

# Check nginx
print_warning "Kiểm tra Nginx..."
sudo systemctl is-active nginx && print_status "Nginx hoạt động" || print_error "Nginx lỗi"

# Test backend health
print_warning "Test backend health..."
curl -s http://localhost:4000/health > /dev/null && print_status "Backend health OK" || print_error "Backend health lỗi"

# Test website
print_warning "Test website..."
curl -s -I http://app.vphone.vn | grep "200 OK" && print_status "Website OK" || print_error "Website lỗi"

echo ""
echo "🎉 HOÀN THÀNH! Kiểm tra website tại: http://app.vphone.vn"
echo ""
echo "📋 Nếu vẫn lỗi, chạy:"
echo "   pm2 logs vphone-backend --lines 10"
echo "   sudo tail -20 /var/log/nginx/error.log"
echo "   curl -v http://localhost:4000/health" 