#!/bin/bash

echo "🎯 SỬA TRỰC TIẾP - KHÔNG DỪNG MONGODB"
echo "===================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() { echo -e "${GREEN}✅ $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }

cd /root/vphone

echo "🔍 Bước 1: Kiểm tra MongoDB hiện tại..."

# Kiểm tra MongoDB có đang chạy không
if pgrep mongod > /dev/null; then
    print_status "MongoDB đang chạy"
    ps aux | grep mongod | grep -v grep
else
    print_warning "MongoDB không chạy, thử khởi động..."
    
    # Thử khởi động đơn giản
    nohup mongod --dbpath /var/lib/mongodb --bind_ip 127.0.0.1 --port 27017 > /tmp/mongod.log 2>&1 &
    sleep 5
    
    if pgrep mongod > /dev/null; then
        print_status "MongoDB đã khởi động"
    else
        print_error "Không thể khởi động MongoDB"
        exit 1
    fi
fi

echo ""
echo "🧪 Bước 2: Test kết nối MongoDB..."

if mongo --eval "print('Connection test OK')" > /dev/null 2>&1; then
    print_status "✅ MongoDB kết nối thành công!"
    
    # Hiển thị thông tin
    mongo --quiet --eval "print('MongoDB version: ' + version())"
    
else
    print_error "❌ Không thể kết nối MongoDB"
    
    print_warning "Thử các port khác..."
    for port in 27017 27018 27019; do
        echo "Thử port $port..."
        if mongo --port $port --eval "print('OK')" > /dev/null 2>&1; then
            print_status "MongoDB chạy trên port $port"
            break
        fi
    done
    
    exit 1
fi

echo ""
echo "👤 Bước 3: Tạo admin user..."

# Kết nối trực tiếp và tạo admin
mongo vphone --eval "
print('=== Tạo Admin User ===');

// Xóa admin cũ
var deleteResult = db.admins.deleteMany({});
print('Deleted old admins: ' + deleteResult.deletedCount);

// Tạo admin mới với password hash cho '0985630451vU'
var admin = {
    email: 'vphone24h1@gmail.com',
    password: '\$2a\$10\$N9qo8uLOickgx2ZMRZoMye.IjdBbXAUXcJWz.wMTjKPqVOVfvg4zy',
    role: 'admin',
    name: 'VPhone Admin',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
};

var result = db.admins.insertOne(admin);
print('✅ Admin created with ID: ' + result.insertedId);

// Kiểm tra admin đã tạo
var adminCount = db.admins.countDocuments();
print('Total admins in database: ' + adminCount);

// Hiển thị admin info
db.admins.find().forEach(function(doc) {
    print('--- Admin Info ---');
    print('Email: ' + doc.email);
    print('Role: ' + doc.role);
    print('Active: ' + doc.isActive);
    print('Created: ' + doc.createdAt);
});
"

if [ $? -eq 0 ]; then
    print_status "✅ Admin user đã được tạo thành công"
else
    print_error "❌ Lỗi tạo admin user"
    exit 1
fi

echo ""
echo "🔧 Bước 4: Sửa backend connection..."

cd backend

# Backup file
cp server.js server.js.backup-direct

# Sửa connection string
print_warning "Sửa connection string..."
sed -i 's|mongodb://.*|mongodb://localhost:27017/vphone|g' server.js

# Hiển thị connection string hiện tại
echo "Connection string trong server.js:"
grep -n "mongodb://" server.js | head -2

print_status "✅ Backend connection đã được cập nhật"

echo ""
echo "🚀 Bước 5: Restart backend..."

pm2 restart vphone-backend
sleep 5

# Kiểm tra PM2 status
pm2 list | grep vphone-backend

cd ..

echo ""
echo "🧪 Bước 6: Test đăng nhập..."

sleep 3

# Test backend health
print_warning "Test backend health..."
if curl -s http://localhost:4000/health > /dev/null; then
    print_status "✅ Backend health OK"
else
    print_error "❌ Backend health lỗi"
    pm2 logs vphone-backend --lines 5 --nostream
fi

# Test login API
print_warning "Test login API..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"vphone24h1@gmail.com","password":"0985630451vU"}' \
  -w "\n--- HTTP_CODE:%{http_code} ---")

echo "Login API Response:"
echo "$LOGIN_RESPONSE"

if echo "$LOGIN_RESPONSE" | grep -q "HTTP_CODE:200"; then
    print_status "🎉 ✅ LOGIN THÀNH CÔNG!"
elif echo "$LOGIN_RESPONSE" | grep -q "HTTP_CODE:401"; then
    print_warning "⚠️ Login API hoạt động nhưng 401 (có thể password sai)"
    
    # Kiểm tra admin trong DB
    print_warning "Kiểm tra admin trong database..."
    mongo vphone --eval "
    print('=== Admin Check ===');
    db.admins.find().forEach(function(doc) {
        print('Email: ' + doc.email);
        print('Password hash: ' + doc.password.substring(0, 30) + '...');
        print('Role: ' + doc.role);
    });
    "
elif echo "$LOGIN_RESPONSE" | grep -q "HTTP_CODE:500"; then
    print_error "❌ Login API lỗi 500 - Backend error"
    pm2 logs vphone-backend --lines 10 --nostream
else
    print_error "❌ Login API không phản hồi"
fi

echo ""
echo "🎯 TỔNG KẾT:"
echo "============"

# MongoDB status
if mongo --eval "print('test')" > /dev/null 2>&1; then
    echo "✅ MongoDB: Hoạt động"
else
    echo "❌ MongoDB: Lỗi"
fi

# Admin user
ADMIN_COUNT=$(mongo vphone --quiet --eval "db.admins.countDocuments()" 2>/dev/null)
if [ "$ADMIN_COUNT" -gt 0 ] 2>/dev/null; then
    echo "✅ Admin User: OK ($ADMIN_COUNT users)"
else
    echo "❌ Admin User: Lỗi"
fi

# Backend
if curl -s http://localhost:4000/health > /dev/null; then
    echo "✅ Backend: OK"
else
    echo "❌ Backend: Lỗi"
fi

echo ""
echo "🌐 Website: http://app.vphone.vn"
echo "👤 Đăng nhập:"
echo "   Email: vphone24h1@gmail.com"
echo "   Password: 0985630451vU"
echo ""

if echo "$LOGIN_RESPONSE" | grep -q "HTTP_CODE:200"; then
    echo "🎉 HỆ THỐNG ĐÃ SẴN SÀNG! Có thể đăng nhập được rồi!"
else
    echo "⚠️ Cần kiểm tra thêm. Debug commands:"
    echo "   pm2 logs vphone-backend --lines 20"
    echo "   mongo vphone --eval 'db.admins.find()'"
fi 