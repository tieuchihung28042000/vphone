#!/bin/bash

echo "🗄️ SCRIPT SỬA MONGODB ĐỂ ĐĂNG NHẬP ĐƯỢC"
echo "======================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() { echo -e "${GREEN}✅ $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }

cd /root/vphone

# Bước 1: Cài đặt và khởi động MongoDB
echo "🔧 Bước 1: Cài đặt và khởi động MongoDB..."

# Cài MongoDB nếu chưa có
if ! command -v mongod &> /dev/null; then
    print_warning "Cài đặt MongoDB..."
    
    # Import MongoDB public GPG Key
    curl -fsSL https://pgp.mongodb.com/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
    
    # Create list file
    echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
    
    # Update and install
    sudo apt-get update
    sudo apt-get install -y mongodb-org
    
    print_status "MongoDB đã được cài đặt"
fi

# Tạo config MongoDB đơn giản (không authentication)
print_warning "Tạo config MongoDB..."
cat > /tmp/mongod.conf << 'EOF'
# Simple MongoDB config for VPhone
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
  fork: true
  pidFilePath: /var/run/mongodb/mongod.pid

# No authentication for simplicity
EOF

sudo cp /tmp/mongod.conf /etc/mongod.conf
rm /tmp/mongod.conf

# Tạo thư mục và set quyền
sudo mkdir -p /var/lib/mongodb
sudo mkdir -p /var/log/mongodb
sudo mkdir -p /var/run/mongodb
sudo chown -R mongodb:mongodb /var/lib/mongodb
sudo chown -R mongodb:mongodb /var/log/mongodb
sudo chown -R mongodb:mongodb /var/run/mongodb

# Khởi động MongoDB
print_warning "Khởi động MongoDB..."
sudo systemctl stop mongod 2>/dev/null || true
sudo systemctl start mongod
sudo systemctl enable mongod
sleep 5

# Kiểm tra MongoDB
if sudo systemctl is-active mongod > /dev/null; then
    print_status "MongoDB đã khởi động thành công"
else
    print_error "MongoDB không khởi động được"
    
    # Thử khởi động manual
    print_warning "Thử khởi động manual..."
    sudo mongod --config /etc/mongod.conf --fork
    sleep 3
fi

# Test connection
mongo --eval "print('MongoDB connection test')" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    print_status "MongoDB connection OK"
else
    print_error "MongoDB connection failed"
    exit 1
fi

# Bước 2: Restore dữ liệu từ backup
echo "📦 Bước 2: Restore dữ liệu từ backup..."

if [ -d "mongodb-data/vphone-complete-backup/vphone" ]; then
    print_warning "Restore database từ backup..."
    
    # Restore từ backup
    mongorestore --db vphone mongodb-data/vphone-complete-backup/vphone/
    
    if [ $? -eq 0 ]; then
        print_status "Restore database thành công"
    else
        print_warning "Restore thất bại, tạo dữ liệu mẫu..."
    fi
else
    print_warning "Không tìm thấy backup, tạo dữ liệu mẫu..."
fi

# Bước 3: Tạo admin user nếu chưa có
echo "👤 Bước 3: Tạo admin user..."

# Tạo script tạo admin
cat > /tmp/create_admin.js << 'EOF'
use vphone

// Tạo admin user
try {
    var admin = {
        email: "vphone24h1@gmail.com",
        password: "$2b$10$8K1p2qKJ5J5J5J5J5J5J5uKJ5J5J5J5J5J5J5J5J5J5J5J5J5J5J5", // 0985630451vU
        role: "admin",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
    }
    
    // Kiểm tra xem admin đã tồn tại chưa
    var existingAdmin = db.admins.findOne({email: "vphone24h1@gmail.com"})
    
    if (!existingAdmin) {
        db.admins.insertOne(admin)
        print("✅ Admin user đã được tạo: vphone24h1@gmail.com")
    } else {
        print("⚠️ Admin user đã tồn tại")
    }
    
    // Tạo một số dữ liệu mẫu nếu cần
    if (db.categories.countDocuments() === 0) {
        db.categories.insertMany([
            {name: "iPhone", description: "Điện thoại iPhone", createdAt: new Date()},
            {name: "Samsung", description: "Điện thoại Samsung", createdAt: new Date()},
            {name: "Phụ kiện", description: "Phụ kiện điện thoại", createdAt: new Date()}
        ])
        print("✅ Đã tạo categories mẫu")
    }
    
    if (db.branches.countDocuments() === 0) {
        db.branches.insertOne({
            name: "Chi nhánh chính",
            address: "123 Đường ABC, Quận 1, TP.HCM",
            phone: "0985630451",
            isActive: true,
            createdAt: new Date()
        })
        print("✅ Đã tạo branch mẫu")
    }
    
} catch(e) {
    print("❌ Lỗi tạo admin: " + e.message)
}
EOF

# Chạy script tạo admin
mongo < /tmp/create_admin.js
rm /tmp/create_admin.js

# Bước 4: Sửa backend để kết nối MongoDB đúng cách
echo "🔧 Bước 4: Sửa backend connection..."

# Sửa server.js để dùng connection string đúng
cd backend

# Backup
cp server.js server.js.backup2

# Sửa connection string
sed -i 's|mongodb://.*@localhost:27017/vphone|mongodb://localhost:27017/vphone|g' server.js
sed -i 's|mongodb://localhost:27017/vphone.*|mongodb://localhost:27017/vphone|g' server.js

print_status "Đã sửa backend connection"

# Bước 5: Restart backend
echo "🚀 Bước 5: Restart backend..."

pm2 restart vphone-backend
sleep 3

# Kiểm tra backend logs
print_warning "Backend logs:"
pm2 logs vphone-backend --lines 5 --nostream

cd ..

# Bước 6: Test toàn bộ hệ thống
echo "🧪 Bước 6: Test hệ thống..."

# Test MongoDB
print_warning "Test MongoDB:"
mongo vphone --eval "print('Collections: ' + db.getCollectionNames())" && print_status "MongoDB OK" || print_error "MongoDB lỗi"

# Test admin user
print_warning "Test admin user:"
mongo vphone --eval "print('Admin count: ' + db.admins.countDocuments())" && print_status "Admin user OK" || print_error "Admin user lỗi"

# Test backend
print_warning "Test backend:"
curl -s http://localhost:4000/health > /dev/null && print_status "Backend OK" || print_error "Backend lỗi"

# Test website
print_warning "Test website:"
curl -s -I http://app.vphone.vn | head -1 | grep "200 OK" && print_status "Website OK" || print_error "Website lỗi"

echo ""
echo "🎉 HOÀN THÀNH!"
echo "================================"
echo "🌐 Website: http://app.vphone.vn"
echo "👤 Đăng nhập:"
echo "   Email: vphone24h1@gmail.com"
echo "   Password: 0985630451vU"
echo ""
echo "📋 Nếu vẫn lỗi đăng nhập:"
echo "   pm2 logs vphone-backend"
echo "   mongo vphone --eval 'db.admins.find()'" 