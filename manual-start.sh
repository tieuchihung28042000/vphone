#!/bin/bash

echo "🔧 KHỞI ĐỘNG MONGODB HOÀN TOÀN MANUAL"
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

echo "🛑 Bước 1: Kill tất cả MongoDB processes cũ..."
sudo pkill -9 mongod 2>/dev/null || true
sleep 2
print_status "Đã kill MongoDB processes"

echo ""
echo "📁 Bước 2: Tạo thư mục MongoDB mới..."

# Tạo thư mục mới cho MongoDB
MONGO_DIR="/tmp/vphone-mongodb"
sudo rm -rf $MONGO_DIR
sudo mkdir -p $MONGO_DIR
sudo mkdir -p $MONGO_DIR/logs
sudo chown -R $USER:$USER $MONGO_DIR

print_status "Thư mục MongoDB: $MONGO_DIR"

echo ""
echo "🚀 Bước 3: Khởi động MongoDB manual..."

# Khởi động MongoDB với thư mục mới, không fork
print_warning "Khởi động MongoDB trên port 27017..."

# Chạy MongoDB trong background
nohup mongod \
  --dbpath $MONGO_DIR \
  --logpath $MONGO_DIR/logs/mongod.log \
  --port 27017 \
  --bind_ip 127.0.0.1 \
  --nojournal \
  --smallfiles \
  > /dev/null 2>&1 &

MONGO_PID=$!
sleep 5

# Kiểm tra process
if ps -p $MONGO_PID > /dev/null; then
    print_status "MongoDB đang chạy (PID: $MONGO_PID)"
else
    print_error "MongoDB không khởi động được"
    
    print_warning "Thử với port khác..."
    
    # Thử port 27018
    nohup mongod \
      --dbpath $MONGO_DIR \
      --logpath $MONGO_DIR/logs/mongod.log \
      --port 27018 \
      --bind_ip 127.0.0.1 \
      --nojournal \
      --smallfiles \
      > /dev/null 2>&1 &
    
    MONGO_PID=$!
    sleep 5
    
    if ps -p $MONGO_PID > /dev/null; then
        print_status "MongoDB đang chạy trên port 27018 (PID: $MONGO_PID)"
        MONGO_PORT=27018
    else
        print_error "MongoDB hoàn toàn không khởi động được"
        echo "Logs:"
        cat $MONGO_DIR/logs/mongod.log 2>/dev/null || echo "Không có logs"
        exit 1
    fi
fi

# Set default port
MONGO_PORT=${MONGO_PORT:-27017}

echo ""
echo "🧪 Bước 4: Test kết nối..."

sleep 3

# Test kết nối với port đã xác định
if mongo --port $MONGO_PORT --eval "print('MongoDB connection OK')" > /dev/null 2>&1; then
    print_status "✅ MongoDB kết nối thành công trên port $MONGO_PORT!"
    
    # Hiển thị version
    mongo --port $MONGO_PORT --quiet --eval "print('MongoDB version: ' + version())"
    
else
    print_error "❌ Vẫn không thể kết nối"
    
    print_warning "Debug info:"
    echo "Process:"
    ps aux | grep mongod | grep -v grep
    echo ""
    echo "Ports:"
    netstat -tulpn | grep mongod
    echo ""
    echo "Logs:"
    tail -10 $MONGO_DIR/logs/mongod.log 2>/dev/null || echo "Không có logs"
    
    exit 1
fi

echo ""
echo "👤 Bước 5: Tạo admin user..."

# Tạo admin user với port đã xác định
mongo --port $MONGO_PORT vphone --eval "
print('=== Tạo Admin User trên port $MONGO_PORT ===');

// Xóa admin cũ
db.admins.deleteMany({});

// Tạo admin mới
var admin = {
    email: 'vphone24h1@gmail.com',
    password: '\$2a\$10\$N9qo8uLOickgx2ZMRZoMye.IjdBbXAUXcJWz.wMTjKPqVOVfvg4zy', // 0985630451vU
    role: 'admin',
    name: 'VPhone Admin',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
};

