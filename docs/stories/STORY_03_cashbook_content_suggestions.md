## Story 03: Sổ quỹ - Gợi ý nội dung mô tả và lọc nhanh

### Bối cảnh
Người dùng muốn thêm nhanh nội dung (mô tả) và sau đó có thể chọn lại nhanh để tiết kiệm thời gian.

### Phạm vi
- Backend: API `GET /api/cashbook/contents?type&branch&limit` trả danh sách distinct content + count.
- Frontend: autocomplete nội dung ở form tạo/sửa sổ quỹ, filter theo nội dung phổ biến.

### Backend
- Trong `routes/cashbook.js` thêm endpoint sử dụng aggregation `$group` theo `content` và `$count`.
- Tham số: `type` (thu/chi), `branch` (lọc theo chi nhánh), `limit` (mặc định 50).

### Frontend
- Tại trang `src/pages/Cashbook.jsx` (bản iphone-inventory hoặc backend/src nếu dùng), trường `content` sử dụng autocomplete.
- Thêm filter “Nội dung đã dùng” để lọc nhanh.

### Acceptance Criteria
- API trả về danh sách nội dung đã dùng kèm số lần xuất hiện.
- Người dùng chọn nhanh nội dung từ danh sách gợi ý khi lập phiếu.

### Hướng dẫn test (Frontend)
1) Tạo một vài phiếu thu/chi với nội dung trùng nhau.
2) Mở form tạo mới, gõ vài ký tự => autocomplete hiện gợi ý đúng.
3) Dùng filter “Nội dung đã dùng” => danh sách thay đổi đúng theo nội dung chọn.

### Rủi ro & Rollback
- Nội dung quá dài/đặc thù; có thể giới hạn độ dài hiển thị. Rollback: ẩn autocomplete.


