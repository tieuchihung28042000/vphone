#!/bin/bash

# Script setup MongoDB native
# Sử dụng: ./scripts/setup-mongodb.sh [database_name]
# Ví dụ: ./scripts/setup-mongodb.sh vphone_production

set -e

# Lấy tên database từ tham số hoặc dùng mặc định
DATABASE_NAME=${1:-vphone_production}

# Kiểm tra tên database hợp lệ (không chứa dấu chấm, khoảng trắng, ký tự đặc biệt)
if [[ "$DATABASE_NAME" =~ [^a-zA-Z0-9_] ]]; then
    echo "❌ Tên database không hợp lệ: $DATABASE_NAME"
    echo "📝 Tên database chỉ được chứa: a-z, A-Z, 0-9, _"
    echo "💡 Gợi ý: Sử dụng 'vphone_production' thay vì '$DATABASE_NAME'"
    DATABASE_NAME="vphone_production"
    echo "🔄 Sử dụng tên database mặc định: $DATABASE_NAME"
fi

echo "🚀 Setup MongoDB native với database: $DATABASE_NAME"

# Kiểm tra MongoDB đã được cài đặt chưa
if command -v mongod &> /dev/null; then
    echo "✅ MongoDB đã được cài đặt"
    
    # Kiểm tra service đang chạy chưa
    if sudo systemctl is-active --quiet mongod; then
        echo "✅ MongoDB service đang chạy"
        
        # Kiểm tra có thể kết nối không
        if mongosh --eval "db.adminCommand('ping')" --quiet 2>/dev/null; then
            echo "✅ MongoDB đã sẵn sàng, bỏ qua cài đặt"
            SKIP_INSTALL=true
        else
            echo "⚠️  MongoDB đang chạy nhưng không thể kết nối"
            SKIP_INSTALL=false
        fi
    else
        echo "⚠️  MongoDB đã cài đặt nhưng service không chạy"
        SKIP_INSTALL=false
    fi
else
    echo "📦 MongoDB chưa được cài đặt"
    SKIP_INSTALL=false
fi

# Kiểm tra hệ điều hành và cài đặt MongoDB
if [ "$SKIP_INSTALL" != "true" ]; then
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
    echo "🔧 Cấu hình MongoDB..."
    # Tạo thư mục cần thiết
    sudo mkdir -p /var/lib/mongodb
    sudo mkdir -p /var/log/mongodb
    sudo chown -R mongodb:mongodb /var/lib/mongodb
    sudo chown -R mongodb:mongodb /var/log/mongodb
    
    # Kiểm tra file cấu hình
    if [ ! -f /etc/mongod.conf ]; then
        echo "⚠️  File cấu hình MongoDB không tồn tại, tạo mới..."
        sudo tee /etc/mongod.conf > /dev/null << 'EOF'
# MongoDB configuration file
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
  fork: true
  pidFilePath: /var/run/mongodb/mongod.pid
  timeZoneInfo: /usr/share/zoneinfo
EOF
    fi
    
    # Khởi động MongoDB
    sudo systemctl start mongod
    sudo systemctl enable mongod
    sleep 5
    
    # Kiểm tra trạng thái
    if ! sudo systemctl is-active --quiet mongod; then
        echo "❌ MongoDB service failed, kiểm tra logs..."
        sudo journalctl -u mongod --no-pager --lines=10
        echo "🔄 Thử khởi động lại..."
        sudo systemctl restart mongod
        sleep 3
        
        if ! sudo systemctl is-active --quiet mongod; then
            echo "❌ Không thể khởi động MongoDB service"
            exit 1
        fi
    fi
else
    echo "❌ Hệ điều hành không được hỗ trợ"
    exit 1
fi
fi  # Kết thúc block SKIP_INSTALL

# Kiểm tra MongoDB có authentication chưa
echo "🔍 Kiểm tra trạng thái authentication..."
AUTH_STATUS=$(mongosh --eval "db.adminCommand('connectionStatus')" --quiet 2>/dev/null | grep -c "authenticated" || echo "0")

if [ "$AUTH_STATUS" -eq 0 ]; then
    # MongoDB chưa có authentication, tạo admin user
    echo "👤 Tạo admin user (MongoDB chưa có authentication)..."
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
      print('⚠️  Admin user có thể đã tồn tại: ' + e.message)
    }
    " --quiet
    
    # Restart MongoDB để bật authentication
    echo "🔄 Restart MongoDB để bật authentication..."
    sudo systemctl restart mongod
    sleep 3
else
    echo "✅ MongoDB đã có authentication"
fi

# Tạo database và user
echo "🗄️  Tạo database $DATABASE_NAME..."
# Thử kết nối với admin user
if mongosh -u admin -p 12345 --authenticationDatabase admin --eval "db.adminCommand('ping')" --quiet 2>/dev/null; then
    echo "✅ Kết nối với admin user thành công"
    mongosh -u admin -p 12345 --authenticationDatabase admin --eval "
    use $DATABASE_NAME
    try {
      db.createCollection('_init')
      print('✅ Database $DATABASE_NAME được tạo thành công')
    } catch(e) {
      print('⚠️  Database có thể đã tồn tại: ' + e.message)
    }
    " --quiet
else
    # Thử kết nối không có authentication
    echo "⚠️  Thử kết nối không có authentication..."
    mongosh --eval "
    use $DATABASE_NAME
    try {
      db.createCollection('_init')
      print('✅ Database $DATABASE_NAME được tạo thành công')
    } catch(e) {
      print('❌ Lỗi tạo database: ' + e.message)
    }
    " --quiet
fi

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