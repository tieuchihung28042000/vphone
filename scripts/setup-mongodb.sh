#!/bin/bash

# Script setup MongoDB native
# Sử dụng: ./scripts/setup-mongodb.sh [database_name]
# Ví dụ: ./scripts/setup-mongodb.sh vphone_production

set -e

# Lấy tên database từ tham số hoặc dùng mặc định
DATABASE_NAME=${1:-vphone_production}

echo "🚀 Setup MongoDB native với database: $DATABASE_NAME"

# Kiểm tra hệ điều hành và cài đặt MongoDB
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    echo "📱 Cài đặt MongoDB trên macOS..."
    if ! command -v mongod &> /dev/null; then
        if ! command -v brew &> /dev/null; then
            echo "❌ Cần Homebrew để cài đặt MongoDB"
            echo "Chạy: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
            exit 1
        fi
        brew tap mongodb/brew
        brew install mongodb-community
    fi
    
    # Tạo thư mục và khởi động
    mkdir -p /usr/local/var/mongodb
    mkdir -p /usr/local/var/log/mongodb
    
    # Khởi động MongoDB
    if ! pgrep -f mongod > /dev/null; then
        mongod --dbpath /usr/local/var/mongodb --logpath /usr/local/var/log/mongodb/mongo.log --fork
        sleep 3
    fi
    
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    echo "🐧 Cài đặt MongoDB trên Linux..."
    if ! command -v mongod &> /dev/null; then
        # Sửa lỗi repository trước khi cài đặt
        echo "🔧 Sửa lỗi repository..."
        sudo rm -f /etc/apt/sources.list.d/cloudflare.list 2>/dev/null || true
        
        curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
        echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
        sudo apt-get update
        sudo apt-get install -y mongodb-org
    fi
    
    # Khởi động MongoDB
    sudo systemctl start mongod
    sudo systemctl enable mongod
    sleep 3
else
    echo "❌ Hệ điều hành không được hỗ trợ"
    exit 1
fi

# Tạo admin user
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
  print('✅ Admin user được tạo thành công')
} catch(e) {
  print('⚠️  Admin user có thể đã tồn tại')
}
" --quiet

# Tạo database và user
echo "🗄️  Tạo database $DATABASE_NAME..."
mongosh -u admin -p 12345 --authenticationDatabase admin --eval "
use $DATABASE_NAME
try {
  db.createCollection('_init')
  print('✅ Database $DATABASE_NAME được tạo thành công')
} catch(e) {
  print('⚠️  Database có thể đã tồn tại')
}
" --quiet

# Kiểm tra kết nối
echo "🔍 Kiểm tra kết nối..."
if mongosh -u admin -p 12345 --authenticationDatabase admin --eval "db.adminCommand('ping')" --quiet; then
    echo "✅ MongoDB đã sẵn sàng!"
    
    # Kiểm tra chi tiết database
    echo "📊 Kiểm tra database $DATABASE_NAME..."
    mongosh -u admin -p 12345 --authenticationDatabase admin --eval "
    use $DATABASE_NAME
    print('📋 Collections trong database:')
    db.getCollectionNames().forEach(function(collection) {
        var count = db.getCollection(collection).countDocuments()
        print('  - ' + collection + ': ' + count + ' documents')
    })
    
    print('\\n📈 Thống kê database:')
    var stats = db.stats()
    print('  - Tổng collections: ' + stats.collections)
    print('  - Tổng documents: ' + stats.objects)
    print('  - Kích thước data: ' + (stats.dataSize / 1024 / 1024).toFixed(2) + ' MB')
    print('  - Kích thước storage: ' + (stats.storageSize / 1024 / 1024).toFixed(2) + ' MB')
    " --quiet
    
    echo ""
    echo "📊 Thông tin kết nối:"
    echo "   - Host: localhost:27017"
    echo "   - Admin User: admin"
    echo "   - Admin Password: 12345"
    echo "   - Database: $DATABASE_NAME"
    echo "   - Connection String: mongodb://admin:12345@localhost:27017/$DATABASE_NAME?authSource=admin"
else
    echo "❌ Không thể kết nối MongoDB"
    exit 1
fi 