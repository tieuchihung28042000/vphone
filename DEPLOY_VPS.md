# 🚀 Hướng Dẫn Deploy VPhone lên VPS với PM2

## 📋 Yêu Cầu Hệ Thống

- **OS**: Ubuntu 20.04+ hoặc CentOS 8+
- **RAM**: Tối thiểu 2GB, khuyến nghị 4GB+
- **Storage**: Tối thiểu 20GB
- **Node.js**: Version 20.x
- **MongoDB**: Version 7.0
- **PM2**: Process Manager

## 🌐 Cấu Hình Domain

### 1. Trỏ DNS
Trỏ domain `app.vphone.vn` về IP VPS của bạn:
```
Type: A
Name: app
Value: YOUR_VPS_IP
TTL: 300
```

### 2. Kiểm tra DNS
```bash
nslookup app.vphone.vn
# hoặc
dig app.vphone.vn
```

## 📦 Deploy Ứng Dụng

### 1. Upload code lên VPS

**Cách 1: Sử dụng Git (Khuyến nghị)**
```bash
# Trên VPS
git clone https://github.com/your-username/vphone.git
cd vphone
```

**Cách 2: Sử dụng SCP từ máy local**
```bash
# Trên máy local (loại bỏ các thư mục không cần thiết)
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'mongodb-data' vphone/ root@YOUR_VPS_IP:/root/vphone/
```

### 2. Deploy tự động

```bash
# Cấp quyền thực thi
chmod +x deploy-pm2.sh

# Deploy production
./deploy-pm2.sh production
```

Hoặc sử dụng menu:
```bash
./deploy-pm2.sh
# Chọn option 2) Deploy to PRODUCTION
```

### 3. Script sẽ tự động:
- ✅ Cài đặt Node.js, MongoDB, PM2, Nginx
- ✅ Cấu hình MongoDB với user/password
- ✅ Restore dữ liệu từ backup
- ✅ Build frontend với API URL production
- ✅ Cấu hình Nginx reverse proxy
- ✅ Khởi động backend với PM2
- ✅ Hiển thị status và logs

## 🔍 Kiểm Tra Deploy

### 1. Kiểm tra services
```bash
./deploy-pm2.sh
# Chọn option 4) Show status
```

### 2. Kiểm tra logs
```bash
./deploy-pm2.sh
# Chọn option 3) Show logs
```

### 3. Test ứng dụng
- **Frontend**: http://app.vphone.vn
- **API Health**: http://app.vphone.vn/health
- **API Test**: http://app.vphone.vn/api/health

## 🔐 Thông Tin Đăng Nhập

**Tài khoản có sẵn:**
- Email: `vphone24h1@gmail.com`
- Password: `0985630451vU`

**Database:**
- Host: `localhost:27017`
- Username: `vphone_admin`
- Password: `vphone_secure_2024`
- Database: `vphone`

## 🛠️ Các Lệnh Hữu Ích

### PM2 Commands
```bash
# Xem danh sách processes
pm2 list

# Xem logs
pm2 logs vphone-backend

# Restart backend
pm2 restart vphone-backend

# Stop backend
pm2 stop vphone-backend

# Monitor real-time
pm2 monit
```

### MongoDB Commands
```bash
# Kết nối MongoDB
mongosh -u vphone_admin -p vphone_secure_2024 --authenticationDatabase admin

# Backup database
mongodump --host localhost:27017 --authenticationDatabase admin -u vphone_admin -p vphone_secure_2024 --db vphone --out ./backup
```

### Nginx Commands
```bash
# Test config
sudo nginx -t

# Reload config
sudo systemctl reload nginx

# Restart nginx
sudo systemctl restart nginx

# Check status
sudo systemctl status nginx
```

## 🔧 Troubleshooting

### 1. Backend không start
```bash
# Xem logs chi tiết
pm2 logs vphone-backend

# Kiểm tra port
sudo netstat -tulpn | grep :4000

# Restart backend
pm2 restart vphone-backend
```

### 2. MongoDB connection failed
```bash
# Kiểm tra MongoDB
sudo systemctl status mongod

# Restart MongoDB
sudo systemctl restart mongod

# Test connection
mongosh --eval "db.runCommand('ping')"
```

### 3. Nginx lỗi
```bash
# Test config
sudo nginx -t

# Xem error logs
sudo tail -f /var/log/nginx/error.log

# Restart nginx
sudo systemctl restart nginx
```

### 4. Port bị chiếm
```bash
# Kiểm tra port đang sử dụng
sudo netstat -tulpn | grep :80
sudo netstat -tulpn | grep :4000

# Kill process nếu cần
sudo kill -9 PID
```

## 🔄 Cập Nhật Ứng Dụng

### 1. Cập nhật code
```bash
cd /root/vphone
git pull origin main
./deploy-pm2.sh production
```

