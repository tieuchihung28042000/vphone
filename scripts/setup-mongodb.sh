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

# Kiểm tra MongoDB có đang chạy trên port 27017 không
if netstat -tlnp | grep -q :27017; then
    echo "⚠️  Port 27017 đã được sử dụng, kiểm tra process..."
    MONGO_PID=$(sudo lsof -t -i:27017 2>/dev/null || echo "")
    if [ -n "$MONGO_PID" ]; then
        echo "🔍 Tìm thấy MongoDB process: $MONGO_PID"
        echo "🛑 Dừng MongoDB process cũ..."
        sudo kill -TERM $MONGO_PID 2>/dev/null || true
        sleep 3
        # Force kill nếu cần
        if sudo kill -0 $MONGO_PID 2>/dev/null; then
            echo "🔨 Force kill MongoDB process..."
            sudo kill -KILL $MONGO_PID 2>/dev/null || true
            sleep 2
        fi
    fi
fi

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
    sudo mkdir -p /var/run/mongodb
    sudo chown -R mongodb:mongodb /var/lib/mongodb
    sudo chown -R mongodb:mongodb /var/log/mongodb
    sudo chown -R mongodb:mongodb /var/run/mongodb
    
    # Xóa PID file cũ
    sudo rm -f /var/run/mongodb/mongod.pid
    
    # Xóa file cấu hình cũ và tạo mới (fix lỗi storage.journal.enabled)
    echo "🔧 Tạo lại file cấu hình MongoDB..."
    sudo rm -f /etc/mongod.conf
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

    # Xóa environment variables gây xung đột
    echo "🧹 Xóa environment variables gây xung đột..."
    sudo systemctl edit --full mongod --force || true
         sudo tee /etc/systemd/system/mongod.service > /dev/null << 'EOF'
[Unit]
Description=MongoDB Database Server
Documentation=https://docs.mongodb.org/manual
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=mongodb
Group=mongodb
ExecStart=/usr/bin/mongod --config /etc/mongod.conf
TimeoutStartSec=300
KillMode=mixed
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

    # Reload systemd
    sudo systemctl daemon-reload
    
    # Dừng MongoDB trước khi khởi động lại
    echo "🛑 Dừng MongoDB service cũ..."
    sudo systemctl stop mongod 2>/dev/null || true
    
    # Khởi động MongoDB
    echo "▶️  Khởi động MongoDB..."
    if ! sudo systemctl start mongod; then
        echo "❌ Lỗi khởi động MongoDB, kiểm tra chi tiết..."
        echo "📋 Status MongoDB:"
        sudo systemctl status mongod --no-pager || true
        echo "📋 Logs MongoDB:"
        sudo journalctl -u mongod --no-pager --lines=10 || true
        
        # Thử khởi động manual để debug
        echo "🔍 Thử khởi động manual để debug..."
        sudo -u mongodb mongod --config /etc/mongod.conf --fork || {
            echo "❌ Lỗi khởi động manual, thử cấu hình đơn giản hơn..."
            # Tạo cấu hình tối giản
            sudo tee /etc/mongod.conf > /dev/null << 'EOF'
systemLog:
  destination: file
  path: /var/log/mongodb/mongod.log
storage:
  dbPath: /var/lib/mongodb
net:
  port: 27017
  bindIp: 127.0.0.1
EOF
            echo "📝 Đã tạo cấu hình tối giản, thử lại..."
            sudo systemctl start mongod
        }
    fi
    sudo systemctl enable mongod
    sleep 5
    
    # Kiểm tra trạng thái với retry
    RETRY_COUNT=0
    MAX_RETRIES=3
    
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        if sudo systemctl is-active --quiet mongod; then
            echo "✅ MongoDB service đã khởi động thành công!"
            break
        else
            RETRY_COUNT=$((RETRY_COUNT + 1))
            echo "⚠️  Lần thử $RETRY_COUNT/$MAX_RETRIES: MongoDB chưa khởi động"
            
            if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
                echo "🔄 Thử khởi động lại..."
                sudo systemctl stop mongod 2>/dev/null || true
                sleep 2
                sudo systemctl start mongod
                sleep 5
            fi
        fi
    done
    
         # Kiểm tra cuối cùng
     if ! sudo systemctl is-active --quiet mongod; then
         echo "❌ MongoDB service vẫn không khởi động được sau $MAX_RETRIES lần thử"
         echo "📋 Logs cuối cùng:"
         sudo journalctl -u mongod --no-pager --lines=15
         
         # Thử khởi động MongoDB manual như fallback
         echo "🔄 Thử khởi động MongoDB manual như fallback..."
         if sudo -u mongodb mongod --dbpath /var/lib/mongodb --logpath /var/log/mongodb/mongod.log --port 27017 --bind_ip 127.0.0.1 --fork; then
             echo "✅ MongoDB đã khởi động thành công bằng manual mode"
             # Tạo script khởi động tự động
             sudo tee /etc/systemd/system/mongod-manual.service > /dev/null << 'EOF'
