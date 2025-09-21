import mongoose from 'mongoose';

const SupplierDebtSchema = new mongoose.Schema({
  supplier_name: { type: String, required: true },
  supplier_phone: { type: String },
  supplier_address: { type: String },
  total_debt: { type: Number, default: 0 },
  total_paid: { type: Number, default: 0 },
  branch: { type: String, required: true },
  
  // Lịch sử các giao dịch công nợ
  debt_history: [{
    type: { type: String, enum: ['add', 'pay'], required: true }, // add = cộng nợ, pay = trả nợ
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    note: { type: String },
    related_id: { type: String }, // ID liên kết với đơn nhập hàng nếu có
    user: { type: String } // Người thực hiện
  }],
  
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

// Index để tìm kiếm nhanh
SupplierDebtSchema.index({ supplier_name: 1, branch: 1 });
SupplierDebtSchema.index({ supplier_phone: 1 });

// Middleware cập nhật updated_at
SupplierDebtSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

export default mongoose.model('SupplierDebt', SupplierDebtSchema); 