## Story 04: Nhập hàng & Trả hàng nhập - Thanh toán đa nguồn

### Bối cảnh
Yêu cầu chọn được vừa thẻ vừa mặt hoặc cả 2 khi nhập hàng và khi trả hàng nhập.

### Phạm vi
- Backend: cập nhật route nhập hàng/ trả hàng nhập để chấp nhận `payments: [{source, amount}]` và ghi nhiều bản ghi `Cashbook` theo nguồn.
- Frontend: form nhập/ trả nhập cho phép thêm nhiều dòng thanh toán; validate tổng tiền.

### Backend
- `routes/returnImport.js`: tại POST tạo phiếu, nhận `payments`. Với mỗi payment tạo 1 record `Cashbook` type `chi` (trả NCC) hoặc `thu` (nếu là nhận lại tiền từ NCC khi trả hàng nhập) theo nghiệp vụ hiện tại.
- Route nhập hàng (đang nằm rải rác trong `report.js`/`Inventory` theo thực tế): chuẩn hoá endpoint nhập hàng riêng (nếu cần) hoặc tái sử dụng hiện có, bổ sung `payments` và ghi `Cashbook` type `chi`.
- Cùng `related_id` (id phiếu) và `related_type` (`nhap_hang`/`tra_hang_nhap`) để nhóm.

### Frontend
- Form có phần “Thanh toán”: nút “+ Thêm nguồn” với chọn `source` (tiền mặt/thẻ/ ví) và `amount`.
- Tính tổng theo từng nguồn và tổng cộng; cảnh báo nếu không khớp với tổng giá trị phiếu.

### Acceptance Criteria
- Tạo phiếu nhập/ trả nhập với 2 nguồn thanh toán, ghi ra 2 dòng trong `Cashbook` chính xác số dư và `receipt_code` nhóm.
- Tổng tiền hiển thị và số dư sổ quỹ khớp sau khi lưu.

### Hướng dẫn test (Frontend)
1) Vào trang Nhập hàng/ Trả hàng nhập, thêm 2 nguồn thanh toán (VD: 3tr thẻ, 2tr tiền mặt).
2) Lưu phiếu, mở Sổ quỹ lọc theo `related_type` => thấy 2 dòng tương ứng.
3) Xuất Excel sổ quỹ kiểm tra số liệu.

### Rủi ro & Rollback
- Trùng ghi quỹ khi retry. Cần idempotency theo `related_id + source`. Rollback: tắt ghi nhiều nguồn (chỉ 1 nguồn).


