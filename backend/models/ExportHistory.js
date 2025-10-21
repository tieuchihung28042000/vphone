import mongoose from 'mongoose';
const ExportHistorySchema = new mongoose.Schema({
  imei: String,                // nếu có
  sku: String,
  product_name: String,
  quantity: Number,
  price_import: Number,
  price_sell: Number,
  sold_date: Date,
  customer_name: String,
  customer_phone: String,
  warranty: String,
  note: String,
  da_thanh_toan: { type: Number, default: 0 }, // Số tiền đã thanh toán
  payments: [{
    source: { type: String, enum: ['tien_mat', 'the', 'vi_dien_tu'], required: true },
    amount: { type: Number, required: true }
  }],
  branch: String,
  category: String,
  export_type: { type: String, default: 'normal' }, // phân biệt phụ kiện / iPhone
  batch_id: { type: String },
  sales_channel: { type: String },
  // Ghi nhận người tạo phiếu (nhân viên đang đăng nhập)
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  created_by_email: { type: String },
  created_by_name: { type: String },
  // Trạng thái hoàn trả
  is_returned: { type: Boolean, default: false },
  return_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ReturnExport' },
});
export default mongoose.model('ExportHistory', ExportHistorySchema);
