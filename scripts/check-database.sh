#!/bin/bash

# Script kiểm tra database MongoDB
# Sử dụng: ./scripts/check-database.sh [database_name]

set -e

# Lấy tên database từ tham số hoặc dùng mặc định
DATABASE_NAME=${1:-vphone_production}

echo "🔍 Kiểm tra database MongoDB: $DATABASE_NAME"

# Kiểm tra MongoDB có đang chạy không
if ! pgrep -f mongod > /dev/null; then
    echo "❌ MongoDB chưa được khởi động"
    echo "Chạy: ./scripts/setup-mongodb.sh để khởi động"
    exit 1
fi

# Kiểm tra kết nối
echo "🔗 Kiểm tra kết nối MongoDB..."
if ! mongosh -u admin -p 12345 --authenticationDatabase admin --eval "db.adminCommand('ping')" --quiet; then
    echo "❌ Không thể kết nối MongoDB với user admin"
    exit 1
fi

echo "✅ Kết nối MongoDB thành công!"

# Kiểm tra database tồn tại
echo "🗄️  Kiểm tra database $DATABASE_NAME..."
DB_EXISTS=$(mongosh -u admin -p 12345 --authenticationDatabase admin --eval "
db.adminCommand('listDatabases').databases.forEach(function(db) {
    if (db.name === '$DATABASE_NAME') {
        print('EXISTS')
    }
})
" --quiet | grep -c "EXISTS" || echo "0")

if [ "$DB_EXISTS" -eq 0 ]; then
    echo "⚠️  Database $DATABASE_NAME chưa tồn tại"
    echo "Chạy: ./scripts/setup-mongodb.sh $DATABASE_NAME để tạo database"
    exit 1
fi

echo "✅ Database $DATABASE_NAME đã tồn tại"

# Hiển thị thông tin chi tiết
echo "📊 Thông tin chi tiết database $DATABASE_NAME:"
mongosh -u admin -p 12345 --authenticationDatabase admin --eval "
use $DATABASE_NAME

print('📋 Collections:')
var collections = db.getCollectionNames()
if (collections.length === 0) {
    print('  ⚠️  Chưa có collections nào')
} else {
    collections.forEach(function(collection) {
        var count = db.getCollection(collection).countDocuments()
        print('  ✅ ' + collection + ': ' + count + ' documents')
        
        // Hiển thị 1 document mẫu nếu có
        if (count > 0) {
            var sample = db.getCollection(collection).findOne()
            print('     📄 Sample: ' + JSON.stringify(sample).substring(0, 100) + '...')
        }
    })
}

print('\\n📈 Thống kê database:')
var stats = db.stats()
print('  - Tổng collections: ' + stats.collections)
print('  - Tổng documents: ' + stats.objects)
print('  - Tổng indexes: ' + stats.indexes)
print('  - Kích thước data: ' + (stats.dataSize / 1024 / 1024).toFixed(2) + ' MB')
print('  - Kích thước storage: ' + (stats.storageSize / 1024 / 1024).toFixed(2) + ' MB')
print('  - Kích thước indexes: ' + (stats.indexSize / 1024 / 1024).toFixed(2) + ' MB')

print('\\n👥 Users trong database:')
try {
    db.getUsers().forEach(function(user) {
        print('  - User: ' + user.user + ' | Roles: ' + JSON.stringify(user.roles))
    })
} catch(e) {
    print('  ⚠️  Không thể lấy danh sách users')
}

print('\\n🔧 Trạng thái MongoDB:')
var serverStatus = db.serverStatus()
print('  - Version: ' + serverStatus.version)
print('  - Uptime: ' + Math.floor(serverStatus.uptime / 60) + ' phút')
print('  - Connections: ' + serverStatus.connections.current + '/' + serverStatus.connections.available)
" --quiet

echo ""
echo "🎯 Kết luận:"
echo "✅ MongoDB đang chạy bình thường"
echo "✅ Database $DATABASE_NAME đã sẵn sàng"
echo "✅ Có thể kết nối với user admin/12345"
echo ""
echo "📝 Connection String:"
echo "mongodb://admin:12345@localhost:27017/$DATABASE_NAME?authSource=admin" 