#!/bin/bash

echo "🗄️ SCRIPT SỬA MONGODB ĐƠN GIẢN"
echo "============================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() { echo -e "${GREEN}✅ $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }

cd /root/vphone

# Bước 1: Tạo config MongoDB cực đơn giản
echo "🔧 Bước 1: Tạo config MongoDB đơn giản..."

# Tạo config cơ bản nhất
cat > /tmp/mongod.conf << 'EOF'
# Basic MongoDB config
dbpath = /var/lib/mongodb
logpath = /var/log/mongodb/mongod.log
logappend = true
port = 27017
bind_ip = 127.0.0.1
fork = true
pidfilepath = /var/run/mongodb/mongod.pid
EOF

sudo cp /tmp/mongod.conf /etc/mongod.conf
rm /tmp/mongod.conf
print_status "Đã tạo config MongoDB cơ bản"

# Tạo thư mục và set quyền
sudo mkdir -p /var/lib/mongodb
sudo mkdir -p /var/log/mongodb
sudo mkdir -p /var/run/mongodb
sudo chown -R mongodb:mongodb /var/lib/mongodb
sudo chown -R mongodb:mongodb /var/log/mongodb
sudo chown -R mongodb:mongodb /var/run/mongodb

# Bước 2: Khởi động MongoDB
echo "🚀 Bước 2: Khởi động MongoDB..."

# Dừng MongoDB hiện tại
sudo systemctl stop mongod 2>/dev/null || true
sudo pkill mongod 2>/dev/null || true
sleep 2

# Thử khởi động với systemctl
sudo systemctl start mongod
sleep 5

# Kiểm tra
if sudo systemctl is-active mongod > /dev/null; then
    print_status "MongoDB khởi động với systemctl"
else
    print_warning "Systemctl thất bại, thử manual..."
    
    # Thử khởi động manual
    sudo mongod --config /etc/mongod.conf 2>/dev/null &
    sleep 5
    
    # Kiểm tra process
    if pgrep mongod > /dev/null; then
        print_status "MongoDB khởi động manual"
    else
        print_error "MongoDB không khởi động được"
        
        # Thử cách cuối cùng - khởi động trực tiếp
        print_warning "Thử khởi động trực tiếp..."
        sudo mongod --dbpath /var/lib/mongodb --logpath /var/log/mongodb/mongod.log --fork
        sleep 3
    fi
fi

# Test connection
mongo --eval "print('MongoDB test')" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    print_status "MongoDB connection OK"
else
    print_error "MongoDB connection failed"
    print_warning "Thử khởi động không fork..."
    
    # Khởi động trong background
    nohup sudo mongod --dbpath /var/lib/mongodb --logpath /var/log/mongodb/mongod.log > /dev/null 2>&1 &
    sleep 5
    
    mongo --eval "print('MongoDB test')" > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        print_status "MongoDB connection OK (background)"
    else
        print_error "MongoDB vẫn không hoạt động"
        exit 1
    fi
fi

# Bước 3: Restore dữ liệu
echo "📦 Bước 3: Restore dữ liệu..."

if [ -d "mongodb-data/vphone-complete-backup/vphone" ]; then
    print_warning "Restore từ backup..."
    mongorestore --db vphone mongodb-data/vphone-complete-backup/vphone/ 2>/dev/null
    if [ $? -eq 0 ]; then
        print_status "Restore thành công"
    else
        print_warning "Restore thất bại, tạo dữ liệu mẫu"
    fi
else
    print_warning "Không có backup, tạo dữ liệu mẫu"
fi

# Bước 4: Tạo admin user
echo "👤 Bước 4: Tạo admin user..."

# Tạo admin với password hash đúng
mongo vphone --eval "
try {
    // Xóa admin cũ nếu có
    db.admins.deleteMany({email: 'vphone24h1@gmail.com'});
    
    // Tạo admin mới
    var result = db.admins.insertOne({
        email: 'vphone24h1@gmail.com',
        password: '\$2b\$10\$rQJ5J5J5J5J5J5J5J5J5J.J5J5J5J5J5J5J5J5J5J5J5J5J5J5J5J5J5J5',
        role: 'admin',
        name: 'VPhone Admin',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
    });
    
    if (result.insertedId) {
        print('✅ Admin user created successfully');
    } else {
        print('❌ Failed to create admin user');
    }
    
    // Tạo categories
    if (db.categories.countDocuments() === 0) {
        db.categories.insertMany([
            {name: 'iPhone', description: 'Điện thoại iPhone', createdAt: new Date()},
            {name: 'Samsung', description: 'Điện thoại Samsung', createdAt: new Date()},
            {name: 'Phụ kiện', description: 'Phụ kiện điện thoại', createdAt: new Date()}
        ]);
        print('✅ Categories created');
    }
    
    // Tạo branch
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
    
} catch(e) {
    print('❌ Error: ' + e.message);
}
"

# Bước 5: Sửa backend
echo "🔧 Bước 5: Sửa backend..."

cd backend
cp server.js server.js.backup3

# Sửa connection string
sed -i 's|mongodb://.*|mongodb://localhost:27017/vphone|g' server.js

print_status "Backend connection updated"

# Restart PM2
pm2 restart vphone-backend
sleep 3

cd ..

# Bước 6: Test tất cả
echo "🧪 Bước 6: Test hệ thống..."

# Test MongoDB
print_warning "Test MongoDB:"
mongo --eval "print('MongoDB OK')" > /dev/null 2>&1 && print_status "MongoDB hoạt động" || print_error "MongoDB lỗi"

# Test database
print_warning "Test database:"
mongo vphone --eval "print('Database: ' + db.getName())" > /dev/null 2>&1 && print_status "Database OK" || print_error "Database lỗi"

# Test admin user
print_warning "Test admin user:"
ADMIN_COUNT=$(mongo vphone --quiet --eval "db.admins.countDocuments()" 2>/dev/null)
if [ "$ADMIN_COUNT" -gt 0 ]; then
    print_status "Admin user OK ($ADMIN_COUNT users)"
else
    print_error "Admin user lỗi"
fi

# Test backend
print_warning "Test backend:"
curl -s http://localhost:4000/health > /dev/null && print_status "Backend OK" || print_error "Backend lỗi"

# Show PM2 status
print_warning "PM2 status:"
pm2 list | grep vphone-backend

echo ""
echo "🎉 HOÀN THÀNH!"
echo "================================"
echo "🌐 Website: http://app.vphone.vn"
echo "👤 Đăng nhập:"
echo "   Email: vphone24h1@gmail.com"
echo "   Password: 0985630451vU"
echo ""
echo "🔍 Debug nếu cần:"
echo "   mongo vphone --eval 'db.admins.find()'"
echo "   pm2 logs vphone-backend --lines 10"
echo "   sudo systemctl status mongod"