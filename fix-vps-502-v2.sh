#!/bin/bash

echo "🔧 SCRIPT SỬA LỖI 502 - PHIÊN BẢN 2 (STATIC FILES)"
echo "=================================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() { echo -e "${GREEN}✅ $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }

# Kiểm tra đang ở VPS
if [ ! -d "/root/vphone" ]; then
    print_error "Script này chỉ chạy trên VPS! Thư mục /root/vphone không tồn tại."
    exit 1
fi

cd /root/vphone

# Bước 1: Dừng tất cả
echo "🛑 Bước 1: Dừng tất cả services..."
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true
sudo systemctl stop nginx 2>/dev/null || true
print_status "Đã dừng tất cả services"

# Bước 2: Sửa MongoDB - Tắt authentication hoàn toàn
echo "🗄️ Bước 2: Sửa MongoDB (tắt authentication)..."
sudo systemctl stop mongod 2>/dev/null || true

# Backup và sửa mongod.conf
sudo cp /etc/mongod.conf /etc/mongod.conf.backup 2>/dev/null || true

# Tạo config MongoDB mới (không authentication)
cat > /tmp/mongod.conf << 'EOF'
# mongod.conf - Simple config without auth
storage:
  dbPath: /var/lib/mongodb
  journal:
    enabled: true

systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod.log

net:
  port: 27017
  bindIp: 127.0.0.1

processManagement:
  timeZoneInfo: /usr/share/zoneinfo

# NO AUTHENTICATION - Simplified
EOF

sudo mv /tmp/mongod.conf /etc/mongod.conf
sudo systemctl start mongod
sleep 5

# Test MongoDB
mongo --eval "print('MongoDB connection test')" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    print_status "MongoDB hoạt động (không authentication)"
else
    print_error "MongoDB vẫn lỗi"
fi

# Bước 3: Sửa backend để không dùng authentication
echo "🔧 Bước 3: Sửa backend MongoDB connection..."

# Backup server.js
cp backend/server.js backend/server.js.backup

# Sửa connection string trong server.js
sed -i 's|mongodb://vphone_admin:vphone_secure_2024@localhost:27017/vphone|mongodb://localhost:27017/vphone|g' backend/server.js

print_status "Đã sửa backend connection string"

# Bước 4: Xóa hoàn toàn nginx config cũ
echo "🌐 Bước 4: Tạo nginx config hoàn toàn mới..."

# Xóa tất cả config cũ
sudo rm -f /etc/nginx/sites-enabled/*
sudo rm -f /etc/nginx/sites-available/default
sudo rm -f /etc/nginx/sites-available/vphone-*

# Tạo config nginx đơn giản - serve static files + API proxy
cat > /tmp/app-vphone.conf << 'EOF'
server {
    listen 80;
    server_name app.vphone.vn;
    
    # Serve static files từ dist folder
    root /root/vphone/iphone-inventory/dist;
    index index.html;
    
    client_max_body_size 50M;
    
    # Logs
    access_log /var/log/nginx/vphone-access.log;
    error_log /var/log/nginx/vphone-error.log;
    
    # API routes - proxy to backend
    location /api/ {
        proxy_pass http://127.0.0.1:4000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 10s;
        proxy_send_timeout 10s;
        proxy_read_timeout 10s;
    }
    
    # Health check
    location /health {
        proxy_pass http://127.0.0.1:4000/health;
        access_log off;
    }
    
    # Static files với cache
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }
    
    # Frontend routes - SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}

# Default server - block other requests
server {
    listen 80 default_server;
    server_name _;
    return 444;
}
EOF

sudo mv /tmp/app-vphone.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/app-vphone.conf /etc/nginx/sites-enabled/
print_status "Đã tạo nginx config mới"

# Test nginx config
sudo nginx -t
if [ $? -ne 0 ]; then
    print_error "Nginx config lỗi!"
    sudo nginx -t
    exit 1
fi

# Bước 5: Build lại frontend với API URL đúng
echo "🏗️ Bước 5: Build lại frontend..."
cd iphone-inventory

# Kiểm tra và sửa vite.config.js
if [ -f "vite.config.js" ]; then
    # Sửa API URL trong vite config
    sed -i "s|http://localhost:4000|http://app.vphone.vn|g" vite.config.js 2>/dev/null || true
fi

# Build frontend
npm run build
if [ $? -eq 0 ]; then
    print_status "Frontend build thành công"
    ls -la dist/
else
    print_error "Frontend build thất bại"
fi

cd ..

# Bước 6: Khởi động backend với PM2
echo "🚀 Bước 6: Khởi động backend..."
cd backend

# Tạo ecosystem.config.js cho PM2
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'vphone-backend',
    script: 'server.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 4000
    },
    log_file: '/root/.pm2/logs/vphone-backend.log',
    error_file: '/root/.pm2/logs/vphone-backend-error.log',
    out_file: '/root/.pm2/logs/vphone-backend-out.log',
    max_restarts: 10,
    min_uptime: '10s'
  }]
}
EOF

# Start với PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup

print_status "Backend đã khởi động với PM2"
cd ..

# Bước 7: Khởi động nginx
echo "🌐 Bước 7: Khởi động nginx..."
sudo systemctl start nginx
sudo systemctl enable nginx
print_status "Nginx đã khởi động"

# Bước 8: Kiểm tra tất cả
echo "🔍 Bước 8: Kiểm tra hệ thống..."

sleep 5

# Check MongoDB
print_warning "MongoDB:"
sudo systemctl is-active mongod && print_status "MongoDB active" || print_error "MongoDB inactive"

# Check PM2
print_warning "PM2 Backend:"
pm2 list | grep "vphone-backend" | grep "online" && print_status "Backend online" || print_error "Backend offline"

# Check backend port
print_warning "Backend Port 4000:"
netstat -tulpn | grep :4000 && print_status "Port 4000 listening" || print_error "Port 4000 not listening"

# Check nginx
print_warning "Nginx:"
sudo systemctl is-active nginx && print_status "Nginx active" || print_error "Nginx inactive"

# Check static files
print_warning "Static Files:"
[ -f "/root/vphone/iphone-inventory/dist/index.html" ] && print_status "Frontend files exist" || print_error "Frontend files missing"

# Test backend health
print_warning "Backend Health:"
curl -s http://localhost:4000/health > /dev/null && print_status "Backend health OK" || print_error "Backend health failed"

# Test website
print_warning "Website Test:"
curl -s -I http://app.vphone.vn | head -1 | grep -E "200|301|302" && print_status "Website responding" || print_error "Website not responding"

echo ""
echo "🎉 HOÀN THÀNH!"
echo "🌐 Website: http://app.vphone.vn"
echo ""
echo "📋 Debug commands:"
echo "   pm2 logs vphone-backend"
echo "   sudo tail -f /var/log/nginx/vphone-error.log"
echo "   curl -v http://localhost:4000/health"
echo "   ls -la /root/vphone/iphone-inventory/dist/" 