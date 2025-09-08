# VPhone Docker Auto Setup

Hướng dẫn triển khai VPhone bằng Docker với **tự động setup SSL, Admin user và tất cả services**.

## ✨ Tính năng tự động hoá

- 🔐 **Auto SSL**: Tự động tạo Let's Encrypt certificates cho domain thật
- 👤 **Auto Admin**: Tự động tạo user admin mặc định nếu database trống  
- 🔄 **Auto Renewal**: Tự động gia hạn SSL certificates mỗi 12h
- 🐳 **One-click Deploy**: Chỉ cần 1 lệnh để khởi động tất cả
- 🚀 **Zero Config**: Không cần setup thủ công gì thêm

## 🚀 Yêu cầu hệ thống

- Docker Engine 20.10+
- Docker Compose v2.0+
- RAM: Tối thiểu 2GB
- Disk: Tối thiểu 5GB trống

## 📋 Cấu trúc Docker

```
vphone/
├── docker-compose.yml          # Cấu hình chính với auto setup
├── docker-start-auto.sh       # Script khởi động tự động
├── docker-start.sh            # Script quản lý thủ công
├── env.example               # Biến môi trường mẫu
├── nginx/
│   └── nginx.conf           # Nginx với SSL auto-detect
├── backend/
│   ├── Dockerfile           # Backend container
│   └── scripts/
│       └── init-admin.js    # Auto create admin user
├── iphone-inventory/
│   ├── Dockerfile           # Frontend container
│   └── nginx.conf          # Frontend nginx config
├── ssl-init/
│   ├── Dockerfile           # SSL initialization container
│   └── init-ssl.sh         # Auto SSL setup script
└── ssl-renewal/
    ├── Dockerfile           # SSL renewal service
    └── renew-ssl.sh        # Auto SSL renewal script
```

## 🛠️ Services với Auto Setup

| Service | Container | Port | Mô tả |
|---------|-----------|------|-------|
| **ssl-init** | vphone-ssl-init | - | 🔐 Tự động tạo SSL certificates |
| **nginx** | vphone-nginx | 80:80, 443:443 | 🌐 Reverse proxy với SSL |
| **frontend** | vphone-frontend | 3000:80 | ⚛️ React app (Vite) |
| **backend** | vphone-backend | 4000:4000 | 🚀 Node.js API + Auto admin |
| **mongodb** | vphone-mongodb | 27017:27017 | 🗄️ MongoDB database |
| **ssl-renewal** | vphone-ssl-renewal | - | 🔄 Auto SSL renewal service |

## ⚙️ Cài đặt và chạy

### 1. 🚀 Auto Setup (Khuyến nghị)

**Cho localhost (development):**
```bash
# Chỉ cần 1 lệnh!
chmod +x docker-start-auto.sh
./docker-start-auto.sh
```

**Cho domain thật (production):**
```bash
# Cập nhật domain và email
cp env.example .env
nano .env  # Sửa DOMAIN và SSL_EMAIL

# Khởi động với auto SSL
./docker-start-auto.sh
```

### 2. 🛠️ Manual Setup (Nâng cao)

```bash
# Tạo file .env từ mẫu
cp env.example .env
nano .env  # Chỉnh sửa cấu hình

# Khởi động thủ công
chmod +x docker-start.sh
./docker-start.sh start
```

### 3. Khởi động thủ công

```bash
# Build và khởi động
docker compose up -d --build

# Chỉ khởi động (nếu đã build)
docker compose up -d

# Xem logs
docker compose logs -f
```

## 🔧 Quản lý Docker

### Script quản lý `docker-start.sh`

```bash
./docker-start.sh start          # Khởi động tất cả services
./docker-start.sh stop           # Dừng tất cả services  
./docker-start.sh restart        # Khởi động lại
./docker-start.sh build          # Build lại images
./docker-start.sh logs           # Xem logs tất cả
./docker-start.sh logs backend   # Xem logs backend
./docker-start.sh status         # Kiểm tra trạng thái
```

### Lệnh Docker Compose thủ công

```bash
# Kiểm tra trạng thái
docker compose ps

# Xem logs
docker compose logs -f [service_name]

# Dừng services
docker compose down

# Dừng và xóa volumes
docker compose down -v

# Build lại một service
docker compose build [service_name]

# Khởi động lại một service
docker compose restart [service_name]
```

## 🌐 Truy cập ứng dụng

