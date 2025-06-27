const mongoose = require("mongoose");

const InventorySchema = new mongoose.Schema({
  imei: { type: String, unique: true, sparse: true },

  sku: { type: String, required: true },
  product_name: { type: String, required: true },
  tenSanPham: { type: String },

  price_import: { type: Number, required: true },
  price_sell: { type: Number, default: 0 },

  import_date: { type: Date, required: true },
  sold_date: { type: Date },

  quantity: { type: Number, default: 1 },
  category: { type: String, default: "" },

  supplier: { type: String },
  customer_name: { type: String },
  customer_phone: { type: String },   // ✅ Thêm trường SĐT khách hàng
  warranty: { type: String },
  branch: { type: String },
  note: { type: String },

  debt: { type: Number, default: 0 },       // Công nợ còn lại (khách nợ mình)
  da_tra: { type: Number, default: 0 },     // Đã trả (khách đã trả)
  debt_history: [{ 
    type: { type: String, enum: ["pay", "add"] },
    amount: { type: Number },
    date: { type: Date, default: Date.now },
    note: { type: String }
  }],

  // Supplier debt fields (mình nợ nhà cung cấp)
  supplier_debt: { type: Number, default: 0 },        // Còn nợ nhà cung cấp
  supplier_da_tra: { type: Number, default: 0 },      // Đã trả nhà cung cấp
  supplier_debt_history: [{ 
    type: { type: String, enum: ["pay", "add"] },
    amount: { type: Number },
    date: { type: Date, default: Date.now },
    note: { type: String }
  }],

  status: { type: String, enum: ["in_stock", "sold"], default: "in_stock" },
}, {
  timestamps: true
});

module.exports = mongoose.model("Inventory", InventorySchema);
