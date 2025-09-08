## Story 02: Nhật ký lịch sử thao tác (Activity Log)

### Bối cảnh
Cần ghi nhận thao tác: sửa/xóa trả hàng nhập, sửa/xóa trả hàng bán, sửa/xóa thu-chi, và các thao tác quan trọng khác.

### Phạm vi
- Backend: tạo model `ActivityLog`, hook ghi log tại các route quan trọng.
- Frontend: trang “Lịch sử hoạt động” (filter theo thời gian, user, module, chi nhánh).

### Backend
- Model `ActivityLog`:
  - Fields: `user_id`, `username`, `role`, `action`, `module`, `payload_snapshot`, `ref_id`, `branch`, `createdAt`.
- Hooks:
  - `routes/cashbook.js`: POST/PUT/DELETE ghi action `create/update/delete` module `cashbook`.
  - `routes/returnImport.js`, `routes/returnExport.js`: POST/PUT/DELETE ghi action `create/update/delete` module `return_*`.
- Endpoint: `GET /api/activity-logs?from&to&user&module&branch&page&limit`.

### Frontend
- Trang mới: `src/pages/LichSuHoatDong.jsx` với bảng, bộ lọc (thời gian, user, module, chi nhánh), phân trang.

### Acceptance Criteria
- Mọi thao tác nêu trên đều có record log với thông tin người dùng và dữ liệu tham chiếu.
- Có thể lọc và xem chi tiết payload.

### Hướng dẫn test (Frontend)
1) Đăng nhập bằng user thường và quản lý; tạo/sửa/xóa một giao dịch sổ quỹ và một phiếu trả.
2) Mở trang Lịch sử hoạt động; lọc theo user và khoảng thời gian; kiểm tra bản ghi xuất hiện.

### Rủi ro & Rollback
- Kích thước payload lớn; nên log snapshot rút gọn. Rollback: tắt ghi log từng module.