var result = db.admins.insertOne(admin);
print('✅ Admin created: ' + result.insertedId);

// Tạo dữ liệu cơ bản
db.categories.deleteMany({});
db.categories.insertMany([
    {name: 'iPhone', description: 'Điện thoại iPhone', createdAt: new Date()},
    {name: 'Samsung', description: 'Điện thoại Samsung', createdAt: new Date()}
]);

db.branches.deleteMany({});
db.branches.insertOne({
    name: 'Chi nhánh chính',
    address: 'TP.HCM',
    phone: '0985630451',
    isActive: true,
    createdAt: new Date()
});

print('✅ Database setup complete');
print('Admin count: ' + db.admins.countDocuments());
print('Categories count: ' + db.categories.countDocuments());
print('Branches count: ' + db.branches.countDocuments());
"

if [ $? -eq 0 ]; then
    print_status "✅ Admin user và dữ liệu đã được tạo"
else
    print_error "❌ Lỗi tạo admin user"
    exit 1
fi

echo ""
echo "🔧 Bước 6: Cập nhật backend..."

cd backend

# Backup
cp server.js server.js.backup-manual

# Cập nhật connection string với port đúng
print_warning "Cập nhật connection string với port $MONGO_PORT..."
sed -i "s|mongodb://.*|mongodb://localhost:$MONGO_PORT/vphone|g" server.js

echo "Connection string mới:"
grep -n "mongodb://" server.js | head -2

print_status "✅ Backend connection updated"

echo ""
echo "🚀 Bước 7: Restart backend..."

pm2 restart vphone-backend
sleep 5

pm2 list | grep vphone-backend

cd ..

echo ""
echo "🧪 Bước 8: Test đăng nhập..."

sleep 3

# Test backend health
print_warning "Test backend health..."
if curl -s http://localhost:4000/health > /dev/null; then
    print_status "✅ Backend health OK"
else
    print_error "❌ Backend health lỗi"
    pm2 logs vphone-backend --lines 5 --nostream
fi

# Test login
print_warning "Test login API..."
LOGIN_RESULT=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"vphone24h1@gmail.com","password":"0985630451vU"}' \
  -w "\nHTTP_CODE:%{http_code}")

echo "Login result:"
echo "$LOGIN_RESULT"

if echo "$LOGIN_RESULT" | grep -q "HTTP_CODE:200"; then
    print_status "🎉 ✅ LOGIN THÀNH CÔNG!"
    echo ""
    echo "🎯 HỆ THỐNG ĐÃ SẴN SÀNG!"
elif echo "$LOGIN_RESULT" | grep -q "HTTP_CODE:401"; then
    print_warning "⚠️ API hoạt động nhưng 401 - kiểm tra password"
elif echo "$LOGIN_RESULT" | grep -q "HTTP_CODE:500"; then
    print_error "❌ API lỗi 500"
    pm2 logs vphone-backend --lines 10 --nostream
else
    print_error "❌ API không phản hồi"
fi

echo ""
echo "📋 THÔNG TIN HỆ THỐNG:"
echo "======================"
echo "🗄️ MongoDB: localhost:$MONGO_PORT"
echo "📁 Data dir: $MONGO_DIR"
echo "🔧 Backend: localhost:4000"
echo "🌐 Website: http://app.vphone.vn"
echo ""
echo "👤 Đăng nhập:"
echo "   Email: vphone24h1@gmail.com"
echo "   Password: 0985630451vU"
echo ""
echo "🔍 Debug commands:"
echo "   mongo --port $MONGO_PORT vphone --eval 'db.admins.find()'"
echo "   pm2 logs vphone-backend"
echo "   ps aux | grep mongod"

# Lưu thông tin MongoDB để dùng sau
echo "MONGO_PORT=$MONGO_PORT" > /tmp/vphone-mongo-info
echo "MONGO_DIR=$MONGO_DIR" >> /tmp/vphone-mongo-info
echo "MONGO_PID=$MONGO_PID" >> /tmp/vphone-mongo-info

print_status "✅ Thông tin MongoDB đã lưu tại /tmp/vphone-mongo-info" 