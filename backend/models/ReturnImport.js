import mongoose from 'mongoose';

const ReturnImportSchema = new mongoose.Schema({
  // Thông tin liên kết với phiếu nhập gốc
  original_inventory_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Inventory', 
    required: true 
  },
  
  // Thông tin sản phẩm trả
  imei: { type: String, default: null },
  sku: { type: String, required: true },
  product_name: { type: String, required: true },
  quantity: { type: Number, required: true, default: 1 },
  
  // Thông tin tài chính
  price_import: { type: Number, required: true }, // Giá nhập gốc
  return_amount: { type: Number, required: true }, // Số tiền trả lại
  
  // Phương thức thanh toán trả lại (hỗn hợp)
  return_cash: { type: Number, default: 0 }, // Trả bằng tiền mặt
  return_transfer: { type: Number, default: 0 }, // Trả bằng chuyển khoản
  
  // Thông tin trả hàng
  return_date: { type: Date, default: Date.now },
  return_reason: { type: String, required: true }, // Lý do trả hàng
  
  // Thông tin nhà cung cấp
  supplier: { type: String, required: true },
  
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
  
}, {
  timestamps: true
});

// Index để tìm kiếm nhanh
ReturnImportSchema.index({ return_date: -1 });
ReturnImportSchema.index({ branch: 1 });
ReturnImportSchema.index({ supplier: 1 });

export default mongoose.model('ReturnImport', ReturnImportSchema); 