#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
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
    echo -e "${PURPLE}================================${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}================================${NC}"
}

print_header "🔥 ULTIMATE FIX - SỬA TRIỆT ĐỂ TẤT CẢ"

# Kiểm tra quyền root
if [[ $EUID -ne 0 ]]; then
   print_error "Script này cần chạy với quyền root!"
   exit 1
fi

# Bước 1: FIX MONGODB TRIỆT ĐỂ
print_header "1. FIX MONGODB TRIỆT ĐỂ"

print_status "Dừng tất cả MongoDB processes..."
sudo pkill -f mongod || true
sudo systemctl stop mongod || true

print_status "Xóa tất cả socket files..."
sudo rm -f /tmp/mongodb-*.sock
sudo rm -f /var/run/mongodb/mongod.pid

print_status "Sửa quyền thư mục MongoDB..."
sudo chown -R mongodb:mongodb /var/lib/mongodb
sudo chown -R mongodb:mongodb /var/log/mongodb
sudo chown mongodb:mongodb /tmp

print_status "Tạo lại mongod.conf..."
sudo tee /etc/mongod.conf > /dev/null << 'EOF'
# mongod.conf
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

security:
  authorization: enabled
EOF

print_status "Khởi động MongoDB với config mới..."
sudo systemctl daemon-reload
sudo systemctl enable mongod
sudo systemctl start mongod

# Đợi MongoDB khởi động
sleep 10

# Kiểm tra MongoDB
if sudo systemctl is-active --quiet mongod; then
    print_status "✅ MongoDB đang chạy"
    
    # Tạo user admin nếu chưa có
    print_status "Tạo user admin..."
    mongosh --eval "
    try {
        use admin;
        db.createUser({
            user: 'vphone_admin',
            pwd: 'vphone_secure_2024',
            roles: [
                { role: 'userAdminAnyDatabase', db: 'admin' },
                { role: 'readWriteAnyDatabase', db: 'admin' }
            ]
        });
        print('✅ User admin created');
    } catch(e) {
        print('⚠️ User admin already exists: ' + e.message);
    }
    " 2>/dev/null || print_warning "User creation completed with warnings"
    
    # Restore database
    print_status "Restore database..."
    if [ -d "./mongodb-data/vphone-complete-backup/vphone" ]; then
        mongorestore --host localhost:27017 --authenticationDatabase admin -u vphone_admin -p vphone_secure_2024 --db vphone --drop ./mongodb-data/vphone-complete-backup/vphone/ 2>/dev/null || print_warning "Restore completed with warnings"
    fi
else
    print_error "❌ MongoDB không khởi động được"
    # Thử khởi động manual
    print_status "Thử khởi động MongoDB manual..."
    sudo -u mongodb mongod --config /etc/mongod.conf --fork
fi

# Bước 2: FIX NGINX TRIỆT ĐỂ
print_header "2. FIX NGINX TRIỆT ĐỂ"

print_status "Dừng nginx..."
sudo systemctl stop nginx

