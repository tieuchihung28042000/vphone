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

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================${NC}"
}

print_header "🔧 FIX CẤU HÌNH API URL VÀ NGINX"

# Bước 1: Fix backend .env
print_header "1. FIX BACKEND .ENV"
cd backend

print_status "Tạo .env chính xác cho backend..."
cat > .env << 'EOF'
MONGODB_URI=mongodb://vphone_admin:vphone_secure_2024@localhost:27017/vphone?authSource=admin
JWT_SECRET=mh2!#F8m@kd%$a7LzQxT9^v!w  
EMAIL_USER=vphone24h3@gmail.com
EMAIL_PASS=ftxhkismjvdqzawp
NODE_ENV=production
PORT=4000
EOF

print_status "✅ Backend .env created"
cat .env

cd ..

# Bước 2: Fix frontend .env
print_header "2. FIX FRONTEND .ENV"
cd iphone-inventory

print_status "Tạo .env chính xác cho frontend..."
cat > .env << 'EOF'
VITE_API_URL=http://app.vphone.vn
EOF

print_status "✅ Frontend .env created"
cat .env

print_status "Rebuild frontend với API URL mới..."
npm run build

cd ..

# Bước 3: Fix nginx config
print_header "3. FIX NGINX CONFIG"

print_status "Tạo nginx config chính xác (fix double API path)..."
sudo tee /etc/nginx/sites-available/vphone-fixed > /dev/null << 'EOF'
server {
    listen 80;
    server_name app.vphone.vn;
    
    root /root/vphone/iphone-inventory/dist;
    index index.html;
    
    client_max_body_size 50M;
    
    # Logs
    access_log /var/log/nginx/vphone-access.log;
    error_log /var/log/nginx/vphone-error.log;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # API routes - CHÍNH XÁC
    location /api/ {
        # Xóa /api/ và proxy tới backend
        rewrite ^/api/(.*)$ /$1 break;
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 30s;
        proxy_connect_timeout 10s;
        proxy_send_timeout 30s;
    }
    
    # Health check
    location /health {
        proxy_pass http://127.0.0.1:4000/health;
        proxy_set_header Host $host;
        access_log off;
    }
    
    # Frontend routes
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }
    
    # Static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }
}
EOF

print_status "Kích hoạt nginx config mới..."
sudo rm -f /etc/nginx/sites-enabled/*
sudo ln -sf /etc/nginx/sites-available/vphone-fixed /etc/nginx/sites-enabled/

print_status "Test nginx config..."
if sudo nginx -t; then
    print_status "✅ Nginx config OK"
    sudo systemctl restart nginx
else
    print_error "❌ Nginx config có lỗi"
    sudo nginx -t
fi

# Bước 4: Restart PM2
print_header "4. RESTART PM2"
print_status "Restart backend..."
pm2 restart vphone-backend

sleep 3

# Bước 5: Test API paths
print_header "5. TEST API PATHS"

print_status "Test backend direct..."
curl -s http://localhost:4000/health | head -1

print_status "Test qua nginx (should NOT have double /api/)..."
curl -s http://localhost/api/health | head -1

print_status "Test login endpoint..."
curl -s -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test","password":"test"}' | head -1

print_header "6. KIỂM TRA LOGS"
print_status "Recent nginx access logs:"
sudo tail -3 /var/log/nginx/vphone-access.log

print_status "Recent nginx error logs:"
sudo tail -3 /var/log/nginx/vphone-error.log

print_header "🎉 CẤU HÌNH ĐÃ ĐƯỢC FIX!"
echo -e "${GREEN}🔗 Frontend API calls: ${BLUE}http://app.vphone.vn/api/*${NC}"
echo -e "${GREEN}🔗 Nginx proxy to: ${BLUE}http://localhost:4000/*${NC}"
echo -e "${GREEN}🔗 No more double /api/ paths!${NC}"
echo -e "${YELLOW}📝 Test login tại: http://app.vphone.vn${NC}" 