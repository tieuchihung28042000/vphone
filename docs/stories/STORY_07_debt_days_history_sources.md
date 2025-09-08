## Story 07: Công nợ - Số ngày nợ, lịch sử công nợ, chọn nguồn khi thu/trả nợ

### Bối cảnh
Hiển thị số ngày khách nợ; trang chi tiết có lịch sử công nợ. Khi trả nợ (khách trả/mình trả NCC) phải chọn nguồn tiền vào quỹ (hỗ trợ multi-payment).

### Phạm vi
- Backend: endpoint trả nợ hỗ trợ `payments`, cập nhật `Cashbook` (type `thu` khi khách trả; `chi` khi trả NCC), tính số ngày nợ.
- Frontend: cột “Số ngày nợ” (đỏ khi quá hạn), trang chi tiết lịch sử công nợ, form trả nợ có 1-n nguồn.

### Backend
- `routes/congno.js`: thêm `POST /pay-debt` nhận { customer|supplier, amount, payments: [{source, amount}], branch, note }.
- Tính số ngày nợ: từ lần phát sinh nợ gần nhất hoặc từ ngày đầu kỳ có dư nợ > 0 đến hiện tại.
- Trả về lịch sử công nợ theo khách hàng.

### Frontend
- Trang Công nợ: thêm cột “Ngày nợ”; vào chi tiết khách: timeline biến động (bán chịu, thu nợ, trả NCC).
- Form “Thu nợ/Trả NCC” có multi-payment.

### Acceptance Criteria
- Cột số ngày nợ tính đúng; hiển thị đỏ khi > ngưỡng cấu hình (VD 7 ngày).
- Thu nợ với 2 nguồn tạo 2 dòng `Cashbook` type `thu`.

### Hướng dẫn test (Frontend)
1) Tạo dữ liệu công nợ (bán chịu). Vào trang Công nợ kiểm tra số ngày nợ hiển thị.
2) Thực hiện “Thu nợ” với 2 nguồn; vào Sổ quỹ thấy 2 dòng `thu` liên quan.
3) Mở chi tiết khách để xem lịch sử đầy đủ.

### Rủi ro & Rollback
- Quy tắc tính “ngày nợ” có thể khác nhau. Rollback: hiển thị số ngày từ ngày đơn bán đến hiện tại khi còn dư nợ.