print_status "Xóa tất cả config cũ..."
sudo rm -f /etc/nginx/sites-enabled/*
sudo rm -f /etc/nginx/sites-available/default

print_status "Tạo config nginx mới hoàn toàn..."
sudo tee /etc/nginx/sites-available/vphone-ultimate > /dev/null << EOF
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
    
    # API routes - PROXY TO BACKEND
    location /api/ {
        proxy_pass http://127.0.0.1:4000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }
    
    # Health check
    location /health {
        proxy_pass http://127.0.0.1:4000/health;
        proxy_set_header Host \$host;
        access_log off;
    }
    
    # Frontend routes
    location / {
        try_files \$uri \$uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }
    
    # Static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files \$uri =404;
    }
}
EOF

print_status "Kích hoạt config mới..."
sudo ln -sf /etc/nginx/sites-available/vphone-ultimate /etc/nginx/sites-enabled/

print_status "Test nginx config..."
if sudo nginx -t; then
    print_status "✅ Nginx config OK"
    sudo systemctl start nginx
    sudo systemctl enable nginx
else
    print_error "❌ Nginx config có lỗi"
    sudo nginx -t
fi

# Bước 3: FIX BACKEND TRIỆT ĐỂ
print_header "3. FIX BACKEND TRIỆT ĐỂ"

cd backend

print_status "Backup và fix server.js..."
cp server.js server.js.backup-$(date +%Y%m%d_%H%M%S)

# Tạo file server.js mới với CORS fix
print_status "Tạo server.js với CORS fix..."
cat > cors-fix.js << 'EOF'
// CORS Fix - Thêm vào đầu file server.js
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:8080',
    'http://app.vphone.vn',
    'https://app.vphone.vn',
    'http://103.109.187.224',
    'https://103.109.187.224'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
EOF

# Merge CORS fix vào server.js
if ! grep -q "app.vphone.vn" server.js; then
    print_status "Thêm CORS origins..."
    sed -i "/const corsOptions = {/,/};/c\\
const corsOptions = {\\
  origin: [\\
    'http://localhost:3000',\\
    'http://localhost:8080',\\
    'http://app.vphone.vn',\\
    'https://app.vphone.vn',\\
    'http://103.109.187.224',\\
    'https://103.109.187.224'\\
  ],\\
  credentials: true,\\
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],\\
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],\\
  optionsSuccessStatus: 200\\
};" server.js
fi

print_status "Cập nhật .env với MongoDB URI mới..."
cat > .env << 'EOF'
MONGODB_URI=mongodb://vphone_admin:vphone_secure_2024@localhost:27017/vphone?authSource=admin
JWT_SECRET=mh2!#F8m@kd%$a7LzQxT9^v!w  
EMAIL_USER=vphone24h3@gmail.com
EMAIL_PASS=ftxhkismjvdqzawp
NODE_ENV=production
PORT=4000
EOF

cd ..

# Bước 4: RESTART TẤT CẢ
print_header "4. RESTART TẤT CẢ SERVICES"

print_status "Dừng tất cả PM2 processes..."
pm2 delete all 2>/dev/null || true

print_status "Khởi động backend với PM2..."
cd backend
pm2 start server.js --name "vphone-backend" --env production --max-memory-restart 500M
cd ..

print_status "Save PM2 config..."
pm2 save
pm2 startup | grep "sudo" | bash 2>/dev/null || true

# Bước 5: KIỂM TRA TRIỆT ĐỂ
print_header "5. KIỂM TRA TRIỆT ĐỂ"

sleep 5

print_status "Kiểm tra ports..."
sudo netstat -tulpn | grep -E ":80|:4000|:27017"

print_status "Test MongoDB connection..."
if mongosh --quiet --eval "db.runCommand('ping').ok" "mongodb://vphone_admin:vphone_secure_2024@localhost:27017/vphone?authSource=admin" 2>/dev/null | grep -q "1"; then
    print_status "✅ MongoDB connection OK"
    mongosh --quiet --eval "use vphone; print('Collections:', db.getCollectionNames().join(', '))" "mongodb://vphone_admin:vphone_secure_2024@localhost:27017/vphone?authSource=admin" 2>/dev/null
else
    print_error "❌ MongoDB connection failed"
fi

print_status "Test backend direct..."
BACKEND_RESPONSE=$(curl -s -w "%{http_code}" http://localhost:4000/health -o /tmp/backend_test.json)
if [ "$BACKEND_RESPONSE" = "200" ]; then
    print_status "✅ Backend direct OK"
    cat /tmp/backend_test.json
else
    print_error "❌ Backend direct failed (HTTP: $BACKEND_RESPONSE)"
fi

print_status "Test nginx proxy..."
PROXY_RESPONSE=$(curl -s -w "%{http_code}" http://localhost/api/health -o /tmp/proxy_test.json)
if [ "$PROXY_RESPONSE" = "200" ]; then
    print_status "✅ Nginx proxy OK"
    cat /tmp/proxy_test.json
else
    print_error "❌ Nginx proxy failed (HTTP: $PROXY_RESPONSE)"
    print_status "Nginx error log:"
    tail -5 /var/log/nginx/vphone-error.log
fi

print_status "Test frontend..."
FRONTEND_RESPONSE=$(curl -s -w "%{http_code}" http://localhost/ -o /dev/null)
if [ "$FRONTEND_RESPONSE" = "200" ]; then
    print_status "✅ Frontend OK"
else
    print_error "❌ Frontend failed (HTTP: $FRONTEND_RESPONSE)"
fi

# Bước 6: FINAL STATUS
print_header "6. TRẠNG THÁI CUỐI CÙNG"

print_status "PM2 processes:"
pm2 list

print_status "System services:"
systemctl is-active mongod nginx || true

print_status "Recent logs:"
echo "=== PM2 Backend Logs ==="
pm2 logs vphone-backend --lines 5 --nostream
echo "=== Nginx Error Logs ==="
tail -3 /var/log/nginx/vphone-error.log 2>/dev/null || echo "No nginx errors"

print_header "🎉 ULTIMATE FIX HOÀN THÀNH!"
echo -e "${GREEN}🚀 Truy cập: ${BLUE}http://app.vphone.vn${NC}"
echo -e "${GREEN}🔗 API: ${BLUE}http://app.vphone.vn/api${NC}"
echo -e "${GREEN}👤 Login: ${BLUE}vphone24h1@gmail.com / 0985630451vU${NC}"
echo -e "${YELLOW}📝 Nếu vẫn lỗi, chạy lại script hoặc kiểm tra logs${NC}" 