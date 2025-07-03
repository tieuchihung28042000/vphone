#!/bin/bash

# Script debug MongoDB đơn giản
# Sử dụng: ./scripts/debug-mongodb-simple.sh

echo "🔍 Debug MongoDB..."

echo "📋 1. Kiểm tra MongoDB có được cài đặt không:"
which mongod || echo "❌ mongod không tìm thấy"
which mongosh || echo "❌ mongosh không tìm thấy"

echo -e "\n📋 2. Kiểm tra user mongodb:"
id mongodb 2>/dev/null || echo "❌ User mongodb không tồn tại"

echo -e "\n📋 3. Kiểm tra thư mục MongoDB:"
ls -la /var/lib/mongodb 2>/dev/null || echo "❌ /var/lib/mongodb không tồn tại"
ls -la /var/log/mongodb 2>/dev/null || echo "❌ /var/log/mongodb không tồn tại"
ls -la /var/run/mongodb 2>/dev/null || echo "❌ /var/run/mongodb không tồn tại"

echo -e "\n📋 4. Kiểm tra quyền thư mục:"
ls -ld /var/lib/mongodb /var/log/mongodb /var/run/mongodb 2>/dev/null

echo -e "\n📋 5. Kiểm tra file cấu hình:"
if [ -f /etc/mongod.conf ]; then
    echo "✅ File cấu hình tồn tại:"
    cat /etc/mongod.conf
else
    echo "❌ File cấu hình không tồn tại"
fi

echo -e "\n📋 6. Kiểm tra systemd service:"
sudo systemctl status mongod --no-pager 2>/dev/null || echo "❌ Service mongod không tồn tại"

echo -e "\n📋 7. Kiểm tra logs MongoDB:"
sudo journalctl -u mongod --no-pager --lines=5 2>/dev/null || echo "❌ Không có logs"

echo -e "\n📋 8. Thử khởi động MongoDB manual:"
echo "Lệnh để test manual:"
echo "sudo -u mongodb mongod --dbpath /var/lib/mongodb --logpath /var/log/mongodb/test.log --port 27017 --bind_ip 127.0.0.1"

echo -e "\n📋 9. Kiểm tra port 27017:"
netstat -tlnp | grep :27017 || echo "❌ Port 27017 không được sử dụng"

echo -e "\n🎯 Để sửa lỗi, chạy:"
echo "./scripts/setup-mongodb.sh" 