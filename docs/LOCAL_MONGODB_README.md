# 🏠 Hướng dẫn sử dụng Local MongoDB cho VPhone

## ✅ Đã hoàn thành
- ✅ Cài đặt MongoDB Community Edition 8.0
- ✅ Export toàn bộ dữ liệu từ Cloud MongoDB (368 sản phẩm)
- ✅ Import thành công vào Local MongoDB
- ✅ Tạo các scripts tự động hóa

## 📊 Dữ liệu đã migrate
- **368 inventories** (sản phẩm kho hàng)
- **4 users** (tài khoản người dùng)
- **5 admins** (tài khoản quản trị)
- **2 branches** (chi nhánh)
- **3 categories** (danh mục)

## 🔧 Cách sử dụng

### 1. Cập nhật file .env
Sửa file `backend/.env`:
```env
# Thay đổi từ Cloud MongoDB
MONGODB_URI=mongodb://localhost:27017/vphone
```

### 2. Khởi động hệ thống
```bash
# Khởi động MongoDB + kiểm tra dữ liệu
./start-local-mongodb.sh

# Khởi động backend
cd backend && npm start

# Khởi động frontend
cd iphone-inventory && npm run dev
```

### 3. Quản lý MongoDB
```bash
# Khởi động MongoDB
brew services start mongodb/brew/mongodb-community

# Dừng MongoDB
brew services stop mongodb/brew/mongodb-community

# Kết nối với mongosh
mongosh "mongodb://localhost:27017/test"
```

## 💰 Lợi ích
- ⚡ **Tốc độ nhanh hơn** (không cần internet)
- 💵 **Tiết kiệm chi phí** (không thuê cloud)
- 🔒 **Bảo mật cao hơn** (dữ liệu nằm local)
- 🛠️ **Dễ debug** và phát triển

## 🔄 Backup & Restore
```bash
# Export dữ liệu (nếu cần backup)
./export-mongodb-data.sh

# Import dữ liệu (nếu cần restore)
./import-mongodb-data.sh
```

## 🗂️ Files được tạo
- `export-mongodb-data.sh` - Script export từ cloud
- `import-mongodb-data.sh` - Script import vào local
- `start-local-mongodb.sh` - Script khởi động nhanh
- `backend/.env.cloud.backup` - Backup cấu hình cloud
- `mongodb_backup/` - Thư mục chứa backup data

## ⚠️ Lưu ý
- MongoDB sẽ tự khởi động khi máy boot
- Dữ liệu được lưu tại `/opt/homebrew/var/mongodb/`
- Nếu gặp lỗi, hãy kiểm tra MongoDB có đang chạy không 