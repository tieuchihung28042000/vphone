## Story 08: Báo cáo tài chính (7 chỉ tiêu)

### Bối cảnh
Cần tổng hợp 7 chỉ tiêu: doanh thu bán hàng, doanh thu trả hàng, doanh thu thuần, chi phí, lợi nhuận HĐKD, thu nhập khác, lợi nhuận thuần.

### Phạm vi
- Backend: endpoint `/api/financial-report/summary?from&to&branch` tổng hợp từ `ExportHistory`, `ReturnExport`, `Cashbook`.
- Frontend: trang “Báo cáo tài chính” hiển thị các chỉ tiêu + export excel.

### Backend
- Từ `ExportHistory`: tổng doanh thu bán hàng (1).
- Từ `ReturnExport`: tổng doanh thu trả hàng (2).
- (3) = (1) - (2).
- Từ `Cashbook`: tổng `chi` có `category` thuộc “chi phí” (4); tổng `thu` không thuộc doanh thu bán hàng là “thu nhập khác” (6) (mapping theo `category`/`content`).
- (5) = (3) - (4), (7) = (5) + (6).

### Frontend
- Bộ lọc thời gian/chi nhánh, hiển thị 7 cards chỉ tiêu, bảng chi tiết (tùy chọn), và nút export.

### Acceptance Criteria
- API trả đúng 7 chỉ tiêu theo kỳ và chi nhánh.
- UI hiển thị đúng và xuất excel thành công.

### Hướng dẫn test (Frontend)
1) Tạo dữ liệu giả gồm bán hàng, trả hàng, thu/chi nhiều loại.
2) Chạy báo cáo theo khoảng thời gian; đối chiếu số liệu với sổ quỹ và export history.
3) Export excel xem tổng khớp.

### Rủi ro & Rollback
- Phân loại chi phí/thu nhập khác chưa chuẩn; bổ sung mapping cấu hình. Rollback: chỉ hiển thị 1-3,5 cơ bản trước.


