# Hướng dẫn Kiểm tra Tính năng - Dành cho Khách hàng

## 📋 Danh sách Kiểm tra

### 1. Phiếu thu chi (Sổ quỹ)

#### ✅ Kiểm tra Checkbox "Tính vào hoạt động kinh doanh"
1. Vào menu **💰 Sổ quỹ**
2. Trong form thêm giao dịch, tìm checkbox có nhãn: **"Tính vào hoạt động kinh doanh (lợi nhuận)"**
3. **Test**: 
   - Tạo giao dịch thu với checkbox **ĐƯỢC TÍCH** → Kiểm tra trong Báo cáo có tính vào lợi nhuận
   - Tạo giao dịch thu với checkbox **KHÔNG TÍCH** → Kiểm tra trong Báo cáo không tính vào lợi nhuận, nhưng số quỹ vẫn tăng

#### ✅ Kiểm tra Quản lý Mô tả giao dịch
1. Trong form thêm giao dịch, click nút **"📝 Quản lý mô tả"**
2. Modal sẽ mở ra với form thêm mô tả
3. **Test**:
   - Nhập mô tả mới (ví dụ: "Chi phí điện nước")
   - Chọn loại: Thu tiền / Chi tiền / Tất cả
   - Click **"➕ Thêm mới"** → Mô tả sẽ xuất hiện trong dropdown
   - Xóa mô tả bằng cách click nút xóa trong danh sách

#### ✅ Kiểm tra Lọc theo nội dung (mô tả)
1. Trong phần **"🔍 Tìm kiếm & Lọc dữ liệu"**, tìm dropdown **"Lọc theo nội dung (mô tả)"**
2. Click nút **"🔄 Nạp gợi ý"** để load danh sách mô tả
3. **Test**:
   - Chọn một mô tả từ dropdown (ví dụ: "Bán hàng")
   - Bảng sẽ chỉ hiển thị các giao dịch có mô tả khớp
   - Kiểm tra tổng thu/chi chỉ tính các giao dịch đã lọc

#### ✅ Kiểm tra Tổng số tiền thu/chi sau khi lọc
1. Sau khi áp dụng bất kỳ filter nào (loại, nguồn, nội dung, thời gian)
2. **Kiểm tra**: Phía trên bảng danh sách sẽ hiển thị 3 ô:
   - **📊 Tổng thu (theo filter)** - Tổng số tiền thu trong kết quả lọc
   - **📉 Tổng chi (theo filter)** - Tổng số tiền chi trong kết quả lọc
   - **💰 Số dư (theo filter)** - Chênh lệch thu - chi
3. **Test**:
   - Lọc theo loại "Thu" → Chỉ thấy Tổng thu, Tổng chi = 0
   - Lọc theo loại "Chi" → Chỉ thấy Tổng chi, Tổng thu = 0
   - Lọc theo nội dung → Tổng thu/chi chỉ tính các giao dịch khớp

---

### 2. Báo cáo

#### ✅ Kiểm tra Giá vốn
1. Vào menu **📊 Báo cáo**
2. **Kiểm tra**: Có một card màu **vàng** hiển thị **"Giá vốn"**
3. Giá trị này = Tổng (Giá nhập × Số lượng) của tất cả sản phẩm đã xuất

#### ✅ Kiểm tra Lợi nhuận gộp
1. Trong trang Báo cáo, tìm card màu **xanh dương** hiển thị **"Lợi nhuận gộp"**
2. **Kiểm tra**: Lợi nhuận gộp = Doanh thu thuần - Giá vốn
3. Công thức: Nếu Doanh thu thuần = 10 triệu, Giá vốn = 7 triệu → Lợi nhuận gộp = 3 triệu

#### ✅ Kiểm tra Xuất Excel
1. Trong trang Báo cáo, click nút **"📊 Xuất Excel"**
2. File Excel sẽ được tải về với tên: `baocao_taichinh_{ngày_bắt_đầu}_{ngày_kết_thúc}.xlsx`
3. **Kiểm tra file Excel**:
   - Mở file Excel
   - Kiểm tra có đầy đủ các cột:
     - Tổng doanh thu bán hàng
     - Tổng doanh thu trả hàng
     - Doanh thu thuần
     - **Giá vốn** ← Phải có
     - **Lợi nhuận gộp** ← Phải có
     - Tổng chi phí
     - Thu nhập khác
     - Lợi nhuận thuần

