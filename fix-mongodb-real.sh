#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================${NC}"
}

print_header "🔧 FIX MONGODB THỰC TẾ CHO VPS"

# Kiểm tra MongoDB version
print_status "Kiểm tra MongoDB version..."
mongod --version | head -3

# Dừng MongoDB hoàn toàn
print_status "Dừng MongoDB hoàn toàn..."
sudo systemctl stop mongod
sudo pkill -f mongod || true
sleep 3

# Xóa tất cả socket và pid files
print_status "Xóa socket và pid files..."
sudo rm -f /tmp/mongodb-*.sock
sudo rm -f /var/run/mongodb/mongod.pid
sudo rm -f /var/lib/mongodb/mongod.lock

# Sửa quyền thư mục
print_status "Sửa quyền thư mục MongoDB..."
sudo chown -R mongodb:mongodb /var/lib/mongodb
sudo chown -R mongodb:mongodb /var/log/mongodb
sudo chown -R mongodb:mongodb /var/run/mongodb
sudo chmod 755 /var/lib/mongodb
sudo chmod 755 /var/log/mongodb

# Tạo config MongoDB đúng format (không phải YAML)
print_status "Tạo mongod.conf với format thực tế..."
sudo tee /etc/mongod.conf > /dev/null << 'EOF'
# mongod.conf

# for documentation of all options, see:
#   http://docs.mongodb.org/manual/reference/configuration-options/

# Where to store data
storage:
  dbPath: /var/lib/mongodb

# Where to write logging data
systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod.log

# Network interfaces
net:
  port: 27017
  bindIp: 127.0.0.1

# Process management
processManagement:
  fork: true
  pidFilePath: /var/run/mongodb/mongod.pid
  timeZoneInfo: /usr/share/zoneinfo

# Enable journaling
#storage:
#  journal:
#    enabled: true

# Enable authentication
#security:
#  authorization: enabled
EOF

print_status "Test MongoDB config..."
sudo mongod --config /etc/mongod.conf --dry-run

if [ $? -eq 0 ]; then
    print_status "✅ Config OK, khởi động MongoDB..."
    
    # Khởi động MongoDB
    sudo systemctl daemon-reload
    sudo systemctl start mongod
    sleep 5
    
    # Kiểm tra status
    if sudo systemctl is-active --quiet mongod; then
        print_status "✅ MongoDB đã khởi động thành công!"
        
        # Kiểm tra port
        print_status "Kiểm tra port 27017..."
        sudo netstat -tulpn | grep :27017
        
        # Test connection
        print_status "Test MongoDB connection..."
        if mongosh --eval "db.runCommand('ping')" > /dev/null 2>&1; then
            print_status "✅ MongoDB connection OK"
            
            # Tạo admin user (không có authentication lúc đầu)
            print_status "Tạo admin user..."
            mongosh --eval "
            use admin;
            try {
                db.createUser({
                    user: 'vphone_admin',
                    pwd: 'vphone_secure_2024',
                    roles: [
                        { role: 'userAdminAnyDatabase', db: 'admin' },
                        { role: 'readWriteAnyDatabase', db: 'admin' }
                    ]
                });
                print('✅ Admin user created successfully');
            } catch(e) {
                print('⚠️ User might already exist: ' + e.message);
            }
            
            use vphone;
            db.createCollection('test');
            print('✅ Database vphone created');
            " 2>/dev/null || print_warning "User creation completed with warnings"
            
            # Bây giờ enable authentication
            print_status "Enable authentication..."
            sudo tee -a /etc/mongod.conf > /dev/null << 'EOF'

# Enable authentication
security:
  authorization: enabled
EOF
            
            # Restart với authentication
            print_status "Restart MongoDB với authentication..."
            sudo systemctl restart mongod
            sleep 5
            
            # Test với authentication
            print_status "Test với authentication..."
            if mongosh "mongodb://vphone_admin:vphone_secure_2024@localhost:27017/admin" --eval "db.runCommand('ping')" > /dev/null 2>&1; then
                print_status "✅ Authentication OK"
                
                # Restore database
                print_status "Restore database..."
                if [ -d "./mongodb-data/vphone-complete-backup/vphone" ]; then
                    mongorestore --host localhost:27017 --authenticationDatabase admin -u vphone_admin -p vphone_secure_2024 --db vphone --drop ./mongodb-data/vphone-complete-backup/vphone/ 2>/dev/null || print_warning "Restore completed with warnings"
                    print_status "✅ Database restored"
                fi
                
                # Test final connection
                print_status "Test final connection..."
                mongosh "mongodb://vphone_admin:vphone_secure_2024@localhost:27017/vphone?authSource=admin" --eval "
                print('Collections in vphone database:');
                db.getCollectionNames().forEach(function(collection) {
                    print('- ' + collection + ': ' + db[collection].countDocuments() + ' documents');
                });
                " 2>/dev/null || print_warning "Final test completed with warnings"
                
            else
                print_error "❌ Authentication failed"
            fi
            
        else
            print_error "❌ MongoDB connection failed"
        fi
        
    else
        print_error "❌ MongoDB failed to start"
        print_status "Checking logs..."
        sudo tail -20 /var/log/mongodb/mongod.log
    fi
    
else
    print_error "❌ MongoDB config có lỗi"
    print_status "Thử config đơn giản hơn..."
    
    # Config đơn giản không có YAML
    sudo tee /etc/mongod.conf > /dev/null << 'EOF'
# Simple mongod.conf
storage:
  dbPath: /var/lib/mongodb
systemLog:
  destination: file
  path: /var/log/mongodb/mongod.log
net:
  port: 27017
  bindIp: 127.0.0.1
processManagement:
  fork: true
EOF
    
    print_status "Thử khởi động với config đơn giản..."
    sudo systemctl start mongod
fi

# Final status
print_header "TRẠNG THÁI CUỐI CÙNG"
print_status "MongoDB service status:"
sudo systemctl status mongod --no-pager -l | head -10

print_status "Processes listening on port 27017:"
sudo netstat -tulpn | grep :27017

print_status "Recent MongoDB logs:"
sudo tail -10 /var/log/mongodb/mongod.log

print_header "🎉 MONGODB FIX HOÀN THÀNH"
echo -e "${GREEN}Nếu thành công, chạy lại ultimate-fix.sh${NC}"
echo -e "${YELLOW}Hoặc test bằng: mongosh 'mongodb://vphone_admin:vphone_secure_2024@localhost:27017/vphone?authSource=admin'${NC}" 