### 🏠 Localhost (Development)
- **Web App**: http://localhost
- **API**: http://localhost/api

### 🌍 Domain thật (Production)
- **Web App**: https://yourdomain.com
- **API**: https://yourdomain.com/api
- **HTTP**: http://yourdomain.com (tự động redirect HTTPS)

### 👤 Admin mặc định
- **Email**: admin@vphone.vn
- **Username**: admin  
- **Password**: 123456

*(Chỉ tạo nếu database trống)*

## 🔒 Biến môi trường

Chỉnh sửa file `.env` cho production:

```env
# Domain Configuration (QUAN TRỌNG cho SSL)
DOMAIN=yourdomain.com
SSL_EMAIL=admin@yourdomain.com

# MongoDB Configuration  
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=your-secure-password
MONGO_DB_NAME=vphone

# JWT Secret (Thay đổi trong production!)
JWT_SECRET=your-super-secret-jwt-key

# Email Configuration (Tùy chọn)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

### 🔧 Cấu hình SSL

**Localhost**: Tự động dùng self-signed certificate
**Domain thật**: Tự động tạo Let's Encrypt certificate

```env
# Cho localhost (mặc định)
DOMAIN=localhost

# Cho production
DOMAIN=app.vphone.vn
SSL_EMAIL=admin@vphone.vn
```

## 🏥 Health Checks

Tất cả services đều có health check:

```bash
# Kiểm tra health của tất cả services
curl http://localhost:8080/health   # Nginx
curl http://localhost:3001/health   # Frontend
curl http://localhost:4001/api/health # Backend

# Kiểm tra MongoDB
docker compose exec mongodb mongosh --eval "db.adminCommand('ping')"
```

## 📊 Monitoring

### Xem logs realtime

```bash
# Tất cả services
docker compose logs -f

# Chỉ backend
docker compose logs -f backend

# Chỉ frontend
docker compose logs -f frontend

# Chỉ nginx
docker compose logs -f nginx
```

### Kiểm tra resource usage

```bash
# Xem tài nguyên sử dụng
docker stats

# Xem thông tin containers
docker compose ps -a
```

## 🔧 Troubleshooting

### Lỗi thường gặp

1. **Port đã được sử dụng**
   ```bash
   # Kiểm tra port đang sử dụng
   lsof -i :8080   # Nginx
   lsof -i :3001   # Frontend
   lsof -i :4001   # Backend
   lsof -i :27018  # MongoDB
   ```

2. **MongoDB không khởi động được**
   ```bash
   # Xem logs MongoDB
   docker compose logs mongodb
   
   # Xóa volume và tạo lại
   docker compose down -v
   docker compose up -d
   ```

3. **Backend không kết nối được MongoDB**
   ```bash
   # Kiểm tra network
   docker network ls
   docker network inspect vphone_vphone-network
   ```

4. **Frontend không build được**
   ```bash
   # Build lại frontend
   docker compose build frontend --no-cache
   ```

### Reset hoàn toàn

```bash
# Dừng và xóa tất cả
docker compose down -v --remove-orphans

# Xóa images (nếu cần)
docker rmi vphone-backend vphone-frontend

# Khởi động lại
./docker-start.sh build
./docker-start.sh start
```

## 🚀 Production Deployment

### 1. Cấu hình SSL

Uncomment phần HTTPS trong `nginx/nginx.conf` và thêm SSL certificates:

```bash
mkdir ssl
# Copy SSL certificates vào thư mục ssl/
```

### 2. Cấu hình domain

Chỉnh sửa `nginx/nginx.conf`:

```nginx
server_name your-domain.com;
```

### 3. Environment variables

Đảm bảo các biến môi trường production được cấu hình đúng trong `.env`.

### 4. Backup

```bash
# Backup MongoDB data
docker compose exec mongodb mongodump --out /data/backup

# Backup volumes
docker run --rm -v vphone_mongodb_data:/data -v $(pwd):/backup alpine tar czf /backup/mongodb_backup.tar.gz /data
```

## 📝 Notes

- Tất cả containers chạy với non-root user để bảo mật
- MongoDB data được lưu trong named volume `mongodb_data`
- Nginx logs được lưu trong named volume `nginx_logs`
- Backend logs được lưu trong named volume `backend_logs`
- Network `vphone-network` được tạo để các services giao tiếp với nhau
- Health checks được cấu hình cho tất cả services
- Rate limiting được áp dụng cho API endpoints 