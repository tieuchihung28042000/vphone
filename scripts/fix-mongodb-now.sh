#!/bin/bash

# Script fix MongoDB ngay lập tức
# Sử dụng: ./scripts/fix-mongodb-now.sh

set -e

echo "🔧 Fix MongoDB ngay lập tức..."

# Dừng MongoDB
sudo systemctl stop mongod 2>/dev/null || true

# Xóa file cấu hình cũ
sudo rm -f /etc/mongod.conf

# Tạo cấu hình MongoDB tối giản
echo "⚙️  Tạo cấu hình MongoDB tối giản..."
sudo tee /etc/mongod.conf > /dev/null << 'EOF'
# where to write logging data.
systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod.log

# Where and how to store data.
storage:
  dbPath: /var/lib/mongodb

# network interfaces
net:
  port: 27017
  bindIp: 127.0.0.1

# how the process runs
processManagement:
  timeZoneInfo: /usr/share/zoneinfo
EOF

# Tạo thư mục và phân quyền
sudo mkdir -p /var/lib/mongodb
sudo mkdir -p /var/log/mongodb
sudo chown mongodb:mongodb /var/lib/mongodb
sudo chown mongodb:mongodb /var/log/mongodb

# Khởi động MongoDB
echo "▶️  Khởi động MongoDB..."
sudo systemctl start mongod
sleep 3

# Kiểm tra
if sudo systemctl is-active --quiet mongod; then
    echo "✅ MongoDB đã chạy thành công!"
    
    # Test connection
    if mongosh --eval "print('MongoDB is working!')" --quiet 2>/dev/null; then
        echo "✅ Có thể kết nối MongoDB"
        
        # Tạo admin user ngay
        echo "👤 Tạo admin user..."
        mongosh --eval "
        use admin
        try {
          db.createUser({
            user: 'admin',
            pwd: '12345',
            roles: [
              { role: 'userAdminAnyDatabase', db: 'admin' },
              { role: 'readWriteAnyDatabase', db: 'admin' },
              { role: 'dbAdminAnyDatabase', db: 'admin' }
            ]
          })
          print('✅ Admin user created successfully')
        } catch(e) {
          print('⚠️  Admin user may already exist')
        }
        " --quiet
        
        # Tạo database vphone_production
        echo "🗄️  Tạo database vphone_production..."
        mongosh --eval "
        use vphone_production
        db.createCollection('test')
        print('✅ Database vphone_production created')
        " --quiet
        
        echo "🎉 MongoDB setup hoàn tất!"
        echo "📝 Connection string: mongodb://admin:12345@localhost:27017/vphone_production?authSource=admin"
        
    else
        echo "⚠️  MongoDB chạy nhưng không thể kết nối"
    fi
else
    echo "❌ MongoDB vẫn không chạy được"
    echo "📋 Logs:"
    sudo journalctl -u mongod --no-pager --lines=10
fi 