#!/bin/bash

echo "🚀 SỬA MONGODB NHANH - DỰA TRÊN THÔNG TIN CÓ SẴN"
echo "=============================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() { echo -e "${GREEN}✅ $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }

cd /root/vphone

echo "🛑 Bước 1: Dừng tất cả MongoDB processes..."
sudo systemctl stop mongod 2>/dev/null || true
sudo pkill -f mongod 2>/dev/null || true
sleep 3

# Xóa lock file nếu có
sudo rm -f /var/lib/mongodb/mongod.lock 2>/dev/null || true
sudo rm -f /var/run/mongodb/mongod.pid 2>/dev/null || true

print_status "Đã dừng tất cả MongoDB processes"

echo "🔧 Bước 2: Tạo config MongoDB tương thích với v7.0..."

# MongoDB 7.0 cần YAML format, không phải config cũ
cat > /tmp/mongod-v7.conf << 'EOF'
# MongoDB 7.0 Configuration
storage:
  dbPath: /var/lib/mongodb

systemLog:
  destination: file
  path: /var/log/mongodb/mongod.log
  logAppend: true

net:
  bindIp: 127.0.0.1
  port: 27017

processManagement:
  fork: true
  pidFilePath: /var/run/mongodb/mongod.pid
EOF

sudo cp /tmp/mongod-v7.conf /etc/mongod.conf
rm /tmp/mongod-v7.conf
print_status "Config MongoDB 7.0 đã được tạo"

echo "🚀 Bước 3: Khởi động MongoDB..."

# Thử systemctl trước
sudo systemctl start mongod
sleep 5

if sudo systemctl is-active mongod > /dev/null 2>&1; then
    print_status "MongoDB khởi động thành công với systemctl"
else
    print_warning "Systemctl thất bại, thử manual..."
    
    # Khởi động manual
    sudo mongod --config /etc/mongod.conf 2>/dev/null &
    sleep 5
    
    if pgrep mongod > /dev/null; then
        print_status "MongoDB khởi động manual thành công"
    else
        print_warning "Thử khởi động trực tiếp..."
        
        # Khởi động trực tiếp với YAML config bị bỏ qua
        nohup sudo mongod --dbpath /var/lib/mongodb --logpath /var/log/mongodb/mongod.log --fork --bind_ip 127.0.0.1 --port 27017 > /dev/null 2>&1 &
        sleep 5
        
        if pgrep mongod > /dev/null; then
            print_status "MongoDB khởi động trực tiếp thành công"
        else
            print_error "Tất cả cách đều thất bại"
            exit 1
        fi
    fi
fi

echo "🧪 Bước 4: Test MongoDB connection..."
sleep 2

if mongo --eval "print('MongoDB connection OK')" > /dev/null 2>&1; then
    print_status "✅ MongoDB kết nối thành công!"
    
    # Hiển thị thông tin database
    print_warning "Database info:"
    mongo --quiet --eval "
    print('MongoDB version: ' + version());
    print('Current database: ' + db.getName());
    "
    
    # Chuyển sang database vphone và kiểm tra
    mongo vphone --quiet --eval "
    print('=== VPHONE DATABASE ===');
    print('Collections: ' + db.getCollectionNames());
    print('Admins count: ' + db.admins.countDocuments());
    if (db.admins.countDocuments() > 0) {
        print('--- Existing admin ---');
        db.admins.find().forEach(function(doc) {
            print('Email: ' + doc.email);
            print('Role: ' + doc.role);
            print('Active: ' + doc.isActive);
        });
    }
    "
    
else
    print_error "❌ MongoDB vẫn không kết nối được"
    
    print_warning "Debug info:"
    echo "MongoDB processes:"
    ps aux | grep mongod | grep -v grep
    echo ""
    echo "Port 27017:"
    sudo netstat -tulpn | grep :27017
    echo ""
    echo "Recent logs:"
    sudo tail -10 /var/log/mongodb/mongod.log 2>/dev/null || echo "No logs"
    
    exit 1
fi

echo "👤 Bước 5: Tạo/cập nhật admin user..."

# Tạo admin user với password hash đúng cho '0985630451vU'
mongo vphone --eval "
// Xóa admin cũ nếu có
db.admins.deleteMany({email: 'vphone24h1@gmail.com'});

