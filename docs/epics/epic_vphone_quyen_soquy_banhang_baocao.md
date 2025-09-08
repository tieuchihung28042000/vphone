## Epic: Nâng cấp phân quyền, sổ quỹ, nhập/xuất hàng, công nợ và báo cáo tài chính (VPhone)

### 1) Mục tiêu
- Hoàn thiện phân quyền theo chi nhánh và theo vai trò: thu_ngan, quan_ly, nhan_vien_ban_hang, admin.
- Bổ sung nhật ký lịch sử thao tác (audit log) các hành động quan trọng (sửa/xóa/phiếu trả/thu-chi).
- Nâng cấp sổ quỹ: gợi ý nhanh nội dung mô tả, lọc theo nội dung đã dùng.
- Nâng cấp nhập hàng/ trả hàng nhập: hỗ trợ thanh toán đa nguồn (tiền mặt + thẻ cùng lúc).
- Nâng cấp xuất hàng: ẩn giá nhập, đa nguồn thanh toán, gộp nhiều sản phẩm, chọn kênh bán hàng và nhân viên bán hàng, tiền chưa vào sổ quỹ, in bill.
- Nâng cấp phiếu trả hàng bán: thay nút xóa bằng phiếu trả với chọn dòng tiền (tiền mặt/ chuyển khoản hoặc cả 2).
- Công nợ: hiển thị số ngày nợ (cảnh báo), thêm lịch sử công nợ theo khách hàng, chọn nguồn tiền vào quỹ khi trả nợ/chi trả công nợ NCC.
- Báo cáo tài chính: tổng doanh thu, doanh thu trả hàng, doanh thu thuần, chi phí, lợi nhuận HĐKD, thu nhập khác, lợi nhuận thuần.
- Backup dữ liệu định kỳ hằng ngày, hỗ trợ restore nhanh.

### 2) Phạm vi
- Backend `backend/` (Express + MongoDB: models, routes, middleware) và Frontend React trong `backend/src/` và `iphone-inventory/src/` (nếu tái sử dụng UI).
- Không ảnh hưởng hạ tầng deploy hiện tại; thêm script backup.

### 3) Thực trạng code (tóm tắt)
- Phân quyền:
  - Có `middleware/auth.js`: `authenticateToken`, `requireRole`, `filterByBranch`, `requireReportAccess` (đã chặn thu_ngan xem báo cáo).
  - Role hợp lệ đang có: `user`, `admin`, `thu_ngan`, `quan_ly`, `nhan_vien_ban_hang` (xem `routes/auth.js`, `routes/user.js`).
  - Lọc theo chi nhánh đã có `filterByBranch`, kiểm tra chéo chi nhánh tại `returnImport`/`returnExport`.
- Sổ quỹ:
  - Model `Cashbook`: một nguồn `source` duy nhất cho mỗi giao dịch: `tien_mat`, `the`, `vi_dien_tu`, `cong_no`.
  - API CRUD và thống kê nằm trong `routes/cashbook.js`; có auto ghi sổ từ bán hàng/nhập hàng/công nợ.
- Xuất hàng, báo cáo:
  - `routes/report.js` xử lý báo cáo lợi nhuận dựa trên `ExportHistory`; có API `xuat-hang` ghi lịch sử xuất cho iPhone/phụ kiện; trường `da_thanh_toan` đã tồn tại trên `ExportHistory`.
  - Đã có gom phụ kiện theo SKU trong tồn kho; nhưng chưa có bán nhiều dòng (multi-line) trong một phiếu xuất duy nhất.
- Trả hàng:
  - `routes/returnImport.js`, `routes/returnExport.js` đã có, kiểm tra chi nhánh và role cơ bản.

### 4) Yêu cầu chi tiết và thay đổi thiết kế

4.1 Phân quyền theo chi nhánh và vai trò
- Quy tắc:
  - Thu ngân: không xem được báo cáo. Các màn khác theo phân công (được thu/chi, xem sổ quỹ, không can thiệp cấu hình).
  - Quản lý: xem toàn bộ trong chi nhánh mình; có thể duyệt user, phân vai trò (trừ tạo admin).
  - Nhân viên bán hàng: chỉ truy cập màn Xuất hàng và Phiếu thu (thu tiền từ khách), không truy cập nhập hàng/sổ quỹ nâng cao/báo cáo.
  - Admin: không giới hạn.
