# 🚀 Hướng Dẫn Triển Khai VPhone System

## 📋 Tổng Quan

Hệ thống VPhone được chia thành 2 môi trường độc lập:

1. **test.vphone.vn** - Hệ thống test với database `test`
2. **app.vphone.vn** - Hệ thống production với database `vphone`

## 📦 Cấu Trúc Files

```
vphone/
├── docker-compose.test.yml     # Docker config cho test.vphone.vn
├── docker-compose.app.yml      # Docker config cho app.vphone.vn
├── nginx-test.conf            # Nginx config cho test.vphone.vn
├── nginx-app.conf             # Nginx config cho app.vphone.vn
├── deploy-test.sh             # Script deploy test.vphone.vn
├── deploy-app.sh              # Script deploy app.vphone.vn
├── mongodb-data/
│   ├── test-backup/           # Backup data cho database test
│   └── vphone-backup/         # Backup data cho database vphone
└── scripts/
    ├── restore-test.sh        # Script restore database test
    └── restore-vphone.sh      # Script restore database vphone
```

## 🔧 Cấu Hình Ports

### Test Environment (test.vphone.vn)
- MongoDB: `27018`
- Backend API: `4001`
- Frontend: `8081`
- Nginx: `8082`

### App Environment (app.vphone.vn)
- MongoDB: `27019`
- Backend API: `4002`
- Frontend: `8083`
- Nginx: `8084`

## 🚀 Triển Khai Trên VPS

### Bước 1: Dọn Dẹp Hệ Thống Cũ (Nếu có PM2)

⚠️ **QUAN TRỌNG**: Nếu bạn đã triển khai hệ thống cũ bằng PM2, cần dọn dẹp trước:

```bash
cd /home/user/vphone
chmod +x cleanup-pm2.sh
./cleanup-pm2.sh
```

### Bước 2: Chuẩn bị VPS

```bash
# Cài đặt Docker và Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Thêm user vào docker group
sudo usermod -aG docker $USER
```

### Bước 3: Upload Code

```bash
# Upload toàn bộ thư mục vphone lên VPS
scp -r vphone/ user@your-vps-ip:/home/user/
```

### Bước 4: Triển Khai

#### Triển khai test.vphone.vn

```bash
cd /home/user/vphone
chmod +x deploy-test.sh
./deploy-test.sh
```

#### Triển khai app.vphone.vn

```bash
cd /home/user/vphone
chmod +x deploy-app.sh
./deploy-app.sh
```

### Bước 5: Cài Đặt Nginx

```bash
# Cài đặt và cấu hình nginx
chmod +x setup-nginx.sh
./setup-nginx.sh
```

### Bước 6: Cấu Hình DNS

Trỏ DNS records (chỉ cần trỏ về IP VPS, không cần port):
- `test.vphone.vn` → IP VPS
- `app.vphone.vn` → IP VPS

### Bước 7: Cấu Hình SSL (Tùy chọn)

```bash
# Cài đặt Certbot
sudo apt install certbot python3-certbot-nginx

# Tạo SSL certificate
sudo certbot --nginx -d test.vphone.vn
sudo certbot --nginx -d app.vphone.vn
```

## 📊 Kiểm Tra Hệ Thống

### Kiểm tra containers
```bash
# Test environment
docker-compose -f docker-compose.test.yml ps
docker-compose -f docker-compose.test.yml logs -f

# App environment
docker-compose -f docker-compose.app.yml ps
docker-compose -f docker-compose.app.yml logs -f
```

### Health checks
```bash
# Test health
curl http://test.vphone.vn/health

# App health  
curl http://app.vphone.vn/health
```

## 🔄 Quản Lý Hệ Thống

### Khởi động lại
```bash
# Test environment
docker-compose -f docker-compose.test.yml restart

# App environment
docker-compose -f docker-compose.app.yml restart
```

### Dừng hệ thống
```bash
# Test environment
docker-compose -f docker-compose.test.yml down

# App environment
docker-compose -f docker-compose.app.yml down
```

### Xem logs
```bash
# Test logs
docker-compose -f docker-compose.test.yml logs -f [service-name]

# App logs
docker-compose -f docker-compose.app.yml logs -f [service-name]
```

## 📚 Thông Tin Database

### Test Database (test.vphone.vn)
- **Admin Account**: admin@vphone.com
- **Database Name**: test
- **Collections**: 8 collections
- **Sample Data**: Mỹ phẩm (cosmetics)

### App Database (app.vphone.vn)
- **Admin Account**: vphone24h1@gmail.com
- **Database Name**: vphone
- **Collections**: 8 collections
- **Sample Data**: iPhone inventory (368 items)

## 🛠️ Troubleshooting

### Lỗi thường gặp

1. **Port đã được sử dụng**
   ```bash
   sudo netstat -tulpn | grep :PORT_NUMBER
   sudo kill -9 PID
   ```

2. **Container không start**
   ```bash
   docker-compose logs container-name
   ```

3. **Database không restore**
   ```bash
   docker exec -it mongodb-container mongosh
   show dbs
   ```

## 🔒 Bảo Mật

- Thay đổi password MongoDB trong docker-compose files
- Thay đổi JWT_SECRET
- Cấu hình firewall chỉ mở port cần thiết
- Sử dụng SSL certificates

## 📞 Hỗ Trợ

- Kiểm tra logs: `docker-compose logs -f`
- Restart services khi cần thiết
- Monitor disk space và memory usage 