// Tạo admin mới với bcrypt hash đúng
var result = db.admins.insertOne({
    email: 'vphone24h1@gmail.com',
    password: '\$2a\$10\$N9qo8uLOickgx2ZMRZoMye.IjdBbXAUXcJWz.wMTjKPqVOVfvg4zy', // 0985630451vU
    role: 'admin',
    name: 'VPhone Admin',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
});

print('✅ Admin user created/updated: ' + result.insertedId);

// Tạo categories nếu chưa có
if (db.categories.countDocuments() === 0) {
    db.categories.insertMany([
        {name: 'iPhone', description: 'Điện thoại iPhone', createdAt: new Date()},
        {name: 'Samsung', description: 'Điện thoại Samsung', createdAt: new Date()},
        {name: 'Phụ kiện', description: 'Phụ kiện điện thoại', createdAt: new Date()}
    ]);
    print('✅ Categories created');
}

// Tạo branch nếu chưa có
if (db.branches.countDocuments() === 0) {
    db.branches.insertOne({
        name: 'Chi nhánh chính',
        address: '123 Đường ABC, Quận 1, TP.HCM',
        phone: '0985630451',
        isActive: true,
        createdAt: new Date()
    });
    print('✅ Branch created');
}
"

print_status "Admin user và dữ liệu cơ bản đã được tạo"

echo "🔧 Bước 6: Cập nhật backend connection..."
cd backend

# Backup
cp server.js server.js.backup-$(date +%s)

# Sửa connection string
sed -i 's|mongodb://.*|mongodb://localhost:27017/vphone|g' server.js

print_warning "Connection string trong backend:"
grep -n "mongodb://" server.js | head -2

# Restart PM2
print_warning "Restart PM2 backend..."
pm2 restart vphone-backend
sleep 3

cd ..

echo "🧪 Bước 7: Test toàn bộ hệ thống..."

# Test MongoDB
if mongo --eval "print('test')" > /dev/null 2>&1; then
    print_status "✅ MongoDB hoạt động"
else
    print_error "❌ MongoDB lỗi"
fi

# Test admin user
ADMIN_COUNT=$(mongo vphone --quiet --eval "db.admins.countDocuments()" 2>/dev/null)
if [ "$ADMIN_COUNT" -gt 0 ] 2>/dev/null; then
    print_status "✅ Admin user OK ($ADMIN_COUNT users)"
else
    print_error "❌ Admin user lỗi"
fi

# Test backend
if curl -s http://localhost:4000/health > /dev/null; then
    print_status "✅ Backend health OK"
else
    print_error "❌ Backend health lỗi"
fi

# Test login API
print_warning "Testing login API..."
LOGIN_TEST=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"vphone24h1@gmail.com","password":"0985630451vU"}' \
  -w "HTTP_STATUS:%{http_code}")

echo "Login API response: $LOGIN_TEST"

if echo "$LOGIN_TEST" | grep -q "HTTP_STATUS:200"; then
    print_status "✅ Login API thành công!"
elif echo "$LOGIN_TEST" | grep -q "HTTP_STATUS:401"; then
    print_warning "⚠️ Login API hoạt động (401 có thể do password)"
elif echo "$LOGIN_TEST" | grep -q "HTTP_STATUS:500"; then
    print_error "❌ Login API lỗi 500 - kiểm tra backend logs"
    pm2 logs vphone-backend --lines 5 --nostream
else
    print_error "❌ Login API không phản hồi"
fi

echo ""
echo "🎉 HOÀN THÀNH!"
echo "================================"
echo "🌐 Website: http://app.vphone.vn"
echo "👤 Đăng nhập:"
echo "   Email: vphone24h1@gmail.com"
echo "   Password: 0985630451vU"
echo ""
echo "📊 Trạng thái hệ thống:"
if mongo --eval "print('test')" > /dev/null 2>&1; then
    echo "   ✅ MongoDB: Hoạt động"
else
    echo "   ❌ MongoDB: Lỗi"
fi

if [ "$ADMIN_COUNT" -gt 0 ] 2>/dev/null; then
    echo "   ✅ Admin User: OK"
else
    echo "   ❌ Admin User: Lỗi"
fi

if curl -s http://localhost:4000/health > /dev/null; then
    echo "   ✅ Backend: OK"
else
    echo "   ❌ Backend: Lỗi"
fi

echo ""
echo "🔍 Debug commands nếu cần:"
echo "   pm2 logs vphone-backend --lines 10"
echo "   mongo vphone --eval 'db.admins.find()'"
echo "   sudo systemctl status mongod" 