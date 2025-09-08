## Story 01: Siết phân quyền theo vai trò và chi nhánh

### Bối cảnh
Hiện đã có `authenticateToken`, `requireRole`, `filterByBranch`, `requireReportAccess`. Cần siết quyền chi tiết theo yêu cầu: thu_ngan không xem báo cáo; nhân viên bán hàng chỉ dùng Xuất hàng và Phiếu thu; quản lý xem/duyệt user trong chi nhánh, không tạo admin.

### Phạm vi
- Backend: gán middleware chuẩn cho các routes trong `backend/routes/*` theo ma trận quyền.
- Frontend: ẩn/hiện menu theo `role` tại `backend/src/components/NavBar.jsx`, chặn route bằng `backend/src/components/PrivateRoute.jsx`.

### Backend (đề xuất chỉnh)
- `backend/routes/report.js`: thêm `authenticateToken`, `requireReportAccess` ở router-level.
- `backend/routes/user.js`: giữ `requireRole(['admin','quan_ly'])`, validate branch: nếu không phải admin, chỉ thao tác user cùng `branch_id`.
- Các route nhập/ xuất/ trả/ sổ quỹ: thêm `authenticateToken`, `filterByBranch` khi GET list; với thao tác write kiểm tra `req.user.role` và `req.user.branch_name` khớp dữ liệu.

### Frontend
- `NavBar.jsx`: ẩn tab Báo cáo cho `thu_ngan`; với `nhan_vien_ban_hang` chỉ hiện Xuất hàng, Phiếu thu cơ bản.
- `PrivateRoute.jsx`: nhận prop `allowedRoles` để chặn truy cập route.

### Acceptance Criteria
- Thu ngân không gọi được API báo cáo (403) và không thấy tab Báo cáo.
- Nhân viên bán hàng chỉ truy cập Xuất hàng, Phiếu thu; các trang khác bị chặn.
- Quản lý chỉ quản trị user trong chi nhánh của mình.

### Hướng dẫn test (Frontend)
1) Đăng nhập 3 loại tài khoản (thu_ngan, quan_ly, nhan_vien_ban_hang) tại `/login`.
2) Kiểm tra menu hiển thị đúng theo vai trò.
3) Cố truy cập trực tiếp URL báo cáo với `thu_ngan` => bị chuyển về `NotAuthorized`.
4) Với `quan_ly`, mở trang quản lý user, chỉ thấy user trong chi nhánh.

### Rủi ro & Rollback
- Rủi ro sót route chưa gắn middleware. Rollback: revert thay đổi route-level.


