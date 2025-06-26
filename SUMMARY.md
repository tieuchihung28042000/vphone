# 📦 VPhone System - Sẵn Sàng Triển Khai

## ✅ Đã Chuẩn Bị

### 🗄️ Database Backup
- `mongodb-data/test-backup/` - Database test (mỹ phẩm) 
- `mongodb-data/vphone-backup/` - Database vphone (iPhone)

### 🐳 Docker Configurations
- `docker-compose.test.yml` - Cho test.vphone.vn (MongoDB: 27018, Backend: 4001, Frontend: 8081)
- `docker-compose.app.yml` - Cho app.vphone.vn (MongoDB: 27019, Backend: 4002, Frontend: 8083)

### 🌐 Nginx Configs
- `nginx-production.conf` - Reverse proxy chính cho cả 2 domains
- `setup-nginx.sh` - Script cài đặt nginx trên VPS

### 🚀 Deploy Scripts
- `cleanup-pm2.sh` - Dọn dẹp PM2 và hệ thống cũ
- `deploy-test.sh` - Triển khai test.vphone.vn
- `deploy-app.sh` - Triển khai app.vphone.vn
- `full-deploy.sh` - Triển khai tổng hợp (cleanup + deploy cả 2)

## 🎯 Cách Sử Dụng Trên VPS

### 🔥 Triển khai nhanh (Tự động dọn dẹp PM2 + Deploy cả 2)
```bash
# 1. Upload toàn bộ thư mục lên VPS
scp -r vphone/ user@vps-ip:/home/user/

# 2. Chạy script tổng hợp (khuyến nghị)
cd /home/user/vphone
./full-deploy.sh

# 3. Cài đặt nginx
./setup-nginx.sh

# 4. Cấu hình DNS
# test.vphone.vn → VPS-IP
# app.vphone.vn → VPS-IP
```

### 🎯 Hoặc triển khai từng bước
```bash
# 1. Dọn dẹp PM2 cũ (nếu có)
./cleanup-pm2.sh

# 2. Triển khai test.vphone.vn
./deploy-test.sh

# 3. Triển khai app.vphone.vn  
./deploy-app.sh

# 4. Cài đặt nginx
./setup-nginx.sh
```

## 📊 Thông Tin Admin

- **test.vphone.vn**: admin@vphone.com
- **app.vphone.vn**: vphone24h1@gmail.com

## 📚 Chi Tiết

Xem `DEPLOY_GUIDE.md` để biết hướng dẫn đầy đủ. 