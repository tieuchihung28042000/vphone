#!/bin/bash

# Script reset MongoDB khi bị lỗi
# Sử dụng: ./scripts/reset-mongodb.sh

set -e

echo "🔄 Reset MongoDB..."

# Dừng MongoDB service
echo "🛑 Dừng MongoDB service..."
sudo systemctl stop mongod 2>/dev/null || true

# Xóa PID file cũ
echo "🗑️  Xóa PID file cũ..."
sudo rm -f /var/run/mongodb/mongod.pid

# Tạo lại thư mục cần thiết
echo "📁 Tạo lại thư mục cần thiết..."
sudo mkdir -p /var/lib/mongodb
sudo mkdir -p /var/log/mongodb
sudo mkdir -p /var/run/mongodb
sudo chown -R mongodb:mongodb /var/lib/mongodb
sudo chown -R mongodb:mongodb /var/log/mongodb
sudo chown -R mongodb:mongodb /var/run/mongodb

# Tạo file cấu hình MongoDB đơn giản
echo "⚙️  Tạo file cấu hình MongoDB..."
sudo tee /etc/mongod.conf > /dev/null << 'EOF'
# MongoDB configuration file
storage:
  dbPath: /var/lib/mongodb

systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod.log

net:
  port: 27017
  bindIp: 127.0.0.1

processManagement:
  timeZoneInfo: /usr/share/zoneinfo
EOF

# Khởi động lại MongoDB
echo "▶️  Khởi động MongoDB..."
sudo systemctl start mongod
sudo systemctl enable mongod

# Chờ MongoDB khởi động
echo "⏳ Chờ MongoDB khởi động..."
sleep 5

# Kiểm tra trạng thái
if sudo systemctl is-active --quiet mongod; then
    echo "✅ MongoDB đã khởi động thành công!"
    
    # Test kết nối
    if mongosh --eval "db.adminCommand('ping')" --quiet 2>/dev/null; then
        echo "✅ Có thể kết nối MongoDB"
        echo "🎉 Reset MongoDB hoàn tất!"
    else
        echo "⚠️  MongoDB đang chạy nhưng chưa thể kết nối"
        echo "📝 Thử chạy: ./scripts/setup-mongodb.sh để cấu hình"
    fi
else
    echo "❌ MongoDB vẫn không thể khởi động"
    echo "📋 Logs MongoDB:"
    sudo journalctl -u mongod --no-pager --lines=20
fi 