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

  // Trường đã thanh toán cho nhập hàng (với nhà cung cấp)
  da_thanh_toan_nhap: { type: Number, default: 0 }, // Đã thanh toán khi nhập hàng

  da_tra: { type: Number, default: 0 },     // Đã trả (khách đã trả)

  status: { type: String, enum: ["in_stock", "sold"], default: "in_stock" },
}, {
  timestamps: true
});

module.exports = mongoose.model("Inventory", InventorySchema);
