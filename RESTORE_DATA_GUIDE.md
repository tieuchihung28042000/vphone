# 🔄 HƯỚNG DẪN KHÔI PHỤC DỮ LIỆU VPHONE

## 📋 Yêu cầu trước khi thực hiện
- Quyền sudo trên VPS
- MongoDB đã được cài đặt
- Dừng ứng dụng đang chạy

## 🚀 Các bước thực hiện

### Bước 1: Dừng ứng dụng
```bash
# Dừng PM2 processes
pm2 stop all

# Hoặc dừng service nếu chạy bằng systemd
sudo systemctl stop vphone
```

### Bước 2: Backup dữ liệu hiện tại (khuyến nghị)
```bash
# Tạo thư mục backup với timestamp
mkdir -p ~/backup/$(date +%Y%m%d_%H%M%S)

# Backup database hiện tại
mongodump --db vphone --out ~/backup/$(date +%Y%m%d_%H%M%S)/current_backup
```

### Bước 3: Xóa database cũ
```bash
# Kết nối MongoDB
mongo vphone

# Trong MongoDB shell:
use vphone
db.dropDatabase()
exit
```

### Bước 4: Khôi phục từ backup
```bash
# Di chuyển đến thư mục chứa backup
cd /path/to/vphone/mongodb-data/vphone-complete-backup

# Khôi phục database
mongorestore --db vphone ./vphone/

# Hoặc nếu có script restore
chmod +x /path/to/vphone/scripts/restore-vphone-complete.sh
./scripts/restore-vphone-complete.sh
```

### Bước 5: Kiểm tra dữ liệu
```bash
# Kết nối MongoDB để kiểm tra
mongo vphone

# Trong MongoDB shell:
use vphone
show collections
db.inventories.countDocuments()
db.admins.countDocuments()
db.branches.countDocuments()
exit
```

### Bước 6: Khăi động lại ứng dụng
```bash
# Khởi động PM2
pm2 start all

# Hoặc systemd
sudo systemctl start vphone

# Kiểm tra status
pm2 status
# hoặc
sudo systemctl status vphone
```

## 🔍 Kiểm tra sau khi khôi phục

### Kiểm tra API
```bash
# Test API cơ bản
curl http://localhost:3000/api/ton-kho
curl http://localhost:3000/api/nhap-hang
```

### Kiểm tra giao diện
- Truy cập website
- Đăng nhập tài khoản admin
- Kiểm tra dữ liệu ngày 26/6 đã có chưa

## 📊 Xác minh dữ liệu ngày 26/6
```bash
# Trong MongoDB shell
mongo vphone
use vphone

# Kiểm tra dữ liệu nhập hàng ngày 26/6
db.inventories.find({
  "import_date": {
    $gte: new Date("2024-06-26T00:00:00.000Z"),
    $lt: new Date("2024-06-27T00:00:00.000Z")
  }
}).count()

# Kiểm tra dữ liệu xuất hàng ngày 26/6
db.inventories.find({
  "sold_date": {
    $gte: new Date("2024-06-26T00:00:00.000Z"),
    $lt: new Date("2024-06-27T00:00:00.000Z")
  }
}).count()
```

## ⚠️ Lưu ý quan trọng
1. **Backup trước khi restore**: Luôn tạo backup dữ liệu hiện tại
2. **Đường dẫn**: Thay đổi `/path/to/vphone` thành đường dẫn thực tế
3. **Permissions**: Đảm bảo MongoDB có quyền đọc/ghi trên thư mục backup
4. **Service name**: Thay đổi tên service nếu khác `vphone`

## 🆘 Nếu có vấn đề
1. Khôi phục lại backup hiện tại đã tạo ở Bước 2
2. Kiểm tra log MongoDB: `tail -f /var/log/mongodb/mongod.log`
3. Kiểm tra log ứng dụng: `pm2 logs`

## 📞 Liên hệ hỗ trợ
Nếu gặp vấn đề trong quá trình khôi phục, vui lòng cung cấp:
- Error message cụ thể
- Log files
- Trạng thái hiện tại của database 