#### ✅ Kiểm tra Thu ngân chỉ xem chi nhánh của mình
1. Đăng nhập với tài khoản có role **"Thu ngân"**
2. Vào menu **📊 Báo cáo**
3. **Kiểm tra**:
   - Dropdown "Chi nhánh" bị **disable** (không thể chọn)
   - Tự động hiển thị chi nhánh của thu ngân
   - Có thông báo: "(Chỉ xem báo cáo chi nhánh: {tên chi nhánh})"
   - Báo cáo chỉ hiển thị dữ liệu của chi nhánh đó

---

### 3. Nhập hàng

#### ✅ Kiểm tra Tên "Giá Trị Kho"
1. Vào menu **📥 Nhập hàng**
2. **Kiểm tra**: Tìm card thống kê có tên **"Giá Trị Kho"** (không phải "Giá trị nhập còn lại")

---

### 4. Công nợ - Khách nợ mình

#### ✅ Kiểm tra Hiển thị mô tả trong lịch sử
1. Vào menu **💳 Công nợ** → Tab **"Khách nợ mình"**
2. Click vào một khách hàng để xem **Lịch sử**
3. **Kiểm tra**: Bảng lịch sử có cột **"Mô tả"** hiển thị ghi chú của từng giao dịch

#### ✅ Kiểm tra Trường "Ngày nợ"
1. Trong bảng danh sách công nợ khách hàng
2. **Kiểm tra**: Có cột **"Ngày nợ"** hiển thị số ngày từ ngày nợ đến hiện tại
3. Ví dụ: "15 ngày", "30 ngày"

#### ✅ Kiểm tra Tìm kiếm (không xoay khi nhập 1 ký tự)
1. Trong ô tìm kiếm, nhập **1 ký tự** (ví dụ: "N")
2. **Kiểm tra**: 
   - Không có icon loading xoay ngay lập tức
   - Chờ khoảng 0.5-1 giây sau khi ngừng gõ mới tìm kiếm
   - Có thể tiếp tục gõ mà không bị gián đoạn

#### ✅ Kiểm tra Tìm theo SĐT hoặc Tên
1. Trong ô tìm kiếm, nhập **số điện thoại** (ví dụ: "0123")
2. **Kiểm tra**: Kết quả hiển thị khách hàng có SĐT chứa "0123"
3. Xóa và nhập **tên khách hàng** (ví dụ: "Nguyễn")
4. **Kiểm tra**: Kết quả hiển thị khách hàng có tên chứa "Nguyễn"

---

### 5. Công nợ - Mình nợ nhà cung cấp

#### ✅ Kiểm tra Trả nợ
1. Vào menu **💳 Công nợ** → Tab **"Mình nợ nhà cung cấp"**
2. Chọn một nhà cung cấp có công nợ
3. Click nút **"Trả nợ"** hoặc **"Thanh toán"**
4. Nhập số tiền và click xác nhận
5. **Kiểm tra**: 
   - Giao dịch trả nợ được tạo thành công
   - Số công nợ của nhà cung cấp giảm đúng số tiền đã trả
   - Trong Sổ quỹ có giao dịch chi tương ứng

#### ✅ Kiểm tra Tìm kiếm (không xoay khi nhập 1 ký tự)
1. Trong ô tìm kiếm nhà cung cấp, nhập **1 ký tự**
2. **Kiểm tra**: Không có icon loading xoay ngay lập tức, chờ sau khi ngừng gõ

---

### 6. Chốt xuất hàng

#### ✅ Kiểm tra Ẩn giá nhập cho nhân viên
1. Đăng nhập với tài khoản có role **"Nhân viên bán hàng"**
2. Vào menu **📤 Xuất hàng**
3. **Kiểm tra**:
   - Trong bảng danh sách xuất hàng: **KHÔNG có** cột "Giá nhập"
   - Trong dropdown chọn sản phẩm: **KHÔNG hiển thị** giá nhập
   - Trong suggestions: **KHÔNG hiển thị** giá nhập
