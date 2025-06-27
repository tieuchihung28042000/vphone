# 🚀 Hướng Dẫn Deploy VPhone lên VPS

## 📋 Yêu Cầu Hệ Thống

- **OS**: Ubuntu 20.04+ hoặc CentOS 8+
- **RAM**: Tối thiểu 2GB, khuyến nghị 4GB+
- **Storage**: Tối thiểu 20GB
- **Docker**: Version 20.0+
- **Docker Compose**: Version 2.0+

## 🔧 Chuẩn Bị VPS

### 1. Cập nhật hệ thống
```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Cài đặt Docker
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

### 3. Cài đặt Docker Compose
```bash
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 4. Cài đặt Nginx (cho SSL)
```bash
sudo apt install nginx certbot python3-certbot-nginx -y
```

## 🌐 Cấu Hình Domain

### 1. Trỏ DNS
Trỏ domain `app.vphone.vn` về IP VPS của bạn:
```
Type: A
Name: app
Value: YOUR_VPS_IP
TTL: 300
```

### 2. Tạo SSL Certificate
```bash
sudo certbot certonly --nginx -d app.vphone.vn
```

## 📦 Deploy Ứng Dụng

### 1. Clone code
```bash
git clone https://github.com/your-repo/vphone.git
cd vphone
```

### 2. Phân quyền script
```bash
chmod +x deploy.sh
```

### 3. Deploy production
```bash
./deploy.sh production
```

Hoặc sử dụng menu:
```bash
./deploy.sh
# Chọn option 2) Deploy to PRODUCTION
```

## 🔍 Kiểm Tra Deploy

### 1. Kiểm tra containers
```bash
docker ps
```

Bạn sẽ thấy 4 containers:
- `vphone-nginx` (port 80, 443)
- `vphone-frontend` (port 3000)
- `vphone-backend` (port 4000)
- `vphone-mongodb` (port 27017)

### 2. Kiểm tra logs
```bash
./deploy.sh
# Chọn option 3) Show logs
```

### 3. Test ứng dụng
- **Frontend**: https://app.vphone.vn
- **API Health**: https://app.vphone.vn/health
- **API Test**: https://app.vphone.vn/api/health

## 🔐 Thông Tin Đăng Nhập

**Admin Account:**
- Email: `admin@vphone.com`
- Password: `123456`

**Database:**
- Host: `localhost:27017`
- Username: `vphone_admin`
- Password: `vphone_secure_2024`
- Database: `vphone`

## 🛠️ Các Lệnh Hữu Ích

### Xem logs
```bash
# Logs tất cả services
docker-compose -f docker-compose.prod.yml logs -f

# Logs service cụ thể
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f frontend
```

### Restart services
```bash
# Restart tất cả
docker-compose -f docker-compose.prod.yml restart

# Restart service cụ thể
docker-compose -f docker-compose.prod.yml restart backend
```

### Backup database
```bash
./deploy.sh
# Chọn option 5) Backup database
```

### Update ứng dụng
```bash
git pull origin main
./deploy.sh production
```

## 🔧 Troubleshooting

### 1. SSL không hoạt động
```bash
sudo certbot --nginx -d app.vphone.vn
sudo nginx -t
sudo systemctl reload nginx
```

### 2. Container không start
```bash
# Xem logs chi tiết
docker-compose -f docker-compose.prod.yml logs backend

# Kiểm tra resources
docker stats
free -h
df -h
```

### 3. Database connection failed
```bash
# Kiểm tra MongoDB
docker exec -it vphone-mongodb mongosh
use admin
db.auth("vphone_admin", "vphone_secure_2024")
show dbs
```

### 4. Port bị chiếm
```bash
# Kiểm tra port đang sử dụng
sudo netstat -tulpn | grep :80
sudo netstat -tulpn | grep :443

# Kill process nếu cần
sudo kill -9 PID
```

## 🔄 Cập Nhật Thường Xuyên

### 1. Cập nhật code
```bash
cd /path/to/vphone
git pull origin main
./deploy.sh production
```

### 2. Cập nhật SSL certificate (tự động)
```bash
sudo crontab -e
# Thêm dòng sau:
0 12 * * * /usr/bin/certbot renew --quiet
```

### 3. Backup định kỳ
```bash
sudo crontab -e
# Thêm dòng sau (backup hàng ngày lúc 2h sáng):
0 2 * * * cd /path/to/vphone && ./deploy.sh backup
```

## 📞 Hỗ Trợ

Nếu gặp vấn đề, vui lòng:
1. Kiểm tra logs: `./deploy.sh` → option 3
2. Kiểm tra container status: `docker ps -a`
3. Kiểm tra disk space: `df -h`
4. Kiểm tra memory: `free -h`

---

**Chúc bạn deploy thành công! 🎉** 