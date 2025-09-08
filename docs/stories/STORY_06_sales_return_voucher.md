## Story 06: Phiếu trả hàng bán thay cho nút xóa sản phẩm

### Bối cảnh
Thay vì xóa khỏi danh sách xuất, cần tạo phiếu trả hàng bán, chọn số tiền trả lại và chọn dòng tiền (tiền mặt/ thẻ hoặc cả 2). Ghi sổ quỹ loại `chi` theo nguồn.

### Phạm vi
- Backend: mở rộng `routes/returnExport.js` để hỗ trợ `payments: [{source, amount}]`, liên kết `export_id` hoặc `batch_id`, ghi `Cashbook` nhiều dòng.
- Frontend: UI “Tạo phiếu trả” từ đơn/batch, chọn số tiền và nguồn (1-n), xem lại sổ quỹ liên quan.

### Backend
- `POST /api/return-export` nhận: { export_id | batch_id, items(optional), amount, payments: [{source, amount}], note, branch }.
- Validate quyền chi nhánh, tồn tại đơn gốc, số lượng/tiền không vượt quá.
- Ghi `ReturnExport`, sinh các dòng `Cashbook` type `chi` với `related_type='tra_hang_ban'` và chung `receipt_code` nhóm.

### Frontend
- Trong trang chi tiết đơn xuất/ danh sách đơn: nút “Trả hàng”.
- Form nhập số tiền trả, thêm 1-n nguồn; submit hiển thị mã phiếu trả và link xem sổ quỹ liên quan.

### Acceptance Criteria
- Tạo phiếu trả thành công với 2 nguồn trả; sổ quỹ có 2 dòng `chi` đúng số dư.
- Không thể trả vượt số đã thu/thanh toán; trả partial được.

### Hướng dẫn test (Frontend)
1) Chọn một đơn đã bán, nhấn “Trả hàng”, nhập số tiền và 2 nguồn (VD: 1tr tiền mặt, 500k thẻ).
2) Lưu, vào Sổ quỹ lọc theo `related_type=tra_hang_ban` và `related_id` => thấy 2 dòng.
3) Kiểm tra đơn gốc cập nhật trạng thái/ghi chú đúng.

### Rủi ro & Rollback
- Ràng buộc partial return phức tạp. Rollback: giới hạn trả toàn bộ đơn trước.


