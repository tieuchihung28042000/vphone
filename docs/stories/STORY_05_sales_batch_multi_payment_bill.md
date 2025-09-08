## Story 05: Xuất hàng batch, thanh toán đa nguồn, ẩn giá nhập, kênh/nhân viên bán, in bill

### Bối cảnh
Hiện API `POST /api/report/xuat-hang` xử lý từng item. Cần hỗ trợ batch nhiều dòng, ghi `ExportHistory` kèm `batch_id`, thanh toán đa nguồn (ghi sổ nhiều dòng), ẩn giá nhập với role thấp, thêm kênh bán và nhân viên bán, và in bill.

### Phạm vi
- Backend: API mới `POST /api/report/xuat-hang-batch`, field mới trên `ExportHistory` (`batch_id`, `sales_channel`, `salesperson`). Tùy chọn `auto_cashbook`.
- Frontend: UI giỏ hàng xuất 1 lần nhiều dòng; form payments 1-n; trường kênh bán/nhân viên; nút “In bill”.

### Backend
- Endpoint `xuat-hang-batch`:
  - Body: { items: [{imei|sku, product_name, quantity, price_sell, ...}], customer, branch, sold_date, note, payments: [{source, amount}], sales_channel, salesperson, da_thanh_toan, auto_cashbook }.
  - Logic: cập nhật tồn kho từng item; ghi nhiều dòng `ExportHistory` với cùng `batch_id`; nếu `auto_cashbook=true`, tạo nhiều record `Cashbook` type `thu` theo `payments`.
- Ẩn giá nhập: không trả `price_import` về UI cho role không đủ; hoặc frontend không render trường đó.

### Frontend
- Trang Xuất hàng mới dạng bảng nhiều dòng (IMEI + phụ kiện), tổng hợp tiền; phần Payments nhiều nguồn; chọn Kênh bán/ Nhân viên bán (autocomplete từ distinct dữ liệu); nút “Ghi sổ ngay”/“Ghi sổ sau”; nút “In bill”.
- In bill: render phiếu từ response batch (mã phiếu, khách hàng, danh sách hàng, tổng, payments, chi nhánh) và gọi `window.print()` hoặc xuất PDF.

### Acceptance Criteria
- Tạo batch gồm 2-3 sản phẩm; `ExportHistory` sinh nhiều dòng có chung `batch_id`.
- Nếu `auto_cashbook=true`, sổ quỹ có 1-n dòng `thu` theo payments; nếu `false`, không có, và có thể “Ghi sổ” sau qua endpoint batch cashbook.
- UI không hiển thị giá nhập với thu_ngan/nhan_vien_ban_hang.
- In bill hiển thị đúng dữ liệu.

### Hướng dẫn test (Frontend)
1) Thêm iPhone + phụ kiện trong cùng phiếu; nhập payments 2 nguồn; submit.
2) Kiểm tra tồn kho giảm đúng; `ExportHistory` có chung `batch_id`.
3) Mở Sổ quỹ kiểm tra các dòng `thu` khi bật ghi sổ ngay; tắt ghi sổ thì không có.
4) Bấm “In bill” xem bản in đúng.

### Rủi ro & Rollback
- Xử lý tồn kho và đồng bộ ExportHistory phức tạp. Rollback: tạm chỉ cho batch phụ kiện, giữ iPhone đơn lẻ.


