#!/bin/bash

echo "🔄 Restore dữ liệu VPhone trên VPS..."

# Chờ MongoDB khởi động hoàn toàn
echo "⏳ Chờ MongoDB khởi động..."
sleep 30

# Kiểm tra MongoDB đã sẵn sàng chưa
until docker exec vphone-mongodb mongosh -u vphone_admin -p vphone_secure_2024 --authenticationDatabase admin --eval "db.adminCommand('ping')" >/dev/null 2>&1; do
    echo "⏳ Đang chờ MongoDB..."
    sleep 5
done

echo "✅ MongoDB đã sẵn sàng!"

# Restore dữ liệu
echo "📦 Restore dữ liệu từ backup..."
docker exec vphone-mongodb mongorestore \
    --host localhost:27017 \
    -u vphone_admin \
    -p vphone_secure_2024 \
    --authenticationDatabase admin \
    --db vphone \
    --drop \
    /docker-entrypoint-initdb.d/backup/vphone/

if [ $? -eq 0 ]; then
    echo "✅ Restore dữ liệu thành công!"
    
    # Kiểm tra dữ liệu
    echo "🔍 Kiểm tra dữ liệu..."
    docker exec vphone-mongodb mongosh -u vphone_admin -p vphone_secure_2024 --authenticationDatabase admin --eval "
    db = db.getSiblingDB('vphone');
    console.log('📊 Thống kê dữ liệu:');
    console.log('- Admins:', db.admins.countDocuments());
    console.log('- Users:', db.users.countDocuments());
    console.log('- Products:', db.inventories.countDocuments());
    console.log('- Categories:', db.categories.countDocuments());
    console.log('- Branches:', db.branches.countDocuments());
    "
else
    echo "❌ Restore dữ liệu thất bại!"
    exit 1
fi

echo "🎉 Hoàn tất restore dữ liệu VPhone!" 