- Backend:
  - Bổ sung middleware theo route: sử dụng `requireRole` và `requireReportAccess` (đã có) + siết quyền từng endpoint.
  - Với dữ liệu theo chi nhánh, dùng `filterByBranch`/check branch trên record.
- Frontend:
  - `PrivateRoute` và điều hướng menu theo role; ẩn tab Báo cáo cho `thu_ngan`, giới hạn menu cho `nhan_vien_ban_hang`.

4.2 Lịch sử thao tác (Audit Log)
- Tạo collection mới: `ActivityLog` với các trường: `user_id`, `username`, `role`, `action` (create/update/delete/return/sale/purchase), `module` (cashbook, import, export, return, debt, user,…), `payload_snapshot`, `ref_id`, `branch`, `createdAt`.
- Hook ghi log tại các route:
  - Sửa/xóa: trả hàng nhập, trả hàng bán, thu/chi.
  - Các thao tác tạo phiếu quan trọng (xuất, nhập, trả, điều chỉnh quỹ…).
- Trang “Lịch sử hoạt động”: lọc theo thời gian, user, module, chi nhánh; realtime đơn giản (polling) hoặc socket sau.

4.3 Sổ quỹ: gợi ý mô tả, lọc nhanh theo nội dung đã dùng
- Backend:
  - API `/api/cashbook/contents` trả về danh sách `content` đã sử dụng (distinct + count). Cho phép query theo `type` và `branch`.
  - Giữ nguyên `Cashbook` hiện tại; thêm endpoint hỗ trợ gợi ý.
- Frontend:
  - Ô mô tả có gợi ý (autocomplete) + nút “+” để thêm nhanh nội dung mới vào danh sách gợi ý (thực chất là nhập content mới, không cần bảng riêng).
  - Bộ lọc bổ sung: tìm nhanh theo các `content` phổ biến.

4.4 Nhập hàng và Trả hàng nhập: thanh toán đa nguồn
- Yêu cầu: chọn được vừa thẻ vừa mặt (multi-payment) trong 1 phiếu.
- Thiết kế dữ liệu:
  - Không thay đổi `Cashbook` (mỗi record đại diện cho 1 nguồn). Khi nhập hàng hoặc trả hàng nhập có nhiều nguồn, tạo nhiều bản ghi `Cashbook` (1 record/nguồn) kèm cùng `related_id`/`related_type` và `receipt_code` nhóm.
  - Với phiếu nhập/phiếu trả hàng nhập, lưu thêm `payments` ở document phiếu (mảng {source, amount}). Nếu chưa có model phiếu nhập, lưu ở collection hiện có (Inventory/ReturnImport) bằng trường mới `payments`.
- API:
  - Endpoint nhập hàng/ trả hàng nhập chấp nhận `payments: [{source, amount}]`; validate tổng tiền khớp; ghi nhiều record Cashbook với số dư tương ứng.

4.5 Xuất hàng
- Ẩn giá nhập khi nhập IMEI: frontend không hiển thị `price_import` cho role không phải quản lý/admin.
- Thanh toán đa nguồn: như 4.4, sử dụng nhiều record Cashbook cho 1 phiếu bán; cho phép tùy chọn “không tự động vào sổ quỹ” (flag `auto_cashbook=false`).
- Gộp chung nhiều sản phẩm xuất 1 lần:
  - Tạo API mới `POST /api/report/xuat-hang-batch` nhận `items: [...]` chứa iPhone/phụ kiện và thông tin chung (khách hàng, chi nhánh, sold_date, note, payments, channel, salesperson, da_thanh_toan…).
  - Cập nhật tồn kho tương ứng từng item; ghi nhiều dòng vào `ExportHistory` kèm `batch_id` để liên kết 1 phiếu.
- Tiền chưa vào sổ quỹ:
  - Nếu `auto_cashbook=false` thì không gọi `/cashbook/auto-sale`. Người dùng có thể vào sổ quỹ sau qua một thao tác “Ghi sổ” từ phiếu (sinh các Cashbook record dựa trên `payments`).
- Thêm ô “Kênh bán hàng” và “Nhân viên bán hàng”:
  - Thêm field trên `ExportHistory`: `sales_channel`, `salesperson` (string hoặc ref User theo nhu cầu). Có API gợi ý `channels`/`salespersons` (distinct từ dữ liệu đã có) + nút “+” để thêm nhanh (ở mức dữ liệu là nhập tự do; có thể tách bảng cấu hình sau).