### 2. Chỉ restart backend
```bash
cd backend
npm install  # nếu có dependencies mới
pm2 restart vphone-backend
```

### 3. Rebuild frontend
```bash
cd iphone-inventory
npm install  # nếu có dependencies mới
npm run build
sudo systemctl reload nginx
```

## 🔄 Backup Định Kỳ

### 1. Tạo script backup
```bash
sudo nano /root/backup-vphone.sh
```

Nội dung:
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/root/backups"
mkdir -p $BACKUP_DIR

# Backup database
mongodump --host localhost:27017 --authenticationDatabase admin -u vphone_admin -p vphone_secure_2024 --db vphone --out $BACKUP_DIR/db_$DATE

# Backup code
tar -czf $BACKUP_DIR/code_$DATE.tar.gz /root/vphone --exclude=node_modules

# Keep only last 7 backups
find $BACKUP_DIR -name "db_*" -mtime +7 -exec rm -rf {} \;
find $BACKUP_DIR -name "code_*" -mtime +7 -delete

echo "Backup completed: $DATE"
```

### 2. Cấp quyền và tạo cron job
```bash
chmod +x /root/backup-vphone.sh

# Thêm vào crontab (backup hàng ngày lúc 2h sáng)
sudo crontab -e
# Thêm dòng sau:
0 2 * * * /root/backup-vphone.sh >> /var/log/vphone-backup.log 2>&1
```

## 📞 Hỗ Trợ

### Các lệnh debug nhanh:
```bash
# Xem tất cả status
./deploy-pm2.sh
# Chọn option 4

# Restart tất cả services
pm2 restart all
sudo systemctl restart nginx mongod

# Cleanup và deploy lại
./deploy-pm2.sh
# Chọn option 5 (cleanup) rồi option 2 (deploy)
```

### Thông tin hệ thống:
```bash
# Kiểm tra resources
free -h
df -h
pm2 monit

# Kiểm tra network
sudo netstat -tulpn | grep -E ":80|:4000|:27017"
```

## Lỗi MongoDB Authentication - KHẮC PHỤC NGAY

**Vấn đề:** Backend lỗi "Authentication failed" với MongoDB

**Giải pháp:** Chạy các lệnh sau trên VPS:

```bash
# 1. Dừng PM2 backend
pm2 stop vphone-backend

# 2. Kiểm tra MongoDB status
sudo systemctl status mongod

# 3. Kết nối MongoDB và tạo user
sudo mongo
```

**Trong MongoDB shell, chạy:**
```javascript
// Chuyển sang database admin
use admin

// Tạo admin user (nếu chưa có)
db.createUser({
  user: "admin",
  pwd: "admin123",
  roles: [{ role: "userAdminAnyDatabase", db: "admin" }]
})

// Chuyển sang database vphone
use vphone

// Tạo user cho database vphone
db.createUser({
  user: "vphone_admin",
  pwd: "vphone_secure_2024",
  roles: [{ role: "readWrite", db: "vphone" }]
})

// Thoát MongoDB shell
exit
```

**Sau đó:**
```bash
# 4. Restart MongoDB với authentication
sudo systemctl restart mongod

# 5. Test kết nối MongoDB
mongo -u vphone_admin -p vphone_secure_2024 --authenticationDatabase vphone

# 6. Khởi động lại PM2 backend
pm2 start vphone-backend

# 7. Kiểm tra logs
pm2 logs vphone-backend --lines 10
```

## Nếu vẫn lỗi, thử cách này:

```bash
# Tắt authentication tạm thời
sudo nano /etc/mongod.conf

# Comment dòng này:
# security:
#   authorization: enabled

# Restart MongoDB
sudo systemctl restart mongod

# Tạo user lại
mongo
use vphone
db.createUser({
  user: "vphone_admin", 
  pwd: "vphone_secure_2024",
  roles: ["readWrite"]
})
exit

# Bật lại authentication
sudo nano /etc/mongod.conf
# Uncomment:
security:
  authorization: enabled

# Restart
sudo systemctl restart mongod
pm2 restart vphone-backend
```

## Kiểm tra cuối cùng:

```bash
# 1. MongoDB user
mongo -u vphone_admin -p vphone_secure_2024 --authenticationDatabase vphone --eval "db.stats()"

# 2. Backend health
curl http://localhost:4000/health

# 3. PM2 status
pm2 list

# 4. Website
curl http://app.vphone.vn
```

---

**✅ LỢI ÍCH CỦA PM2 SO VỚI DOCKER:**
- 🚀 **Nhanh hơn**: Không có overhead của containers
- 🔧 **Đơn giản hơn**: Ít dependency conflicts
- 📊 **Monitoring tốt**: `pm2 monit` real-time
- 🔄 **Auto restart**: Tự động restart khi crash
- 💾 **Ít tài nguyên**: RAM và CPU usage thấp hơn

**Chúc bạn deploy thành công! 🎉** 