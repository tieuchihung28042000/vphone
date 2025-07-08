const mongoose = require('mongoose');

const ReturnExportSchema = new mongoose.Schema({
  // Thông tin liên kết với phiếu xuất gốc
  original_export_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'ExportHistory', 
    required: true 
  },
  
  // Thông tin sản phẩm trả
  imei: { type: String, default: null },
  sku: { type: String, required: true },
  product_name: { type: String, required: true },
  quantity: { type: Number, required: true, default: 1 },
  
  // Thông tin tài chính
  price_sell: { type: Number, required: true }, // Giá bán gốc
  return_amount: { type: Number, required: true }, // Số tiền trả lại khách
  
  // Phương thức thanh toán trả lại
  return_method: { 
    type: String, 
    enum: ['cash', 'transfer'], 
    required: true 
  },
  
  // Thông tin trả hàng
  return_date: { type: Date, default: Date.now },
  return_reason: { type: String, required: true }, // Lý do trả hàng
  
  // Thông tin khách hàng
  customer_name: { type: String, required: true },
  customer_phone: { type: String, default: '' },
  
  // Thông tin chi nhánh và người thực hiện
  branch: { type: String, required: true },
  created_by: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  
  // Ghi chú
  note: { type: String, default: '' },
  
  // Trạng thái
  status: { 
    type: String, 
    enum: ['pending', 'completed', 'cancelled'], 
    default: 'completed' 
  },
  
  // Thông tin sản phẩm sẽ quay lại tồn kho
  return_to_inventory: { type: Boolean, default: true },
  
}, {
  timestamps: true
});

// Index để tìm kiếm nhanh
ReturnExportSchema.index({ return_date: -1 });
ReturnExportSchema.index({ branch: 1 });
ReturnExportSchema.index({ customer_name: 1 });

module.exports = mongoose.model('ReturnExport', ReturnExportSchema); 