- In bill:
  - Sau khi tạo batch `xuat-hang-batch`, trả về dữ liệu hóa đơn (mã phiếu, danh sách sản phẩm, tổng tiền, thanh toán theo nguồn, khách hàng, chi nhánh). Frontend có nút “In bill”.

4.6 Phiếu trả hàng bán (thay nút xóa ở danh sách xuất)
- Thay vì xóa sản phẩm khỏi danh sách xuất, tạo “Phiếu trả hàng bán” cho item/batch đã bán.
- Chọn số tiền trả lại (theo đơn/batch); chọn dòng tiền hoàn trả: tiền mặt/ trả về tài khoản (thẻ) hoặc cả 2; sinh 1-n bản ghi `Cashbook` loại `chi` với `related_type='tra_hang_ban'`.
- Liên kết `ReturnExport` với `ExportHistory` qua `export_id` hoặc `batch_id`.

4.7 Công nợ
- Đếm số ngày khách nợ: hiển thị số ngày kể từ ngày phát sinh nợ gần nhất đến hiện tại cho khách đang còn dư nợ > 0. In đỏ ở tab “Khách hàng nợ”.
- Lịch sử công nợ theo khách: trang chi tiết khách hiển thị timeline các phát sinh nợ/thu nợ, liên kết `Cashbook` (related_type `tra_no`) và đơn bán.
- Khi trả nợ (khách trả/ mình trả NCC): bắt buộc chọn nguồn tiền vào sổ quỹ (multi-payment optional giống 4.4). Ghi tương ứng nhiều record `Cashbook`.

4.8 Báo cáo tài chính
- Định nghĩa chỉ tiêu:
  1) Tổng doanh thu bán hàng (chưa trừ trả hàng): tổng `price_sell * quantity` từ `ExportHistory` theo kỳ.
  2) Tổng doanh thu trả hàng (phiếu trả hàng): tổng tiền hoàn cho khách (từ `ReturnExport`).
  3) Doanh thu thuần = (1) - (2).
  4) Chi phí: lấy từ sổ quỹ tất cả khoản `chi` có `category` thuộc nhóm chi phí. Cho phép chọn nhanh theo `content`.
  5) Lợi nhuận HĐKD = (3) - (4).
  6) Thu nhập khác: tổng `thu` từ phiếu thu (không thuộc doanh thu bán hàng), dựa `Cashbook` có `related_type='manual'` hoặc `content` thuộc nhóm thu nhập khác.
  7) Lợi nhuận thuần = (5) + (6).
- Backend:
  - Tạo endpoint `/api/financial-report/summary` với tham số thời gian, chi nhánh; tổng hợp từ `ExportHistory`, `ReturnExport`, `Cashbook`.
  - Bổ sung phân loại `category`/mapping content->category để phân biệt chi phí vs thu nhập khác.
- Frontend:
  - Trang “Báo cáo tài chính”: hiển thị các chỉ tiêu, bộ lọc thời gian/chi nhánh, export excel.

4.9 Quản lý người dùng
- Trang quản lý người dùng: tạo tài khoản, tạo/đổi vai trò, phê duyệt user, giới hạn truy cập theo role.
- Bổ sung vai trò tương ứng và kiểm soát UI theo `role`.

4.10 Backup định kỳ
- Tạo script cron (bash) chạy `mongodump` lưu vào `data/mongodb/backup/<date>` và tự động xoay vòng 7-14 ngày.
- Nút “Khôi phục” thủ công (chỉ admin) với hướng dẫn thao tác restore (tài liệu kèm).

### 5) Thay đổi dữ liệu & API (đề xuất)
- Model mới: `ActivityLog`.
- `ExportHistory`: thêm `batch_id`, `sales_channel`, `salesperson`.
- `ReturnExport`/`ReturnImport`: thêm `payments: [{source, amount}]`, `batch_id` (nếu áp dụng theo phiếu).
- Route mới:
  - `POST /api/report/xuat-hang-batch` (tạo phiếu xuất nhiều dòng + payments).
  - `POST /api/cashbook/record-batch` (ghi nhiều dòng quỹ theo 1 batch/related_id, khi user chọn “Ghi sổ”).
  - `GET /api/cashbook/contents` (gợi ý nội dung).
  - `GET /api/financial-report/summary` (tổng hợp chỉ tiêu 1-7).
  - `GET /api/activity-logs` (lịch sử hoạt động; filter by user/module/time/branch).

