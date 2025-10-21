# Cải tiến hệ thống ghi nhận hoạt động (Activity Log)

## Tổng quan

Đã cải tiến hệ thống ghi nhận hoạt động để có mô tả chi tiết hơn bằng tiếng Việt theo chuẩn nghiệp vụ, giúp dễ dàng theo dõi và quản lý các hoạt động trong hệ thống.

## Các cải tiến chính

### 1. Cải tiến hàm `createDetailedDescription`

**File:** `backend/routes/activityLogs.js`

**Thay đổi:**
- Tạo mô tả chi tiết theo format: "Nhân viên [Tên] ([Vai trò]) [Hành động] [Chi tiết]"
- Thêm thông tin mã phiếu/đơn hàng (#code)
- Bao gồm thông tin sản phẩm, khách hàng, nhà cung cấp
- Hiển thị số tiền theo định dạng tiền tệ Việt Nam
- Thêm lý do, ghi chú khi có

**Ví dụ mô tả mới:**
```
Nhân viên admin@vphone.vn (Admin) tạo phiếu thu #PT20250121001 - Nội dung: Thu tiền bán hàng - Số tiền: 15.000.000đ - Khách hàng: Nguyễn Văn A - Số dư sau: 50.000.000đ
```

### 2. Cải tiến ghi nhận hoạt động trong các routes

#### A. Route Cashbook (`backend/routes/cashbook.js`)

**Cải tiến:**
- Lưu thông tin chi tiết trong `payload_snapshot` thay vì toàn bộ object
- Bao gồm: `receipt_code`, `type`, `content`, `amount`, `customer`, `supplier`, `balance_after`
- Sử dụng `receipt_code` làm `ref_id` thay vì `_id`

**Các thao tác được ghi nhận:**
- ✅ Tạo phiếu thu/chi
- ✅ Cập nhật phiếu thu/chi  
- ✅ Xóa phiếu thu/chi

#### B. Route Return Import (`backend/routes/returnImport.js`)

**Cải tiến:**
- Lưu thông tin: `return_code`, `product_name`, `imei`, `return_amount`, `supplier`, `reason`, `note`, `quantity`
- Sử dụng `return_code` làm `ref_id`

**Các thao tác được ghi nhận:**
- ✅ Tạo phiếu trả hàng nhập
- ✅ Hủy phiếu trả hàng nhập

#### C. Route Return Export (`backend/routes/returnExport.js`)

**Cải tiến:**
- Lưu thông tin: `return_code`, `product_name`, `imei`, `return_amount`, `customer_name`, `customer_phone`, `reason`, `note`, `quantity`
- Sử dụng `return_code` làm `ref_id`

**Các thao tác được ghi nhận:**
- ✅ Tạo phiếu trả hàng bán
- ✅ Hủy phiếu trả hàng bán

#### D. Route User (`backend/routes/user.js`)

**Cải tiến:**
- Thêm import `ActivityLog`
- Ghi nhận các thao tác quản lý user

**Các thao tác được ghi nhận:**
- ✅ Phê duyệt user
- ✅ Cập nhật vai trò user
- ✅ Xóa user

### 3. Mô tả chi tiết cho từng module

#### Cashbook (Sổ quỹ)
```
- Tạo: "Nhân viên [Tên] ([Vai trò]) tạo [phiếu thu/phiếu chi] #[Mã] - Nội dung: [Nội dung] - Số tiền: [Số tiền] - [Khách hàng/Nhà cung cấp]: [Tên] - Số dư sau: [Số dư]"
- Cập nhật: "Nhân viên [Tên] ([Vai trò]) cập nhật phiếu #[Mã] - Nội dung: [Nội dung] - Số tiền từ [Cũ] thành [Mới]"
- Xóa: "Nhân viên [Tên] ([Vai trò]) xóa phiếu sổ quỹ #[Mã] - Nội dung: [Nội dung] - Số tiền: [Số tiền]"
```

#### Return Import (Trả hàng nhập)
```
- Tạo: "Nhân viên [Tên] ([Vai trò]) tạo phiếu trả hàng nhập #[Mã] - Sản phẩm: [Tên] (IMEI: [IMEI]) - Số tiền hoàn: [Số tiền] - Nhà cung cấp: [Tên] - Lý do: [Lý do]"
- Hủy: "Nhân viên [Tên] ([Vai trò]) thao tác với phiếu trả hàng nhập"
```

#### Return Export (Trả hàng bán)
```
- Tạo: "Nhân viên [Tên] ([Vai trò]) tạo phiếu trả hàng bán #[Mã] - Sản phẩm: [Tên] (IMEI: [IMEI]) - Số tiền hoàn: [Số tiền] - Khách hàng: [Tên] - Lý do: [Lý do]"
- Hủy: "Nhân viên [Tên] ([Vai trò]) thao tác với phiếu trả hàng bán"
```

#### User (Quản lý người dùng)
```
- Phê duyệt: "Nhân viên [Tên] ([Vai trò]) cập nhật thông tin tài khoản - Email: [Email] - Họ tên: [Tên]"
- Cập nhật vai trò: "Nhân viên [Tên] ([Vai trò]) cập nhật thông tin tài khoản - Email: [Email] - Họ tên: [Tên]"
- Xóa: "Nhân viên [Tên] ([Vai trò]) xóa tài khoản - Email: [Email]"
```

### 4. Các module được hỗ trợ

- ✅ `cashbook` - Sổ quỹ
- ✅ `return_import` - Trả hàng nhập
- ✅ `return_export` - Trả hàng bán
- ✅ `user` - Quản lý người dùng
- ✅ `nhap_hang` - Nhập hàng (có sẵn)
- ✅ `xuat_hang` - Xuất hàng (có sẵn)
- ✅ `inventory` - Tồn kho (có sẵn)
- ✅ `cong_no` - Công nợ (có sẵn)
- ✅ `category` - Danh mục (có sẵn)
- ✅ `branch` - Chi nhánh (có sẵn)

## Cách sử dụng

### 1. Xem lịch sử hoạt động
Truy cập trang "Lịch sử hoạt động" trong ứng dụng để xem các hoạt động đã được ghi nhận với mô tả chi tiết.

### 2. Lọc và tìm kiếm
- Lọc theo thời gian
- Lọc theo module
- Lọc theo chi nhánh
- Tìm kiếm theo người dùng

### 3. Test hệ thống
Chạy script test để kiểm tra:
```bash
cd backend
node test-activity-log.js
```

## Lợi ích

1. **Mô tả rõ ràng:** Mỗi hoạt động được mô tả chi tiết bằng tiếng Việt
2. **Thông tin đầy đủ:** Bao gồm mã phiếu, tên sản phẩm, số tiền, đối tác
3. **Dễ theo dõi:** Format chuẩn giúp dễ đọc và hiểu
4. **Audit trail:** Ghi nhận đầy đủ các thay đổi để kiểm tra
5. **Bảo mật:** Chỉ admin và thu ngân được xem log

## Cấu trúc dữ liệu

### ActivityLog Schema
```javascript
{
  user_id: ObjectId,
  username: String,
  role: String,
  action: String, // create, update, delete, return, sale, purchase, adjust, other
  module: String, // cashbook, return_import, return_export, user, etc.
  payload_snapshot: Object, // Thông tin chi tiết của hoạt động
  ref_id: String, // Mã phiếu/đơn hàng hoặc ID
  branch: String,
  createdAt: Date
}
```

### Payload Snapshot Examples

**Cashbook:**
```javascript
{
  receipt_code: "PT20250121001",
  type: "thu",
  content: "Thu tiền bán hàng",
  amount: 15000000,
  customer: "Nguyễn Văn A",
  balance_after: 50000000
}
```

**Return Import:**
```javascript
{
  return_code: "TRN20250121001",
  product_name: "iPhone 15 Pro Max",
  imei: "123456789012345",
  return_amount: 25000000,
  supplier: "Apple Vietnam",
  reason: "Lỗi sản phẩm"
}
```

## Kết luận

Hệ thống ghi nhận hoạt động đã được cải tiến đáng kể với mô tả chi tiết bằng tiếng Việt, giúp dễ dàng theo dõi và quản lý các hoạt động trong hệ thống quản lý kho hàng.
