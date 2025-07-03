# VPhone Native Setup

Hướng dẫn setup VPhone với MongoDB và Nginx chạy native (không dùng Docker).

## Cấu trúc mới

- **MongoDB**: Chạy native trên hệ thống
- **Nginx**: Chạy native trên hệ thống  
- **Backend**: Chạy trong Docker container
- **Frontend**: Chạy trong Docker container

## Cách sử dụng

### 1. Sửa lỗi repositories (nếu cần)

```bash
# Sửa lỗi repositories Ubuntu (cloudflare, etc.)
./scripts/fix-repositories.sh
```

### 2. Setup MongoDB

```bash
# Cài đặt MongoDB và tạo database với tên mặc định
./scripts/setup-mongodb.sh

# Hoặc cài đặt với tên database tùy chỉnh
./scripts/setup-mongodb.sh my_database
```

### 3. Setup Nginx

```bash
# Cài đặt Nginx với localhost
./scripts/setup-nginx.sh

# Hoặc cài đặt với domain tùy chỉnh
./scripts/setup-nginx.sh nguyenkieuanh.com
```

### 4. Khởi động Docker services

```bash
# Khởi động backend và frontend
docker-compose up -d
```

### 5. Kiểm tra database

```bash
# Kiểm tra database mặc định
./scripts/check-database.sh

# Kiểm tra database tùy chỉnh
./scripts/check-database.sh my_database
```

## Thông tin kết nối

- **MongoDB**: localhost:27017
- **Admin User**: admin
- **Admin Password**: 12345
- **Database**: vphone_production (mặc định)
- **Nginx**: localhost:80
- **Backend**: localhost:4000 (qua Docker)
- **Frontend**: localhost:3000 (qua Docker)

## Truy cập ứng dụng

- Website: http://localhost (hoặc domain đã cấu hình)
- API: http://localhost/api
- Health check: http://localhost/health

## Quản lý

```bash
# Xem logs Docker
docker-compose logs -f

# Restart Docker services
docker-compose restart

# Stop Docker services
docker-compose down

# Xem logs MongoDB
tail -f /var/log/mongodb/mongo.log

# Xem logs Nginx
tail -f /var/log/nginx/vphone_access.log
``` 