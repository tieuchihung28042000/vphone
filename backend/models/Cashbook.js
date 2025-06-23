const mongoose = require("mongoose");

const CashbookSchema = new mongoose.Schema({
  type: { type: String, enum: ['thu', 'chi'], required: true },   // thu hoặc chi
  amount: { type: Number, required: true },                       // Số tiền
  content: { type: String },                                      // Nội dung/diễn giải
  category: { type: String },                                     // Phân loại giao dịch
  source: { type: String, enum: ['tien_mat', 'the', 'cong_no'], required: true }, // Nguồn tiền
  supplier: { type: String },                                     // Nhà cung cấp (nếu có)
  customer: { type: String },                                     // Khách hàng (nếu có)
  createdAt: { type: Date, default: Date.now },
  branch: { type: String },
  related_id: { type: String },                                   // ID liên kết (vd: đơn nhập/xuất)
  note: { type: String },
  user: { type: String },                                         // Người thực hiện (nếu cần)
});

module.exports = mongoose.model("Cashbook", CashbookSchema);
