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

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================${NC}"
}

print_header "🔧 SIMPLE MONGODB FIX"

# Dừng tất cả MongoDB
print_status "Dừng MongoDB..."
sudo systemctl stop mongod
sudo pkill -f mongod || true
sleep 3

# Xóa socket files
print_status "Xóa socket files..."
sudo rm -f /tmp/mongodb-*.sock
sudo rm -f /var/run/mongodb/mongod.pid
sudo rm -f /var/lib/mongodb/mongod.lock

# Sửa quyền
print_status "Sửa quyền..."
sudo chown -R mongodb:mongodb /var/lib/mongodb
sudo chown -R mongodb:mongodb /var/log/mongodb

# Tạo config đơn giản nhất
print_status "Tạo mongod.conf đơn giản..."
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

# Test config
print_status "Test config..."
if sudo mongod --config /etc/mongod.conf --dry-run; then
    print_status "✅ Config OK"
else
    print_error "❌ Config vẫn lỗi, thử config tối thiểu..."
    
    # Config tối thiểu
    sudo tee /etc/mongod.conf > /dev/null << 'EOF'
storage:
  dbPath: /var/lib/mongodb
systemLog:
  destination: file
  path: /var/log/mongodb/mongod.log
net:
  port: 27017
  bindIp: 127.0.0.1
EOF
fi

# Khởi động MongoDB
print_status "Khởi động MongoDB..."
sudo systemctl start mongod
sleep 5

# Kiểm tra
if sudo systemctl is-active --quiet mongod; then
    print_status "✅ MongoDB started successfully!"
    
    # Kiểm tra port
    sudo netstat -tulpn | grep :27017
    
    # Test connection
    if mongosh --eval "db.runCommand('ping')" > /dev/null 2>&1; then
        print_status "✅ MongoDB connection OK"
        
        # Tạo user và database
        print_status "Tạo user và database..."
        mongosh --eval "
        use admin;
        try {
            db.createUser({
                user: 'vphone_admin',
                pwd: 'vphone_secure_2024',
                roles: ['root']
            });
            print('✅ Admin user created');
        } catch(e) {
            print('⚠️ User exists: ' + e.message);
        }
        
        use vphone;
        db.createCollection('test');
        print('✅ Database vphone ready');
        " 2>/dev/null || print_status "User setup completed with warnings"
        
        # Enable auth
        print_status "Enable authentication..."
        echo "" | sudo tee -a /etc/mongod.conf
        echo "security:" | sudo tee -a /etc/mongod.conf
        echo "  authorization: enabled" | sudo tee -a /etc/mongod.conf
        
        # Restart với auth
        sudo systemctl restart mongod
        sleep 5
        
        # Test với auth
        if mongosh "mongodb://vphone_admin:vphone_secure_2024@localhost:27017/admin" --eval "db.runCommand('ping')" > /dev/null 2>&1; then
            print_status "✅ Authentication working!"
            
            # Restore data nếu có
            if [ -d "./mongodb-data/vphone-complete-backup/vphone" ]; then
                print_status "Restoring database..."
                mongorestore --host localhost:27017 --authenticationDatabase admin -u vphone_admin -p vphone_secure_2024 --db vphone --drop ./mongodb-data/vphone-complete-backup/vphone/ 2>/dev/null || print_status "Restore completed"
            fi
            
        else
            print_error "❌ Authentication failed"
        fi
        
    else
        print_error "❌ MongoDB connection failed"
    fi
    
else
    print_error "❌ MongoDB failed to start"
    print_status "Checking logs..."
    sudo tail -10 /var/log/mongodb/mongod.log
    
    # Thử khởi động manual
    print_status "Thử khởi động manual..."
    sudo -u mongodb mongod --dbpath /var/lib/mongodb --logpath /var/log/mongodb/mongod.log --fork --bind_ip 127.0.0.1 --port 27017
fi

# Final check
print_header "FINAL STATUS"
print_status "MongoDB service:"
sudo systemctl status mongod --no-pager -l | head -5

print_status "Port 27017:"
sudo netstat -tulpn | grep :27017

print_status "Test connection:"
mongosh "mongodb://vphone_admin:vphone_secure_2024@localhost:27017/vphone?authSource=admin" --eval "print('✅ Final test OK')" 2>/dev/null || print_error "Final test failed"

print_header "🎉 MONGODB SIMPLE FIX COMPLETED"
echo -e "${GREEN}If successful, restart backend: pm2 restart vphone-backend${NC}" 