[Unit]
Description=MongoDB Database Server (Manual)
After=network.target

[Service]
Type=forking
User=mongodb
Group=mongodb
ExecStart=/usr/bin/mongod --dbpath /var/lib/mongodb --logpath /var/log/mongodb/mongod.log --port 27017 --bind_ip 127.0.0.1 --fork
ExecStop=/usr/bin/mongod --dbpath /var/lib/mongodb --shutdown
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF
             sudo systemctl daemon-reload
             sudo systemctl enable mongod-manual
             echo "📝 Đã tạo service mongod-manual cho tương lai"
         else
             echo "❌ Không thể khởi động MongoDB bằng bất kỳ cách nào"
             exit 1
         fi
     fi
else
    echo "❌ Hệ điều hành không được hỗ trợ"
    exit 1
fi
fi  # Kết thúc block SKIP_INSTALL

# Kiểm tra MongoDB có thể kết nối được không
echo "🔍 Kiểm tra kết nối MongoDB..."
if mongosh --eval "db.adminCommand('ping')" --quiet 2>/dev/null; then
    echo "✅ MongoDB đã chạy và có thể kết nối!"
    MONGODB_RUNNING=true
else
    echo "⚠️  MongoDB chưa chạy hoặc không thể kết nối"
    MONGODB_RUNNING=false
fi

# Kiểm tra MongoDB có authentication chưa (chỉ khi MongoDB đang chạy)
if [ "$MONGODB_RUNNING" = "true" ]; then
    echo "🔍 Kiểm tra trạng thái authentication..."
    AUTH_STATUS=$(mongosh --eval "db.adminCommand('connectionStatus')" --quiet 2>/dev/null | grep -c "authenticated" || echo "0")
else
    AUTH_STATUS=0
fi

if [ "$MONGODB_RUNNING" = "true" ]; then
    # MongoDB đang chạy, kiểm tra authentication
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
    else
        echo "✅ MongoDB đã có authentication"
    fi
else
    echo "⚠️  MongoDB chưa chạy, bỏ qua tạo admin user"
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

# Kiểm tra kết nối cuối cùng
echo "🔍 Kiểm tra kết nối cuối cùng..."
# Thử kết nối với admin user trước
if mongosh -u admin -p 12345 --authenticationDatabase admin --eval "db.adminCommand('ping')" --quiet 2>/dev/null; then
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
elif mongosh --eval "db.adminCommand('ping')" --quiet 2>/dev/null; then
    echo "✅ MongoDB đang chạy nhưng chưa có authentication!"
    echo "📊 Thông tin kết nối:"
    echo "   - Host: localhost:27017"
    echo "   - Database: $DATABASE_NAME"
    echo "   - Connection String: mongodb://localhost:27017/$DATABASE_NAME"
    echo "⚠️  Lưu ý: MongoDB chưa có authentication, cần bảo mật!"
else
    echo "❌ Không thể kết nối MongoDB"
    echo "🔧 Thử chạy lại script để sửa lỗi:"
    echo "./scripts/setup-mongodb.sh $DATABASE_NAME"
    exit 1
fi 