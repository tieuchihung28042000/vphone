# 🐳 VPhone Docker Deployment Guide

## 📋 Tổng quan
Hệ thống VPhone được đóng gói thành Docker containers để dễ dàng deploy và scale:

- **Backend**: Node.js API (Port 4000)
- **Frontend**: React + Nginx (Port 80)  
- **Database**: MongoDB (Port 27017)
- **Proxy**: Nginx reverse proxy (Port 8080)

## 🚀 Quick Start

### 1. Chuẩn bị môi trường
```bash
# Cài đặt Docker và Docker Compose
# macOS
brew install docker docker-compose

# Ubuntu/Debian
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

### 2. Setup Environment
```bash
# Copy environment variables
cp docker.env .env

# Cập nhật thông tin cần thiết trong .env
nano .env
```

### 3. Migration dữ liệu (lần đầu)
```bash
# Migration từ local MongoDB vào Docker
chmod +x migrate-to-docker.sh
./migrate-to-docker.sh
```

### 4. Khởi động hệ thống
```bash
# Build và start tất cả containers
docker-compose up -d --build

# Xem logs
docker-compose logs -f

# Kiểm tra status
docker-compose ps
```

## 🌐 Truy cập ứng dụng

- **Frontend**: http://localhost
- **Backend API**: http://localhost:4000
- **Production Proxy**: http://localhost:8080
- **MongoDB**: localhost:27017

## 🔧 Quản lý containers

### Các lệnh cơ bản
```bash
# Xem status tất cả containers
docker-compose ps

# Restart một service cụ thể  
docker-compose restart backend

# Stop tất cả
docker-compose down

# Xóa volumes (reset database)
docker-compose down -v

# Rebuild một service
docker-compose build backend
docker-compose up -d backend

# Xem logs theo thời gian thực
docker-compose logs -f backend
```

### Database Management
```bash
# Backup MongoDB
docker exec vphone-mongodb mongodump --uri="mongodb://vphone_admin:vphone_secure_password_2024@localhost:27017/test?authSource=admin" --out=/backup

# Restore MongoDB  
docker exec vphone-mongodb mongorestore --uri="mongodb://vphone_admin:vphone_secure_password_2024@localhost:27017/test?authSource=admin" --drop /backup/test

# Connect to MongoDB shell
docker exec -it vphone-mongodb mongosh "mongodb://vphone_admin:vphone_secure_password_2024@localhost:27017/test?authSource=admin"
```

## 🚀 Deploy lên VPS

### 1. Chuẩn bị VPS
```bash
# Cập nhật thông tin VPS trong deploy-vps.sh
nano deploy-vps.sh

# Thay đổi:
VPS_IP="your-vps-ip"          # → "123.456.789.0"  
VPS_USER="root"               # → "ubuntu" hoặc user của bạn
PROJECT_PATH="/opt/vphone"    # → đường dẫn deploy
```

### 2. Deploy
```bash
# Deploy lên VPS
chmod +x deploy-vps.sh
./deploy-vps.sh
```

### 3. Quản lý trên VPS
```bash
# SSH vào VPS
ssh user@your-vps-ip

# Di chuyển vào thư mục project
cd /opt/vphone

# Các lệnh quản lý
docker-compose ps
docker-compose logs -f
docker-compose restart
docker-compose down && docker-compose up -d
```

## 🔒 Bảo mật Production

### 1. Firewall rules
```bash
# Chỉ mở các port cần thiết
ufw allow 80/tcp     # HTTP
ufw allow 443/tcp    # HTTPS  
ufw allow 22/tcp     # SSH
ufw enable
```

### 2. SSL/HTTPS setup
```bash
# Cài đặt Certbot cho Let's Encrypt
apt install certbot python3-certbot-nginx
certbot --nginx -d yourdomain.com
```

### 3. Environment Security
```bash
# Đổi password MongoDB trong .env
MONGO_ROOT_PASSWORD=your-strong-password-here

# Đổi JWT secret
JWT_SECRET=your-random-jwt-secret-here

# Restart để apply changes
docker-compose restart
```

## 📊 Monitoring & Logs

### Health Checks
```bash
# Kiểm tra health của các services
curl http://localhost/health
curl http://localhost:4000/api/health

# Kiểm tra MongoDB
docker exec vphone-mongodb mongosh "mongodb://vphone_admin:vphone_secure_password_2024@localhost:27017/test?authSource=admin" --eval "db.runCommand('ping')"
```

### Log Management
```bash
# Xem logs theo service
docker-compose logs backend
docker-compose logs frontend  
docker-compose logs mongodb

# Limit log size (trong docker-compose.yml)
logging:
  options:
    max-size: "100m"
    max-file: "3"
```

## 🆘 Troubleshooting

### Container không start
```bash
# Kiểm tra logs
docker-compose logs service-name

# Rebuild từ đầu
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Database connection error
```bash
# Kiểm tra MongoDB container
docker-compose logs mongodb

# Test connection
docker exec vphone-mongodb mongosh "mongodb://vphone_admin:vphone_secure_password_2024@localhost:27017/test?authSource=admin"
```

### Port conflicts
```bash
# Thay đổi ports trong docker-compose.yml
ports:
  - "8080:80"    # Frontend
  - "5000:4000"  # Backend  
  - "27018:27017" # MongoDB
```

## 🔄 Backup & Restore

### Backup toàn bộ
```bash
# Backup code + database
docker-compose exec mongodb mongodump --uri="mongodb://vphone_admin:vphone_secure_password_2024@localhost:27017/test?authSource=admin" --out=/backup
docker cp vphone-mongodb:/backup ./mongodb-backup-$(date +%Y%m%d)
tar -czf vphone-full-backup-$(date +%Y%m%d).tar.gz ./mongodb-backup-$(date +%Y%m%d) docker-compose.yml .env
```

### Restore
```bash
# Extract backup
tar -xzf vphone-full-backup-20241225.tar.gz

# Restore database
docker cp ./mongodb-backup-20241225 vphone-mongodb:/backup
docker-compose exec mongodb mongorestore --uri="mongodb://vphone_admin:vphone_secure_password_2024@localhost:27017/test?authSource=admin" --drop /backup/test
``` 