# 🚀 HƯỚNG DẪN DEPLOY AN TOÀN LÊN VPS

## 📋 CHUẨN BỊ TRƯỚC KHI DEPLOY

### 1. Backup Dữ Liệu Quan Trọng
```bash
# SSH vào VPS
ssh root@your-vps-ip

# Backup MongoDB
mkdir -p /backup/$(date +%Y%m%d_%H%M%S)
mongodump --db vphone --out /backup/$(date +%Y%m%d_%H%M%S)/

# Backup file cấu hình quan trọng
cp -r /var/www/vphone /backup/$(date +%Y%m%d_%H%M%S)/vphone_old
cp /etc/nginx/sites-available/vphone /backup/$(date +%Y%m%d_%H%M%S)/
cp /root/.env /backup/$(date +%Y%m%d_%H%M%S)/
```

### 2. Kiểm Tra Trạng Thái Hiện Tại
```bash
# Kiểm tra services đang chạy
pm2 status
systemctl status nginx

# Kiểm tra port
netstat -tulpn | grep :3000
netstat -tulpn | grep :80
```

## 🔄 DEPLOY CODE MỚI

### Bước 1: Cập Nhật Code Từ Git
```bash
# Di chuyển vào thư mục project
cd /var/www/vphone

# Backup .env hiện tại (quan trọng!)
cp iphone-inventory/.env.production iphone-inventory/.env.production.backup
cp backend/.env backend/.env.backup

# Stash các thay đổi local (nếu có)
git stash

# Pull code mới
git pull origin main

# Khôi phục file .env
cp iphone-inventory/.env.production.backup iphone-inventory/.env.production
cp backend/.env.backup backend/.env
```

### Bước 2: Cập Nhật Dependencies
```bash
# Backend dependencies
cd /var/www/vphone/backend
npm install --production

# Frontend dependencies  
cd /var/www/vphone/iphone-inventory
npm install
```

### Bước 3: Build Frontend Mới
```bash
cd /var/www/vphone/iphone-inventory

# Build production
npm run build

# Kiểm tra build thành công
ls -la dist/
```

### Bước 4: Restart Services An Toàn
```bash
# Restart backend (PM2)
pm2 restart vphone-backend

# Kiểm tra backend chạy ok
pm2 logs vphone-backend --lines 20

# Test API hoạt động
curl http://localhost:3000/api/health || echo "Backend chưa sẵn sàng"

# Restart Nginx (sau khi backend ok)
systemctl reload nginx
```

## ✅ KIỂM TRA SAU DEPLOY

### 1. Kiểm Tra Backend API
```bash
# Test kết nối MongoDB
curl -s http://localhost:3000/api/branches | jq .

# Test login endpoint
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}' | jq .
```

### 2. Kiểm Tra Frontend
```bash
# Kiểm tra file static được serve
curl -I http://your-domain.com/assets/index.js

# Kiểm tra trang chính
curl -s http://your-domain.com | grep "<title>"
```

### 3. Kiểm Tra Database
```bash
# Kết nối MongoDB
mongosh vphone

# Kiểm tra collections vẫn còn
db.inventories.countDocuments()
db.users.countDocuments()
db.branches.countDocuments()
exit
```

## 🔧 XỬ LÝ LỖI THƯỜNG GẶP

### Lỗi Build Frontend
```bash
# Xóa cache và build lại
cd /var/www/vphone/iphone-inventory
rm -rf node_modules dist
npm install
npm run build
```

### Lỗi Backend Không Start
```bash
# Xem log chi tiết
pm2 logs vphone-backend

# Restart với môi trường clean
pm2 delete vphone-backend
pm2 start /var/www/vphone/backend/server.js --name "vphone-backend"
```

### Lỗi Nginx 502 Bad Gateway
```bash
# Kiểm tra backend port
netstat -tulpn | grep :3000

# Restart toàn bộ
pm2 restart vphone-backend
sleep 5
systemctl reload nginx
```

## 🔙 ROLLBACK NẾU CẦN

### Rollback Code
```bash
cd /var/www/vphone

# Xem commit hiện tại
git log --oneline -5

# Rollback về commit trước đó
git reset --hard HEAD~1

# Rebuild frontend
cd iphone-inventory
npm run build

# Restart services
pm2 restart vphone-backend
systemctl reload nginx
```

### Rollback Database (Nếu Cần)
```bash
# Khôi phục từ backup
mongorestore --db vphone --drop /backup/YYYYMMDD_HHMMSS/vphone/
```

## 📱 KIỂM TRA CUỐI CÙNG

### Test Các Chức Năng Chính
1. **Đăng nhập hệ thống**
2. **Nhập hàng** - tạo sản phẩm mới
3. **Xuất hàng** - test auto-fill IMEI
4. **Công nợ** - kiểm tra 2 tab hoạt động
5. **Tồn kho** - click IMEI xem chi tiết
6. **Báo cáo** - xem chi tiết giá nhập/bán
7. **Sổ quỹ** - test view tổng hợp

### Monitor Logs
```bash
# Theo dõi logs real-time
pm2 logs vphone-backend --lines 50 --follow

# Theo dõi access logs nginx
tail -f /var/log/nginx/access.log

# Theo dõi error logs nginx  
tail -f /var/log/nginx/error.log
```

## 🛡️ TIPS BẢO MẬT

### Backup Tự Động
```bash
# Tạo script backup hàng ngày
cat > /root/backup_daily.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p /backup/$DATE
mongodump --db vphone --out /backup/$DATE/
cp -r /var/www/vphone /backup/$DATE/
find /backup -type d -mtime +7 -exec rm -rf {} +
EOF

chmod +x /root/backup_daily.sh

# Thêm vào crontab (backup lúc 2h sáng)
echo "0 2 * * * /root/backup_daily.sh" | crontab -
```

### Kiểm Tra Bảo Mật
```bash
# Kiểm tra firewall
ufw status

# Kiểm tra users đang login
who

# Kiểm tra processes đang chạy
ps aux | grep node
```

---

## 📞 LIÊN HỆ HỖ TRỢ

Nếu gặp vấn đề trong quá trình deploy:
1. Kiểm tra logs: `pm2 logs vphone-backend`
2. Kiểm tra nginx: `systemctl status nginx`
3. Test API: `curl http://localhost:3000/api/health`
4. Rollback nếu cần thiết

**🎯 LƯU Ý: Luôn backup trước khi deploy và test từng bước!** 