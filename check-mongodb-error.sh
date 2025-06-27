#!/bin/bash

echo "🔍 KIỂM TRA CHI TIẾT LỖI MONGODB"
echo "==============================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() { echo -e "${GREEN}✅ $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }

cd /root/vphone

echo "1️⃣ Kiểm tra MongoDB có được cài đặt không..."
if command -v mongod &> /dev/null; then
    print_status "MongoDB đã được cài đặt"
    mongod --version
else
    print_error "MongoDB chưa được cài đặt"
    echo "Cài đặt MongoDB..."
    
    # Cài MongoDB
    wget -qO - https://www.mongodb.org/static/pgp/server-4.4.asc | sudo apt-key add -
    echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/4.4 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-4.4.list
    sudo apt-get update
    sudo apt-get install -y mongodb-org
fi
echo ""

echo "2️⃣ Kiểm tra thư mục MongoDB..."
print_warning "Kiểm tra /var/lib/mongodb:"
ls -la /var/lib/mongodb/ 2>/dev/null || print_error "Thư mục không tồn tại"

print_warning "Kiểm tra quyền:"
sudo ls -la /var/lib/ | grep mongodb

print_warning "Kiểm tra owner:"
sudo stat /var/lib/mongodb 2>/dev/null || print_error "Không thể stat"
echo ""

echo "3️⃣ Tạo lại thư mục và quyền..."
sudo mkdir -p /var/lib/mongodb
sudo mkdir -p /var/log/mongodb
sudo mkdir -p /var/run/mongodb

# Tạo user mongodb nếu chưa có
if ! id mongodb &>/dev/null; then
    print_warning "Tạo user mongodb..."
    sudo useradd -r -s /bin/false mongodb
fi

sudo chown -R mongodb:mongodb /var/lib/mongodb
sudo chown -R mongodb:mongodb /var/log/mongodb
sudo chown -R mongodb:mongodb /var/run/mongodb
sudo chmod 755 /var/lib/mongodb
sudo chmod 755 /var/log/mongodb
sudo chmod 755 /var/run/mongodb

print_status "Thư mục và quyền đã được tạo"
echo ""

echo "4️⃣ Kiểm tra MongoDB config..."
print_warning "Config file hiện tại:"
sudo cat /etc/mongod.conf 2>/dev/null || print_error "Không có config file"
echo ""

echo "5️⃣ Tạo config MongoDB đơn giản..."
cat > /tmp/simple-mongod.conf << 'EOF'
# Simple MongoDB config
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

sudo cp /tmp/simple-mongod.conf /etc/mongod.conf
rm /tmp/simple-mongod.conf
print_status "Config đã được tạo"
echo ""

echo "6️⃣ Thử khởi động MongoDB với systemctl..."
sudo systemctl stop mongod 2>/dev/null || true
sudo pkill mongod 2>/dev/null || true
sleep 3

sudo systemctl start mongod
sleep 5

if sudo systemctl is-active mongod > /dev/null; then
    print_status "MongoDB khởi động thành công với systemctl"
else
    print_error "Systemctl thất bại, kiểm tra logs..."
    sudo journalctl -u mongod --no-pager -l | tail -20
    
    echo ""
    print_warning "Thử khởi động manual..."
    
    # Thử khởi động manual
    sudo mongod --config /etc/mongod.conf &
    sleep 5
    
    if pgrep mongod > /dev/null; then
        print_status "MongoDB khởi động manual thành công"
    else
        print_error "Manual cũng thất bại"
        
        # Thử khởi động với tham số trực tiếp
        print_warning "Thử khởi động trực tiếp..."
        sudo mongod --dbpath /var/lib/mongodb --logpath /var/log/mongodb/mongod.log --fork --bind_ip 127.0.0.1 --port 27017
        sleep 3
        
        if pgrep mongod > /dev/null; then
            print_status "Khởi động trực tiếp thành công"
        else
            print_error "Tất cả cách đều thất bại"
            
            # Kiểm tra logs
            print_warning "MongoDB error logs:"
            sudo tail -20 /var/log/mongodb/mongod.log 2>/dev/null || echo "Không có logs"
        fi
    fi
fi
echo ""

echo "7️⃣ Test kết nối MongoDB..."
if mongo --eval "print('MongoDB connection test')" > /dev/null 2>&1; then
    print_status "MongoDB kết nối thành công!"
    
    # Test database
    mongo vphone --eval "
    print('Database: ' + db.getName());
    print('Collections: ' + db.getCollectionNames());
    print('Admin count: ' + db.admins.countDocuments());
    "
else
    print_error "MongoDB vẫn không kết nối được"
    
    # Kiểm tra process
    print_warning "MongoDB processes:"
    ps aux | grep mongod | grep -v grep
    
    print_warning "Port 27017:"
    sudo netstat -tulpn | grep :27017
    
    print_warning "System logs:"
    sudo journalctl -u mongod -n 10 --no-pager
fi
echo ""

echo "8️⃣ Nếu MongoDB hoạt động, tạo admin user..."
if mongo --eval "print('test')" > /dev/null 2>&1; then
    print_warning "Tạo admin user..."
    
    mongo vphone --eval "
    // Xóa admin cũ
    db.admins.deleteMany({});
    
    // Tạo admin mới (password: 0985630451vU)
    var result = db.admins.insertOne({
        email: 'vphone24h1@gmail.com',
        password: '\$2a\$10\$N9qo8uLOickgx2ZMRZoMye.IjdBbXAUXcJWz.wMTjKPqVOVfvg4zy',
        role: 'admin',
        name: 'VPhone Admin',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
    });
    
    print('✅ Admin created: ' + result.insertedId);
    "
    
    print_status "Admin user đã được tạo"
else
    print_error "MongoDB không hoạt động, không thể tạo admin"
fi

echo ""
echo "🎯 TỔNG KẾT:"
echo "============"

# Final tests
if mongo --eval "print('test')" > /dev/null 2>&1; then
    print_status "✅ MongoDB hoạt động"
    
    # Test admin
    ADMIN_COUNT=$(mongo vphone --quiet --eval "db.admins.countDocuments()" 2>/dev/null)
    if [ "$ADMIN_COUNT" -gt 0 ] 2>/dev/null; then
        print_status "✅ Admin user OK ($ADMIN_COUNT users)"
        
        # Restart backend
        print_warning "Restart backend..."
        cd backend
        sed -i 's|mongodb://.*|mongodb://localhost:27017/vphone|g' server.js
        pm2 restart vphone-backend
        sleep 3
        cd ..
        
        # Test login
        print_warning "Test login API..."
        sleep 2
        curl -X POST http://localhost:4000/api/auth/login \
          -H "Content-Type: application/json" \
          -d '{"email":"vphone24h1@gmail.com","password":"0985630451vU"}' \
          -w "\nHTTP Status: %{http_code}\n"
        
    else
        print_error "❌ Không có admin user"
    fi
else
    print_error "❌ MongoDB vẫn không hoạt động"
fi

echo ""
echo "💡 Nếu vẫn lỗi, gửi cho tôi:"
echo "1. Output của script này"
echo "2. sudo tail -50 /var/log/mongodb/mongod.log"
echo "3. sudo journalctl -u mongod -n 20" 