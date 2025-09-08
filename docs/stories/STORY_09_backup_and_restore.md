## Story 09: Backup định kỳ và hướng dẫn restore

### Bối cảnh
Tránh mất dữ liệu, cần backup MongoDB hàng ngày và có tài liệu khôi phục nhanh.

### Phạm vi
- Hạ tầng: script cron chạy `mongodump` vào `data/mongodb/backup/<YYYY-MM-DD>`; xoay vòng 7-14 ngày.
- Tài liệu: hướng dẫn restore bằng `mongorestore` và checklist xác minh.

### Implementation
- Thêm script shell trong `scripts/backup-daily.sh` (quy ước env từ `.env`).
- Thêm vào `crontab` trên VPS (tài liệu `VPS_DEPLOY_GUIDE.md`).

### Acceptance Criteria
- Backup sinh file mỗi ngày, tự xoay vòng.
- Làm theo tài liệu có thể restore trong < 15 phút.

### Hướng dẫn test
1) Chạy script backup thủ công; kiểm tra thư mục backup có dữ liệu.
2) Thử restore sang môi trường dev/test và chạy app xác minh dữ liệu.

### Rủi ro & Rollback
- Dung lượng tăng nhanh; cần xoá vòng đời. Rollback: tăng tần suất xoá.


