# 👥 Phân quyền hệ thống VPhone

## 🔐 Quyền truy cập theo vai trò

### 👑 **Admin** (Toàn quyền)
- ✅ Nhập hàng
- ✅ Xuất hàng  
- ✅ Tồn kho
- ✅ Sổ quỹ
- ✅ Công nợ
- ✅ Báo cáo
- ✅ Quản lý User

### 👨‍💼 **Quản lý** (Quyền quản lý)
- ✅ Nhập hàng
- ✅ Xuất hàng
- ✅ Tồn kho
- ✅ Sổ quỹ
- ✅ Công nợ
- ✅ Báo cáo
- ✅ Quản lý User

### 💰 **Thu ngân** (Quyền bán hàng + công nợ)
- ❌ Nhập hàng
- ✅ Xuất hàng
- ❌ Tồn kho
- ❌ Sổ quỹ
- ✅ Công nợ
- ❌ Báo cáo
- ❌ Quản lý User

### 🛒 **Nhân viên bán hàng** (Chỉ bán hàng)
- ❌ Nhập hàng
- ✅ Xuất hàng
- ❌ Tồn kho
- ❌ Sổ quỹ
- ❌ Công nợ
- ❌ Báo cáo
- ❌ Quản lý User

## 📋 Lý do phân quyền

### **Nguyên tắc phân quyền:**
1. **Nhân viên bán hàng**: Chỉ cần xuất hàng, không cần biết giá nhập, tồn kho, doanh thu
2. **Thu ngân**: Thêm quyền xem công nợ khách hàng để thu tiền
3. **Quản lý**: Toàn quyền trừ một số chức năng admin-only
4. **Admin**: Toàn quyền hệ thống

### **Bảo mật:**
- Nhân viên không xem được giá nhập → Bảo vệ lợi nhuận
- Thu ngân không xem được sổ quỹ → Tránh rủi ro tài chính
- Chỉ admin/quản lý xem báo cáo → Bảo vệ thông tin kinh doanh

## 🚀 Cách triển khai

### **Frontend (Layout.jsx + App.jsx):**
```javascript
// Menu items với roles
{ id: 'nhap-hang', roles: ['admin', 'quan_ly'] }
{ id: 'xuat-hang', roles: ['admin', 'quan_ly', 'thu_ngan', 'nhan_vien_ban_hang'] }
{ id: 'ton-kho', roles: ['admin', 'quan_ly'] }
{ id: 'so-quy', roles: ['admin', 'quan_ly'] }
{ id: 'cong-no', roles: ['admin', 'quan_ly', 'thu_ngan'] }
{ id: 'bao-cao', roles: ['admin', 'quan_ly'] }
{ id: 'quan-ly-user', roles: ['admin', 'quan_ly'] }
```

### **Backend (Routes):**
```javascript
// Route protection với middleware
router.use(authenticateToken);
router.use(requireRole(['admin', 'quan_ly']));
```

---
*Cập nhật: 2025-07-13* 