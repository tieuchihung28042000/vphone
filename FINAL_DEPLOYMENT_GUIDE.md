# 🚀 HƯỚNG DẪN DEPLOY CUỐI CÙNG

## 📋 Tình trạng hiện tại

### ✅ **Đã hoàn thành:**
- ✅ Sửa lỗi username null trong frontend và backend
- ✅ Thêm input username vào form tạo user
- ✅ Cập nhật phân quyền hoàn chỉnh
- ✅ Tab mặc định Quản lý User = "Tất cả user"
- ✅ Return functionality routes đã sẵn sàng

### ❌ **Vấn đề hiện tại:**
- ❌ Code chưa được deploy lên VPS
- ❌ Vẫn lỗi username null khi tạo user
- ❌ Return functionality chưa hoạt động

## 🔧 CÁCH DEPLOY

### **Bước 1: SSH vào VPS**
```bash
ssh your-user@your-vps-ip
```

### **Bước 2: Đi đến thư mục project**
```bash
cd ~/sites/nguyenkieuanh.com
```

### **Bước 3: Pull code mới nhất**
```bash
git pull origin main
```

### **Bước 4: Kiểm tra code đã được pull**
```bash
git log --oneline -3
# Phải thấy commit: "Add: Scripts debug và test return với authentication"
```

### **Bước 5: Rebuild containers**
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### **Bước 6: Kiểm tra containers**
```bash
docker ps
docker logs vphone-backend --tail 20
```

### **Bước 7: Test deployment**
```bash
# Test health
curl https://nguyenkieuanh.com/api/health

# Test user creation (should work now)
curl -X POST https://nguyenkieuanh.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser123@vphone.com",
    "password": "123456",
    "full_name": "Test User",
    "role": "admin",
    "branch_id": "686783939535a971dfe22f4f"
  }'

# Test return APIs (should show "Access token required")
curl https://nguyenkieuanh.com/api/return-export
curl https://nguyenkieuanh.com/api/return-import
```

## 🎯 KẾT QUẢ MONG ĐỢI

### **API Tests:**
- ✅ `/api/health` → Status healthy
- ✅ `/api/auth/register` → Tạo user thành công (không lỗi username null)
- ✅ `/api/return-export` → "Access token required" (không phải 404)
- ✅ `/api/return-import` → "Access token required" (không phải 404)

### **Frontend:**
- ✅ Tạo user không lỗi username null
- ✅ Tab "Tất cả user" hiển thị mặc định
- ✅ Nhân viên bán hàng chỉ thấy menu "Xuất hàng"
- ✅ Thu ngân thấy "Xuất hàng" + "Công nợ"
- ✅ Admin/Quản lý thấy tất cả menu
- ✅ Tính năng trả hàng hoạt động

## 📊 PHÂN QUYỀN CUỐI CÙNG

| Chức năng | Admin | Quản lý | Thu ngân | Nhân viên bán hàng |
|-----------|-------|---------|----------|-------------------|
| Nhập hàng | ✅ | ✅ | ❌ | ❌ |
| Xuất hàng | ✅ | ✅ | ✅ | ✅ |
| Tồn kho | ✅ | ✅ | ❌ | ❌ |
| Sổ quỹ | ✅ | ✅ | ❌ | ❌ |
| Công nợ | ✅ | ✅ | ✅ | ❌ |
| Báo cáo | ✅ | ✅ | ❌ | ❌ |
| Quản lý User | ✅ | ✅ | ❌ | ❌ |

## 🚨 NẾU VẪN LỖI

### **Kiểm tra git pull:**
```bash
git status
git log --oneline -1
# Phải thấy commit mới nhất
```

### **Kiểm tra build:**
```bash
docker-compose build --no-cache --progress=plain
# Xem quá trình build có lỗi không
```

### **Kiểm tra logs:**
```bash
docker logs vphone-backend --tail 50
# Tìm lỗi trong logs
```

### **Hard reset (nếu cần):**
```bash
docker system prune -a
docker-compose down --volumes
docker-compose build --no-cache
docker-compose up -d
```

## 📞 HỖ TRỢ

Nếu vẫn gặp lỗi, hãy gửi kết quả của:
1. `git log --oneline -3`
2. `docker ps`
3. `docker logs vphone-backend --tail 20`
4. `curl https://nguyenkieuanh.com/api/health`

---
*Cập nhật: 2025-07-13 20:30* 