const mongoose = require("mongoose");

const CashbookSchema = new mongoose.Schema({
  type: { type: String, enum: ['thu', 'chi'], required: true },   // thu hoặc chi
  amount: { type: Number, required: true },                       // Số tiền
  content: { type: String, required: true },                      // Nội dung/diễn giải
  category: { type: String },                                     // Phân loại giao dịch
  source: { type: String, enum: ['tien_mat', 'the', 'vi_dien_tu', 'cong_no'], required: true }, // Nguồn tiền
  supplier: { type: String },                                     // Nhà cung cấp (nếu có)
  customer: { type: String },                                     // Khách hàng (nếu có)
  createdAt: { type: Date, default: Date.now },
  date: { type: Date, default: Date.now },                        // Ngày giao dịch
  branch: { type: String, required: true },                       // Chi nhánh (bắt buộc)
  related_id: { type: String },                                   // ID liên kết (vd: đơn nhập/xuất)
  related_type: { type: String, enum: ['ban_hang', 'nhap_hang', 'tra_no', 'tra_no_ncc', 'tra_hang_nhap', 'tra_hang_ban', 'manual'] }, // Loại liên kết
  note: { type: String },                                         // Ghi chú
  user: { type: String },                                         // Người thực hiện
  is_auto: { type: Boolean, default: false },                    // Tự động tạo hay thủ công
  editable: { type: Boolean, default: true },                    // Có thể chỉnh sửa hay không
  receipt_code: { type: String },                                 // Mã phiếu thu/chi
  balance_before: { type: Number, default: 0 },                  // Số dư trước giao dịch
  balance_after: { type: Number, default: 0 },                   // Số dư sau giao dịch
});

module.exports = mongoose.model("Cashbook", CashbookSchema); 