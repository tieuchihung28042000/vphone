#!/bin/bash

echo "🐳 Migration dữ liệu vào Docker MongoDB"
echo "====================================="

# Kiểm tra Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker không được cài đặt"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose không được cài đặt"
    exit 1
fi

# Export dữ liệu từ local MongoDB
echo "📤 Export dữ liệu từ local MongoDB..."
mkdir -p docker_migration
mongodump --uri="mongodb://localhost:27017/test" --out=docker_migration/

# Khởi động MongoDB container
echo "🐳 Khởi động MongoDB Docker container..."
docker-compose up -d mongodb

# Đợi MongoDB khởi động
echo "⏳ Đợi MongoDB khởi động..."
sleep 10

# Import dữ liệu vào Docker MongoDB
echo "📥 Import dữ liệu vào Docker MongoDB..."
docker exec -i vphone-mongodb mongorestore --uri="mongodb://vphone_admin:vphone_secure_password_2024@localhost:27017/test?authSource=admin" --drop /docker_migration/test

# Kiểm tra dữ liệu
echo "🔍 Kiểm tra dữ liệu đã import..."
docker exec vphone-mongodb mongosh "mongodb://vphone_admin:vphone_secure_password_2024@localhost:27017/test?authSource=admin" --eval "
console.log('✅ Kết nối thành công Docker MongoDB!');
console.log('📊 Inventories:', db.inventories.countDocuments());
console.log('👤 Users:', db.users.countDocuments());
console.log('🏪 Branches:', db.branches.countDocuments());
console.log('📦 Categories:', db.categories.countDocuments());
console.log('👑 Admins:', db.admins.countDocuments());
"

# Dọn dẹp
echo "🧹 Dọn dẹp files tạm..."
rm -rf docker_migration/

echo ""
echo "✅ Migration hoàn thành!"
echo "🚀 Sẵn sàng khởi động full stack với: docker-compose up -d" 