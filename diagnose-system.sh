#!/bin/bash

echo "🔍 CHẨN ĐOÁN HỆ THỐNG - TẠI SAO MONGODB KHÔNG HOẠT ĐỘNG"
echo "====================================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() { echo -e "${GREEN}✅ $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }

echo "1️⃣ Thông tin hệ thống..."
echo "OS: $(cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2)"
echo "Kernel: $(uname -r)"
echo "Architecture: $(uname -m)"
echo "Memory: $(free -h | grep Mem | awk '{print $2}')"
echo "Disk space:"
df -h / | tail -1
echo ""

echo "2️⃣ Kiểm tra MongoDB binary..."
if command -v mongod &> /dev/null; then
    print_status "MongoDB binary tồn tại"
    echo "Location: $(which mongod)"
    echo "Version:"
    mongod --version | head -5
    
    # Test chạy mongod với --help
    print_warning "Test mongod --help..."
    if mongod --help > /dev/null 2>&1; then
        print_status "MongoDB binary hoạt động"
    else
        print_error "MongoDB binary bị lỗi"
        echo "Lỗi:"
        mongod --help 2>&1 | head -10
    fi
else
    print_error "MongoDB binary không tồn tại"
    
    print_warning "Cài đặt MongoDB..."
    # Cài MongoDB đơn giản
    sudo apt-get update
    sudo apt-get install -y mongodb
    
    if command -v mongod &> /dev/null; then
        print_status "MongoDB đã được cài đặt"
    else
        print_error "Không thể cài MongoDB"
    fi
fi
echo ""

echo "3️⃣ Kiểm tra dependencies..."
print_warning "Checking required libraries..."

# Kiểm tra các thư viện cần thiết
ldd $(which mongod) 2>/dev/null | head -10 || echo "Không thể check dependencies"
echo ""

echo "4️⃣ Kiểm tra ports..."
print_warning "Ports đang được sử dụng:"
sudo netstat -tulpn | grep -E ":27017|:27018|:27019"
echo ""

echo "5️⃣ Kiểm tra processes..."
print_warning "MongoDB processes:"
ps aux | grep mongod | grep -v grep || echo "Không có MongoDB process"
echo ""

echo "6️⃣ Test khởi động MongoDB với output chi tiết..."
print_warning "Tạo thư mục test..."
TEST_DIR="/tmp/mongodb-test"
rm -rf $TEST_DIR
mkdir -p $TEST_DIR
chmod 755 $TEST_DIR

print_warning "Thử khởi động MongoDB với verbose output..."
echo "Command: mongod --dbpath $TEST_DIR --port 27019 --bind_ip 127.0.0.1 --logpath $TEST_DIR/mongo.log"

# Chạy MongoDB với output đầy đủ
timeout 10s mongod --dbpath $TEST_DIR --port 27019 --bind_ip 127.0.0.1 --logpath $TEST_DIR/mongo.log --verbose 2>&1 | head -20

echo ""
echo "Logs từ MongoDB:"
cat $TEST_DIR/mongo.log 2>/dev/null | head -20 || echo "Không có logs"
echo ""

echo "7️⃣ Thử các alternatives..."

# Thử với mongodb (không phải mongod)
if command -v mongodb &> /dev/null; then
    print_warning "Thử với mongodb command..."
    mongodb --help 2>&1 | head -5
fi

# Thử với mongo
if command -v mongo &> /dev/null; then
    print_warning "Thử kết nối mongo client..."
    echo "show dbs" | mongo --quiet 2>&1 | head -5
fi

echo ""
echo "8️⃣ Kiểm tra system limits..."
print_warning "System limits:"
echo "Max open files: $(ulimit -n)"
echo "Max processes: $(ulimit -u)"
echo "Max memory: $(ulimit -v)"
echo ""

echo "9️⃣ Thử alternative database..."
print_warning "Vì MongoDB không hoạt động, thử SQLite..."

# Kiểm tra SQLite
if command -v sqlite3 &> /dev/null; then
    print_status "SQLite có sẵn"
    sqlite3 --version
    
    # Tạo database SQLite test
    print_warning "Tạo SQLite database test..."
    sqlite3 /tmp/test.db "CREATE TABLE test (id INTEGER, name TEXT); INSERT INTO test VALUES (1, 'test'); SELECT * FROM test;"
    
    if [ $? -eq 0 ]; then
        print_status "✅ SQLite hoạt động bình thường!"
        rm -f /tmp/test.db
    fi
else
    print_warning "Cài SQLite..."
    sudo apt-get install -y sqlite3
fi

echo ""
echo "🔟 Đề xuất giải pháp..."
echo "======================"

if command -v mongod &> /dev/null; then
    if mongod --help > /dev/null 2>&1; then
        print_warning "MongoDB binary OK nhưng không khởi động được"
        echo "🔧 Có thể do:"
        echo "   - Thiếu quyền trên thư mục"
        echo "   - Port bị chiếm"
        echo "   - System resources không đủ"
        echo "   - Config sai"
        echo ""
        echo "💡 Thử:"
        echo "   sudo mongod --dbpath /tmp/test-mongo --port 27020 --bind_ip 127.0.0.1"
    else
        print_error "MongoDB binary bị lỗi"
        echo "🔧 Giải pháp:"
        echo "   1. Gỡ cài đặt: sudo apt-get purge mongodb*"
        echo "   2. Cài lại: sudo apt-get install mongodb"
        echo "   3. Hoặc dùng SQLite thay thế"
    fi
else
    print_error "MongoDB chưa được cài"
    echo "🔧 Giải pháp:"
    echo "   1. Cài MongoDB: sudo apt-get install mongodb"
    echo "   2. Hoặc dùng SQLite"
fi

echo ""
echo "🎯 KHUYẾN NGHỊ:"
echo "==============="
echo "Vì MongoDB gặp vấn đề nghiêm trọng trên VPS này,"
echo "tôi khuyên dùng SQLite thay thế:"
echo ""
echo "✅ SQLite advantages:"
echo "   - Không cần daemon"
echo "   - File-based database"
echo "   - Ít tài nguyên"
echo "   - Dễ backup"
echo "   - Tương thích tốt"
echo ""
echo "Bạn có muốn tôi tạo script chuyển sang SQLite không?" 