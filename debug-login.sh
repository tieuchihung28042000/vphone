#!/bin/bash

echo "🔍 DEBUG ĐĂNG NHẬP - KIỂM TRA NHANH"
echo "=================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() { echo -e "${GREEN}✅ $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }

cd /root/vphone

echo "1️⃣ Kiểm tra PM2 Backend..."
pm2 list | grep vphone-backend
echo ""

echo "2️⃣ Kiểm tra Backend Logs (20 dòng cuối)..."
pm2 logs vphone-backend --lines 20 --nostream
echo ""

echo "3️⃣ Test Backend Health..."
curl -v http://localhost:4000/health
echo ""

echo "4️⃣ Test API Login..."
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"vphone24h1@gmail.com","password":"0985630451vU"}' \
  -v
echo ""

echo "5️⃣ Kiểm tra MongoDB..."
mongo --eval "print('MongoDB connection: OK')" 2>/dev/null || print_error "MongoDB không kết nối được"
echo ""

echo "6️⃣ Kiểm tra Admin User trong DB..."
mongo vphone --eval "
print('=== ADMIN USERS ===');
db.admins.find().forEach(function(doc) {
    print('Email: ' + doc.email);
    print('Role: ' + doc.role);
    print('Active: ' + doc.isActive);
    print('Password hash: ' + doc.password.substring(0, 20) + '...');
    print('---');
});
print('Total admins: ' + db.admins.countDocuments());
" 2>/dev/null || print_error "Không thể truy cập database"
echo ""

echo "7️⃣ Kiểm tra Backend Connection String..."
grep -n "mongodb://" backend/server.js | head -3
echo ""

echo "8️⃣ Kiểm tra port 4000..."
netstat -tulpn | grep :4000
echo ""

echo "9️⃣ Test Frontend API call..."
curl -I http://app.vphone.vn/api/auth/login
echo ""

echo "🔟 Kiểm tra Nginx Logs..."
sudo tail -10 /var/log/nginx/error.log 2>/dev/null || echo "Không có nginx error logs"
echo ""

echo "🎯 TỔNG KẾT:"
echo "============"

# Backend status
if pm2 list | grep vphone-backend | grep -q online; then
    print_status "Backend đang chạy"
else
    print_error "Backend không chạy"
fi

# MongoDB status
if mongo --eval "print('test')" > /dev/null 2>&1; then
    print_status "MongoDB kết nối OK"
else
    print_error "MongoDB không kết nối được"
fi

# Admin user
ADMIN_COUNT=$(mongo vphone --quiet --eval "db.admins.countDocuments()" 2>/dev/null)
if [ "$ADMIN_COUNT" -gt 0 ]; then
    print_status "Admin user có trong DB ($ADMIN_COUNT users)"
else
    print_error "Không có admin user trong DB"
fi

# Backend health
if curl -s http://localhost:4000/health > /dev/null; then
    print_status "Backend health OK"
else
    print_error "Backend health lỗi"
fi

echo ""
echo "💡 HƯỚNG DẪN SỬA LỖI:"
echo "==================="
echo "1. Nếu Backend offline: pm2 restart vphone-backend"
echo "2. Nếu MongoDB lỗi: sudo systemctl start mongod"
echo "3. Nếu không có admin: mongo vphone --eval 'db.admins.find()'"
echo "4. Nếu API lỗi: pm2 logs vphone-backend --lines 50" 