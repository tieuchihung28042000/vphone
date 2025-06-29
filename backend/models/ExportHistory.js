const mongoose = require('mongoose');
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
  debt: Number,
  branch: String,
  category: String,
  export_type: { type: String, default: 'normal' }, // phân biệt phụ kiện / iPhone
});
module.exports = mongoose.model('ExportHistory', ExportHistorySchema);
