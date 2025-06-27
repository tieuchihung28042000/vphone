# VPhone Inventory Management System

Hệ thống quản lý kho iPhone đơn giản cho domain `app.vphone.vn`

## 🚀 Deploy Nhanh

### Chế độ tự động (khuyến nghị)
```bash
./deploy-app.sh auto
```

### Chế độ interactive
```bash
./deploy-app.sh
```

## 📋 Cấu trúc hệ thống

- **Domain**: app.vphone.vn
- **Database**: MongoDB với 6 admin accounts và 368 sản phẩm iPhone
- **Backend**: Node.js API (port 4000)
- **Frontend**: React SPA (port 80)
- **Nginx**: Reverse proxy (port 8080)

## 🔧 Cấu hình

### Local Development
- Frontend: http://localhost:8080
- Backend API: http://localhost:4000
- MongoDB: localhost:27017

### Production
- Website: http://app.vphone.vn
- API: http://app.vphone.vn/api

## 📊 Dữ liệu

- **6 Admin accounts** (bao gồm admin@vphone.com)
- **368 iPhone products**
- **4 Users**
- **3 Categories**
- **2 Branches**

## 🛠️ Lệnh hữu ích

```bash
# Xem logs
docker-compose logs -f

# Restart services
docker-compose restart

# Dọn dẹp hoàn toàn
./deploy-app.sh
# Chọn option 1

# Kiểm tra sức khỏe
./deploy-app.sh  
# Chọn option 4
```

## 🌐 Cài đặt trên VPS

1. Upload code lên VPS
2. Chạy script deploy:
```bash
./deploy-app.sh
# Chọn option 7 (Deploy hoàn chỉnh)
# Chọn option 6 (Cài đặt nginx VPS)
```

3. Trỏ DNS `app.vphone.vn` về IP VPS

## 📁 Files quan trọng

- `docker-compose.yml` - Cấu hình Docker duy nhất
- `nginx.conf` - Cấu hình Nginx
- `deploy-app.sh` - Script deploy chính
- `scripts/restore-vphone-complete.sh` - Script khôi phục dữ liệu 