### 6) UI/UX
- Điều hướng menu theo `role` (ẩn/hiện các tab: Báo cáo, Nhập/Trả nhập, Sổ quỹ,…).
- Màn Xuất hàng (mới):
  - Cho phép thêm nhiều dòng sản phẩm (IMEI + phụ kiện), chọn payments đa nguồn, chọn kênh bán hàng, nhân viên bán hàng, nút “In bill”.
  - Tùy chọn “Ghi sổ quỹ ngay” hoặc “Ghi sổ sau”.
- Màn Sổ quỹ: autocomplete nội dung + filter theo nội dung đã dùng.
- Màn Công nợ: cột “Số ngày nợ” (đỏ nếu > N ngày), vào chi tiết có lịch sử công nợ.
- Màn Lịch sử hoạt động: bảng log, filter, chi tiết payload.
- Màn Báo cáo tài chính: 7 chỉ tiêu, biểu đồ/tổng hợp, export excel.

### 7) Tiêu chí nghiệm thu (Acceptance Criteria)
- Phân quyền:
  - Thu ngân không truy cập được API báo cáo; UI ẩn tab Báo cáo.
  - Nhân viên bán hàng chỉ thấy Xuất hàng và Phiếu thu cơ bản; chặn các API khác.
  - Quản lý quản trị user trong chi nhánh của mình; không tạo admin.
- Sổ quỹ:
  - Gợi ý nội dung hoạt động; lọc theo nội dung đã dùng trả về đúng kết quả.
- Nhập/Trả nhập:
  - Cho phép chọn nhiều nguồn thanh toán, ghi nhiều record Cashbook chính xác số dư.
- Xuất hàng:
  - Ẩn giá nhập với role không đủ quyền.
  - Cho phép xuất nhiều dòng, tạo `ExportHistory` đúng, có `batch_id`; in bill được.
  - Nếu “tiền chưa vào quỹ”, không tạo Cashbook tự động và có thể “Ghi sổ” sau.
- Phiếu trả hàng bán:
  - Tạo phiếu trả với chọn dòng tiền 1-n nguồn, cập nhật `Cashbook` loại chi.
- Công nợ:
  - Hiển thị số ngày nợ chính xác; lịch sử công nợ đầy đủ.
- Báo cáo tài chính:
  - Endpoint trả về đủ 7 chỉ tiêu và khớp số theo bộ lọc.
- Backup:
  - Cron chạy hằng ngày, tạo thư mục backup; tài liệu hướng dẫn restore.

### 8) Rủi ro & lưu ý
- Thay đổi đa nguồn thanh toán yêu cầu đồng bộ giữa ExportHistory/Return* và Cashbook để không lệch quỹ.
- Cần migration thêm field mới (`batch_id`, `sales_channel`, `salesperson`) – không phá vỡ dữ liệu cũ.
- Khối lượng nghiệp vụ xuất hàng multi-line cần test kỹ (IMEI + phụ kiện, tồn kho, lợi nhuận).
- Phân loại chi phí/thu nhập khác dựa trên `category`/`content` cần hướng dẫn dữ liệu chuẩn.

### 9) Kế hoạch triển khai (đề xuất 4 bước)
1. Phân quyền & UI menu theo role; chặn báo cáo với thu_ngan; bổ sung requireRole chi tiết cho các route.
2. Audit Log + Sổ quỹ gợi ý nội dung; API `cashbook/contents`.
3. Xuất hàng batch + multi-payment + in bill; nâng cấp trả hàng bán/nhập multi-payment; tuỳ chọn “ghi sổ sau”.
4. Công nợ (số ngày nợ + lịch sử), Báo cáo tài chính 7 chỉ tiêu, backup cron.

### 10) Ước lượng (thô)
- Backend: 6–9 ngày công (API mới, multi-payment, batch sale, audit, report tổng hợp).
- Frontend: 6–9 ngày công (UI batch sale, bill, lọc/gợi ý, báo cáo, lịch sử hoạt động, phân quyền UI).
- Kiểm thử/UAT & tài liệu: 3–4 ngày công.


