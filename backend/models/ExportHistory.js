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
  branch: String,
  category: String,
  export_type: { type: String, default: 'normal' }, // phân biệt phụ kiện / iPhone
  batch_id: { type: String },
  sales_channel: { type: String },
  salesperson: { type: String },
});
export default mongoose.model('ExportHistory', ExportHistorySchema);
