#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================${NC}"
}

print_header "🔧 SỬA TẤT CẢ CÁC LỖI VPHONE"

# Bước 1: Sửa MongoDB socket issue
print_header "1. SỬA MONGODB SOCKET ISSUE"
print_status "Xóa socket file bị lỗi..."
sudo rm -f /tmp/mongodb-27017.sock

print_status "Sửa quyền thư mục tmp..."
sudo chown mongodb:mongodb /tmp 2>/dev/null || true

print_status "Restart MongoDB..."
sudo systemctl stop mongod
sleep 2
sudo systemctl start mongod
sleep 3

print_status "Kiểm tra MongoDB status..."
if sudo systemctl is-active --quiet mongod; then
    print_status "✅ MongoDB đang chạy"
else
    print_warning "⚠️ MongoDB chưa chạy, thử lại..."
    sudo systemctl restart mongod
    sleep 5
fi

# Bước 2: Sửa Nginx config
print_header "2. SỬA NGINX CONFIG"
print_status "Xóa config cũ..."
sudo rm -f /etc/nginx/sites-enabled/default
sudo rm -f /etc/nginx/sites-enabled/vphone

print_status "Liên kết config mới..."
sudo ln -sf /etc/nginx/sites-available/vphone-prod /etc/nginx/sites-enabled/

print_status "Test nginx config..."
if sudo nginx -t; then
    print_status "✅ Nginx config OK"
    sudo systemctl restart nginx
else
    print_error "❌ Nginx config có lỗi"
fi

# Bước 3: Sửa CORS trong backend
print_header "3. SỬA CORS BACKEND"
cd backend

print_status "Backup server.js..."
cp server.js server.js.backup

print_status "Cập nhật CORS origins..."
# Sửa CORS để chấp nhận app.vphone.vn
sed -i "s|'http://localhost:8080'|'http://localhost:8080',\n    'http://app.vphone.vn',\n    'https://app.vphone.vn'|g" server.js

print_status "✅ CORS đã được cập nhật"

# Bước 4: Restart PM2
print_header "4. RESTART PM2 BACKEND"
cd ..
print_status "Restart PM2 backend..."
pm2 restart vphone-backend

sleep 3

# Bước 5: Test tất cả
print_header "5. KIỂM TRA KẾT QUẢ"

print_status "Test MongoDB connection..."
if mongosh --eval "db.runCommand('ping')" "mongodb://vphone_admin:vphone_secure_2024@localhost:27017/vphone?authSource=admin" > /dev/null 2>&1; then
    print_status "✅ MongoDB kết nối OK"
else
    print_warning "⚠️ MongoDB chưa kết nối được"
fi

print_status "Test backend health..."
if curl -s http://localhost:4000/health > /dev/null; then
    print_status "✅ Backend health OK"
    curl -s http://localhost:4000/health | head -1
else
    print_warning "⚠️ Backend chưa phản hồi"
fi

print_status "Test nginx proxy..."
if curl -s http://localhost/api/health > /dev/null; then
    print_status "✅ Nginx proxy OK"
else
    print_warning "⚠️ Nginx proxy chưa hoạt động"
fi

print_status "Test frontend..."
if curl -s -I http://localhost/ | grep -q "200 OK"; then
    print_status "✅ Frontend OK"
else
    print_warning "⚠️ Frontend có vấn đề"
fi

# Hiển thị status cuối cùng
print_header "6. TRẠNG THÁI CUỐI CÙNG"
print_status "PM2 processes:"
pm2 list

print_status "MongoDB status:"
sudo systemctl status mongod --no-pager -l | head -3

print_status "Nginx status:"
sudo systemctl status nginx --no-pager -l | head -3

print_header "🎉 HOÀN THÀNH!"
echo -e "${GREEN}Truy cập ứng dụng tại: ${BLUE}http://app.vphone.vn${NC}"
echo -e "${GREEN}API endpoint: ${BLUE}http://app.vphone.vn/api${NC}"
echo -e "${GREEN}Login: ${BLUE}vphone24h1@gmail.com / 0985630451vU${NC}" 