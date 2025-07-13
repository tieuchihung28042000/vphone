# 🔧 SỬA THỦ CÔNG TRÊN VPS

## 🚨 Vấn đề: Git history không đồng bộ

VPS không có commit `f47bf41` chứa fix username null. Cần sửa thủ công.

## 🛠️ GIẢI PHÁP THỦ CÔNG

### **Bước 1: SSH vào VPS**
```bash
ssh your-user@your-vps
cd ~/sites/nguyenkieuanh.com
```

### **Bước 2: Sửa file backend/routes/auth.js**
```bash
nano backend/routes/auth.js
```

**Tìm dòng ~54:**
```javascript
username: username || null,
```

**Thay thành:**
```javascript
username: (username && username.trim()) ? username.trim() : null, // Xử lý empty string và spaces
```

### **Bước 3: Sửa file iphone-inventory/src/pages/QuanLyUser.jsx**
```bash
nano iphone-inventory/src/pages/QuanLyUser.jsx
```

**Tìm dòng ~17:**
```javascript
username: "",
```

**Thay thành:**
```javascript
username: null, // Thay đổi từ "" thành null
```

**Tìm dòng ~147:**
```javascript
username: "",
```

**Thay thành:**
```javascript
username: null, // Thay đổi từ "" thành null
```

**Thêm input username vào form (sau dòng password input ~480):**
```javascript
<div>
  <label className="block text-sm font-semibold text-gray-700 mb-2">Username (tùy chọn)</label>
  <input
    type="text"
    value={createUserForm.username || ""}
    onChange={(e) => setCreateUserForm({...createUserForm, username: e.target.value || null})}
    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
    placeholder="Để trống nếu không cần username"
  />
</div>
```

### **Bước 4: Rebuild containers**
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### **Bước 5: Test**
```bash
curl -X POST https://nguyenkieuanh.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser'$(date +%s)'@vphone.com",
    "password": "123456",
    "full_name": "Test User",
    "role": "admin",
    "branch_id": "686783939535a971dfe22f4f"
  }'
```

## 🎯 Kết quả mong đợi

**Thành công:**
```json
{"message":"✅ Tạo tài khoản thành công"}
```

**Thất bại (trước khi fix):**
```json
{"message":"❌ Lỗi server","error":"E11000 duplicate key error collection: nguyenkieuanh.users index: username_1 dup key: { username: null }"}
```

## 🔍 Kiểm tra sau khi sửa

### **1. Kiểm tra file đã sửa:**
```bash
grep -n "username.*trim" backend/routes/auth.js
# Should show: username: (username && username.trim()) ? username.trim() : null
```

### **2. Kiểm tra container logs:**
```bash
docker logs vphone-backend --tail 20
# Should show successful startup without errors
```

### **3. Test trả hàng:**
```bash
curl -X GET https://nguyenkieuanh.com/api/return-export
# Should show: {"message":"Access token required"} (not 404)
```

## 🚀 Sau khi fix thành công

- ✅ Tạo user không lỗi username null
- ✅ Tính năng trả hàng hoạt động
- ✅ Phân quyền áp dụng đúng
- ✅ Tab "Tất cả user" hiển thị mặc định

---
*Nếu vẫn gặp vấn đề, hãy gửi kết quả của các lệnh test ở trên.* 