4. **Đăng nhập với Admin** để kiểm tra ngược lại:
   - Admin sẽ thấy cột "Giá nhập" và giá nhập trong suggestions

---

### 7. Phân quyền User

#### ✅ Kiểm tra Admin tổng thấy hết
1. Đăng nhập với tài khoản **Admin tổng** (không có branch_id)
2. **Kiểm tra**:
   - Có thể chọn tất cả chi nhánh trong dropdown
   - Xem được dữ liệu của tất cả chi nhánh
   - Không bị giới hạn bởi chi nhánh nào

#### ✅ Kiểm tra Admin chi nhánh chỉ thấy chi nhánh đó
1. Đăng nhập với tài khoản **Admin chi nhánh** (có branch_id)
2. **Kiểm tra**:
   - Dropdown chi nhánh chỉ hiển thị chi nhánh của admin
   - Chỉ xem được dữ liệu của chi nhánh đó
   - Không thể chọn chi nhánh khác

#### ✅ Kiểm tra Nhân viên chỉ xem xuất hàng chi nhánh đó
1. Đăng nhập với tài khoản **Nhân viên bán hàng**
2. Vào menu **📤 Xuất hàng**
3. **Kiểm tra**:
   - Dropdown "Chi nhánh" bị **disable** (không thể chọn)
   - Tự động set chi nhánh của nhân viên
   - Chỉ thấy danh sách xuất hàng của chi nhánh đó
   - Không thể chọn chi nhánh khác

#### ✅ Kiểm tra Thu ngân chỉ xem báo cáo chi nhánh đó
1. Đăng nhập với tài khoản **Thu ngân**
2. Vào menu **📊 Báo cáo**
3. **Kiểm tra**:
   - Dropdown "Chi nhánh" bị **disable**
   - Tự động hiển thị chi nhánh của thu ngân
   - Báo cáo chỉ hiển thị dữ liệu của chi nhánh đó
   - Không thể chọn chi nhánh khác

---

## 🎯 Checklist Tổng hợp

Đánh dấu ✅ sau khi kiểm tra từng mục:

### Phiếu thu chi
- [ ] Checkbox "Tính vào hoạt động kinh doanh" hoạt động đúng
- [ ] Quản lý mô tả: Thêm/xóa mô tả thành công
- [ ] Lọc theo nội dung (mô tả) hoạt động đúng
- [ ] Tổng thu/chi hiển thị đúng sau khi lọc

### Báo cáo
- [ ] Giá vốn hiển thị đúng
- [ ] Lợi nhuận gộp = Doanh thu thuần - Giá vốn
- [ ] Xuất Excel có đầy đủ: Giá vốn và Lợi nhuận gộp
- [ ] Thu ngân chỉ xem được chi nhánh của mình

### Nhập hàng
- [ ] Tên "Giá Trị Kho" đã được đổi

### Công nợ - Khách nợ mình
- [ ] Lịch sử hiển thị mô tả
- [ ] Có cột "Ngày nợ"
- [ ] Tìm kiếm không xoay khi nhập 1 ký tự
- [ ] Tìm được theo SĐT và tên

### Công nợ - Mình nợ nhà cung cấp
- [ ] Trả nợ thành công
- [ ] Tìm kiếm không xoay khi nhập 1 ký tự

### Chốt xuất hàng
- [ ] Nhân viên không thấy giá nhập
- [ ] Admin vẫn thấy giá nhập

### Phân quyền
- [ ] Admin tổng thấy hết
- [ ] Admin chi nhánh chỉ thấy chi nhánh đó
- [ ] Nhân viên chỉ xem xuất hàng chi nhánh đó
- [ ] Thu ngân chỉ xem báo cáo chi nhánh đó

---

## 📞 Hỗ trợ

Nếu phát hiện bất kỳ vấn đề nào trong quá trình kiểm tra, vui lòng:
1. Ghi lại màn hình (screenshot)
2. Mô tả chi tiết các bước thực hiện
3. Liên hệ đội kỹ thuật để được hỗ trợ

---

**Chúc bạn kiểm tra thành công!** ✅

