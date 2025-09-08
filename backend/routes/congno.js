const express = require('express');
const router = express.Router();
const Inventory = require('../models/Inventory');
const ExportHistory = require('../models/ExportHistory');
const Cashbook = require('../models/Cashbook');

// ✅ API lấy danh sách khách hàng còn công nợ (tính từ ExportHistory)
router.get('/cong-no-list', async (req, res) => {
  try {
    const { search = "", show_all = "false" } = req.query;
    
    let query = {
      customer_name: { $ne: null, $ne: "" }
    };

    // Thêm tìm kiếm theo tên hoặc sđt
    if (search.trim()) {
      query.$or = [
        { customer_name: { $regex: search, $options: 'i' } },
        { customer_phone: { $regex: search, $options: 'i' } }
      ];
    }

    const exportItems = await ExportHistory.find(query);
    console.log(`🔍 Found ${exportItems.length} export items for customer debt calculation`);

    // Gom nhóm theo customer_name + customer_phone
    const grouped = {};
    exportItems.forEach(item => {
      const key = item.customer_name + "|" + (item.customer_phone || "");
      if (!grouped[key]) {
        grouped[key] = {
          customer_name: item.customer_name,
          customer_phone: item.customer_phone || "",
          total_debt: 0,
          total_paid: 0,
          total_sale_price: 0,
          debt_history: [],
          product_list: []
        };
      }
      
      // Tính công nợ từ logic mới: (price_sell × quantity) - da_thanh_toan
      const priceSell = parseFloat(item.price_sell) || 0;
      const quantity = parseInt(item.quantity) || 1;
      const daTT = parseFloat(item.da_thanh_toan) || 0;
      const congNo = Math.max((priceSell * quantity) - daTT, 0);
      
      // Tổng giá bán (TẤT CẢ đơn) = giá bán × số lượng
      grouped[key].total_sale_price += (priceSell * quantity);
      
      // Tổng đã trả (TẤT CẢ đơn)  
      grouped[key].total_paid += daTT;
      
      // Tổng công nợ (chỉ đơn còn nợ)
      grouped[key].total_debt += congNo;

      // Thêm sản phẩm chi tiết
      grouped[key].product_list.push({
        _id: item._id,
        imei: item.imei,
        product_name: item.product_name,
        price_sell: priceSell,
        quantity: quantity,
        da_thanh_toan: daTT,
        sold_date: item.sold_date
      });
    });

    // Hiển thị khách hàng có giao dịch (có tổng giá bán > 0)
    let result = Object.values(grouped).filter(customer => customer.total_sale_price > 0);
    
    // Nếu không show_all, chỉ hiển thị khách còn nợ
    if (show_all !== "true") {
      result = result.filter(customer => customer.total_debt > 0);
    }

    res.json({ items: result });
  } catch (err) {
    console.error('❌ Error in cong-no-list:', err);
    res.status(500).json({ message: '❌ Lỗi server khi lấy công nợ', error: err.message });
  }
});

// ✅ API lấy danh sách đơn còn nợ của 1 khách hàng
router.get('/cong-no-orders', async (req, res) => {
  const { customer_name, customer_phone } = req.query;
  if (!customer_name) return res.status(400).json({ message: "Thiếu tên khách hàng" });
  
  try {
    const query = {
      customer_name,
    };
    if (customer_phone) query.customer_phone = customer_phone;
    
    const orders = await ExportHistory.find(query).sort({ sold_date: -1 });
    
    // Chỉ lấy đơn còn nợ ((price_sell × quantity) > da_thanh_toan)
    const ordersWithDebt = orders.filter(order => {
      const priceSell = parseFloat(order.price_sell) || 0;
      const quantity = parseInt(order.quantity) || 1;
      const daTT = parseFloat(order.da_thanh_toan) || 0;
      return (priceSell * quantity) > daTT;
    }).map(order => order.toObject());
    
    res.json({ orders: ordersWithDebt });
  } catch (err) {
    console.error('❌ Error in cong-no-orders:', err);
    res.status(500).json({ message: '❌ Lỗi server khi lấy đơn nợ', error: err.message });
  }
});

// ✅ API trả nợ khách hàng (cập nhật da_thanh_toan trong ExportHistory)
router.put('/cong-no-pay-customer', async (req, res) => {
  try {
    console.log('💰 API cong-no-pay-customer received:', req.body);
    
    const { customer_name, customer_phone, amount, note, branch, payments = [] } = req.body;
    
    if (!customer_name || typeof customer_name !== 'string' || customer_name.trim().length === 0) {
      return res.status(400).json({ message: "❌ Thiếu thông tin tên khách hàng" });
    }
    
    const hasPayments = Array.isArray(payments) && payments.length > 0;
    if (!hasPayments) {
      if (!amount || isNaN(amount) || Number(amount) <= 0) {
        return res.status(400).json({ message: "❌ Số tiền trả phải lớn hơn 0" });
      }
    }

    const query = { customer_name };
    if (customer_phone) query.customer_phone = customer_phone;
    
    // Lấy các đơn còn nợ
    const orders = await ExportHistory.find(query).sort({ sold_date: 1 });

    const totalInput = hasPayments ? payments.reduce((s, p) => s + Number(p?.amount || 0), 0) : Number(amount);
    if (!totalInput || isNaN(totalInput) || Number(totalInput) <= 0) {
      return res.status(400).json({ message: "❌ Số tiền trả phải lớn hơn 0" });
    }

    let remain = Number(totalInput);
    let totalPaid = 0;
    let totalDebt = 0;

    for (const order of orders) {
      if (remain <= 0) break;
      
      const priceSell = parseFloat(order.price_sell) || 0;
      const quantity = parseInt(order.quantity) || 1;
      const currentDaTT = parseFloat(order.da_thanh_toan) || 0;
      const currentDebt = Math.max((priceSell * quantity) - currentDaTT, 0);
      
      if (currentDebt <= 0) continue;
      
      const toPay = Math.min(remain, currentDebt);
      const newDaTT = currentDaTT + toPay;
      
      // Cập nhật da_thanh_toan
      await ExportHistory.findByIdAndUpdate(order._id, {
        da_thanh_toan: newDaTT
      });
      
      remain -= toPay;
      totalPaid += toPay;
    }

    // Tính lại tổng công nợ sau khi trả
    const updatedOrders = await ExportHistory.find(query);
    updatedOrders.forEach(order => {
      const priceSell = parseFloat(order.price_sell) || 0;
      const quantity = parseInt(order.quantity) || 1;
      const daTT = parseFloat(order.da_thanh_toan) || 0;
      totalDebt += Math.max((priceSell * quantity) - daTT, 0);
    });

    res.json({
      message: `✅ Đã trả nợ ${totalPaid.toLocaleString()}đ cho khách hàng ${customer_name}`,
      paid_amount: totalPaid,
      remaining_debt: totalDebt
    });

    // Ghi sổ quỹ: thu tiền nợ theo payments (hoặc 1 dòng nếu không có payments)
    try {
      const payList = hasPayments ? payments : [{ source: 'tien_mat', amount: totalPaid }];
      for (const p of payList) {
        if (!p || !p.amount) continue;
        await Cashbook.create({
          type: 'thu',
          amount: Number(p.amount),
          content: `Thu nợ khách: ${customer_name}`,
          note: note || '',
          date: new Date(),
          branch: branch || '',
          source: p.source || 'tien_mat',
          customer: customer_name,
          related_type: 'tra_no',
          is_auto: true,
          editable: false
        });
      }
    } catch (e) { /* ignore */ }
  } catch (err) {
    console.error('❌ Error in cong-no-pay-customer:', err);
    res.status(500).json({ message: '❌ Lỗi server khi trả nợ', error: err.message });
  }
});

// ✅ API cộng nợ khách hàng (giảm da_thanh_toan trong ExportHistory)
router.put('/cong-no-add-customer', async (req, res) => {
  try {
    console.log('📈 API cong-no-add-customer received:', req.body);
    
    const { customer_name, customer_phone, amount, note, branch } = req.body;
    
    if (!customer_name || typeof customer_name !== 'string' || customer_name.trim().length === 0) {
      return res.status(400).json({ message: "❌ Thiếu thông tin tên khách hàng" });
    }
    
    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({ message: "❌ Số tiền cộng nợ phải lớn hơn 0" });
    }

    const query = { customer_name };
    if (customer_phone) query.customer_phone = customer_phone;

    // Lấy đơn gần nhất để cộng nợ
    const latestOrder = await ExportHistory.findOne(query).sort({ sold_date: -1 });

    if (!latestOrder) {
      return res.status(404).json({ message: "❌ Không tìm thấy đơn hàng của khách hàng này" });
    }
    
    const currentDaTT = parseFloat(latestOrder.da_thanh_toan) || 0;
    const amountToAdd = Number(amount);
    const newDaTT = Math.max(currentDaTT - amountToAdd, 0);
    
    // Cập nhật da_thanh_toan (giảm đi để tăng công nợ)
    await ExportHistory.findByIdAndUpdate(latestOrder._id, {
      da_thanh_toan: newDaTT
});

    // Tính lại tổng công nợ
    const allOrders = await ExportHistory.find(query);
    let totalDebt = 0;
    allOrders.forEach(order => {
      const priceSell = parseFloat(order.price_sell) || 0;
      const quantity = parseInt(order.quantity) || 1;
      const daTT = parseFloat(order.da_thanh_toan) || 0;
      totalDebt += Math.max((priceSell * quantity) - daTT, 0);
    });

    res.json({ 
      message: `✅ Đã cộng nợ ${amountToAdd.toLocaleString()}đ cho khách hàng ${customer_name}`,
      added_amount: amountToAdd,
      total_debt: totalDebt
    });

    // Ghi sổ quỹ: chi công nợ (cộng nợ)
    try {
      await Cashbook.create({
        type: 'chi',
        amount: Number(amountToAdd),
        content: `Cộng nợ khách: ${customer_name}`,
        note: note || '',
        date: new Date(),
        branch: branch || '',
        source: 'cong_no',
        customer: customer_name,
        related_type: 'tra_no',
        is_auto: true,
        editable: false
      });
    } catch (e) { /* ignore */ }
  } catch (err) {
    console.error('❌ Error in cong-no-add-customer:', err);
    res.status(500).json({ message: '❌ Lỗi server khi cộng nợ', error: err.message });
  }
});

// ✅ API lấy danh sách nhà cung cấp còn công nợ (tính từ Inventory)
router.get('/supplier-debt-list', async (req, res) => {
  try {
    const { search = "", show_all = "false" } = req.query;
    
    let query = {
      supplier: { $ne: null, $ne: "" }
    };

    // Thêm tìm kiếm theo tên hoặc sđt
    if (search.trim()) {
      query.$or = [
        { supplier: { $regex: search, $options: 'i' } },
        { supplier_phone: { $regex: search, $options: 'i' } }
      ];
    }

    const inventoryItems = await Inventory.find(query);
    console.log(`🔍 Found ${inventoryItems.length} inventory items for supplier debt calculation`);

    // Gom nhóm theo supplier + supplier_phone
    const grouped = {};
    inventoryItems.forEach(item => {
      const key = item.supplier + "|" + (item.supplier_phone || "");
      if (!grouped[key]) {
        grouped[key] = {
          supplier_name: item.supplier,
          supplier_phone: item.supplier_phone || "",
          total_debt: 0,
          total_paid: 0,
          total_import_price: 0,
          debt_history: [],
          product_list: []
        };
      }
      
      // Tính công nợ từ logic: (price_import × quantity) - da_thanh_toan_nhap
      const priceImport = parseFloat(item.price_import) || 0;
      const quantity = parseInt(item.quantity) || 1;
      const daTT = parseFloat(item.da_thanh_toan_nhap) || 0;
      const congNo = Math.max((priceImport * quantity) - daTT, 0);
      
      // Tổng giá nhập (TẤT CẢ đơn) = giá nhập × số lượng
      grouped[key].total_import_price += (priceImport * quantity);
      
      // Tổng đã trả (TẤT CẢ đơn)
      grouped[key].total_paid += daTT;
      
      // CHỈ TÍNH CÔNG NỢ CHO CÁC ĐƠN CÒN NỢ
      if (congNo > 0) {
        grouped[key].total_debt += congNo;
      }

      // Thêm sản phẩm chi tiết (chỉ đơn còn nợ hoặc show_all=true)
      if (congNo > 0 || show_all === "true") {
        grouped[key].product_list.push({
          _id: item._id,
          imei: item.imei,
          product_name: item.product_name,
          price_import: priceImport,
          da_thanh_toan_nhap: daTT,
          remaining_debt: congNo,
          import_date: item.import_date
        });
      }
    });

    // Hiển thị NCC có giao dịch (có tổng giá nhập > 0)
    let result = Object.values(grouped).filter(supplier => supplier.total_import_price > 0);
    
    // Nếu không show_all, chỉ hiển thị NCC còn nợ
    if (show_all !== "true") {
      result = result.filter(supplier => supplier.total_debt > 0);
    }

    res.json({ 
      suppliers: result,
      items: result // Để tương thích với frontend
    });
  } catch (err) {
    console.error('❌ Error in supplier-debt-list:', err);
    res.status(500).json({ message: '❌ Lỗi server khi lấy nợ NCC', error: err.message });
  }
});

// ✅ API trả nợ nhà cung cấp
router.put('/supplier-debt-pay', async (req, res) => {
  try {
  const { supplier_name, amount, note, branch, payments = [] } = req.body;
    
    if (!supplier_name || !amount || isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({ message: "❌ Thông tin không hợp lệ" });
    }
  
    const query = { supplier: supplier_name };
    const orders = await Inventory.find(query).sort({ import_date: 1 });

    const hasPayments = Array.isArray(payments) && payments.length > 0;
    const totalInput = hasPayments ? payments.reduce((s, p) => s + Number(p?.amount || 0), 0) : Number(amount);
    if (!totalInput || isNaN(totalInput) || Number(totalInput) <= 0) {
      return res.status(400).json({ message: "❌ Số tiền trả phải lớn hơn 0" });
    }

    let remain = Number(totalInput);
    let totalPaid = 0;

    for (const order of orders) {
      if (remain <= 0) break;
      
      const priceImport = parseFloat(order.price_import) || 0;
      const currentDaTT = parseFloat(order.da_thanh_toan_nhap) || 0;
      const currentDebt = Math.max(priceImport - currentDaTT, 0);
      
      if (currentDebt <= 0) continue;
      
      const toPay = Math.min(remain, currentDebt);
      const newDaTT = currentDaTT + toPay;
      
      await Inventory.findByIdAndUpdate(order._id, {
        da_thanh_toan_nhap: newDaTT
      });
      
      remain -= toPay;
      totalPaid += toPay;
    }

    res.json({
      message: `✅ Đã trả nợ ${totalPaid.toLocaleString()}đ cho NCC ${supplier_name}`,
      paid_amount: totalPaid
    });

    // Ghi sổ quỹ: chi tiền trả NCC theo payments
    try {
      const payList = hasPayments ? payments : [{ source: 'tien_mat', amount: totalPaid }];
      for (const p of payList) {
        if (!p || !p.amount) continue;
        await Cashbook.create({
          type: 'chi',
          amount: Number(p.amount),
          content: `Trả nợ NCC: ${supplier_name}`,
          note: note || '',
          date: new Date(),
          branch: branch || '',
          source: p.source || 'tien_mat',
          supplier: supplier_name,
          related_type: 'tra_no_ncc',
          is_auto: true,
          editable: false
        });
      }
    } catch (e) { /* ignore */ }
  } catch (err) {
    console.error('❌ Error in supplier-debt-pay:', err);
    res.status(500).json({ message: '❌ Lỗi server khi trả nợ NCC', error: err.message });
  }
});

// ✅ API cộng nợ nhà cung cấp
router.put('/supplier-debt-add', async (req, res) => {
  try {
  const { supplier_name, amount, note, branch } = req.body;
    
    if (!supplier_name || !amount || isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({ message: "❌ Thông tin không hợp lệ" });
    }

    const query = { supplier: supplier_name };
    const latestOrder = await Inventory.findOne(query).sort({ import_date: -1 });

    if (!latestOrder) {
      return res.status(404).json({ message: "❌ Không tìm thấy đơn nhập của NCC này" });
    }
    
    const currentDaTT = parseFloat(latestOrder.da_thanh_toan_nhap) || 0;
    const amountToAdd = Number(amount);
    const newDaTT = Math.max(currentDaTT - amountToAdd, 0);
    
    await Inventory.findByIdAndUpdate(latestOrder._id, {
      da_thanh_toan_nhap: newDaTT
    });

    res.json({
      message: `✅ Đã cộng nợ ${amountToAdd.toLocaleString()}đ cho NCC ${supplier_name}`,
      added_amount: amountToAdd
    });

    // Ghi sổ quỹ: thu hồi (giảm chi) hoặc ghi nhận điều chỉnh nợ NCC
    try {
      await Cashbook.create({
        type: 'chi',
        amount: Number(amountToAdd),
        content: `Cộng nợ NCC: ${supplier_name}`,
        note: note || '',
        date: new Date(),
        branch: branch || '',
        source: 'cong_no',
        supplier: supplier_name,
        related_type: 'tra_no_ncc',
        is_auto: true,
        editable: false
      });
    } catch (e) { /* ignore */ }
  } catch (err) {
    console.error('❌ Error in supplier-debt-add:', err);
    res.status(500).json({ message: '❌ Lỗi server khi cộng nợ NCC', error: err.message });
  }
});

// ✅ API lấy đơn nhập của nhà cung cấp
router.get('/supplier-orders', async (req, res) => {
    const { supplier_name } = req.query;
  if (!supplier_name) return res.status(400).json({ message: "Thiếu tên nhà cung cấp" });
  
  try {
    const orders = await Inventory.find({ supplier: supplier_name }).sort({ import_date: -1 });

    const ordersWithDebt = orders.map(order => order.toObject());

    res.json({ orders: ordersWithDebt });
  } catch (err) {
    console.error('❌ Error in supplier-orders:', err);
    res.status(500).json({ message: '❌ Lỗi server khi lấy đơn NCC', error: err.message });
  }
});

// ✅ API cập nhật thông tin khách hàng và đã thanh toán
router.put('/update-customer', async (req, res) => {
  try {
    const { 
      old_customer_name, 
      old_customer_phone, 
      new_customer_name, 
      new_customer_phone, 
      da_thanh_toan 
    } = req.body;
    
    if (!old_customer_name || !new_customer_name) {
      return res.status(400).json({ message: "❌ Thiếu thông tin tên khách hàng" });
    }

    const query = { customer_name: old_customer_name };
    if (old_customer_phone) query.customer_phone = old_customer_phone;

    // Cập nhật thông tin khách hàng trong ExportHistory
    const updateData = {
      customer_name: new_customer_name.trim(),
      customer_phone: new_customer_phone.trim()
    };

    // Nếu có cập nhật da_thanh_toan, áp dụng cho đơn gần nhất
    if (da_thanh_toan && da_thanh_toan > 0) {
      const latestOrder = await ExportHistory.findOne(query).sort({ sold_date: -1 });
      if (latestOrder) {
        await ExportHistory.findByIdAndUpdate(latestOrder._id, {
          ...updateData,
          da_thanh_toan: Number(da_thanh_toan)
        });
      }
    }

    // Cập nhật tất cả records khác
    await ExportHistory.updateMany(query, updateData);

    res.json({
      message: `✅ Đã cập nhật thông tin khách hàng ${new_customer_name}`,
      updated_name: new_customer_name,
      updated_phone: new_customer_phone
    });
  } catch (err) {
    console.error('❌ Error in update-customer:', err);
    res.status(500).json({ message: '❌ Lỗi server khi cập nhật khách hàng', error: err.message });
  }
});

// ✅ API cập nhật thông tin nhà cung cấp và đã thanh toán
router.put('/update-supplier', async (req, res) => {
  try {
    const { 
      old_supplier_name, 
      old_supplier_phone, 
      new_supplier_name, 
      new_supplier_phone, 
      da_thanh_toan 
    } = req.body;
    
    if (!old_supplier_name || !new_supplier_name) {
      return res.status(400).json({ message: "❌ Thiếu thông tin tên nhà cung cấp" });
    }

    const query = { supplier: old_supplier_name };

    // Cập nhật thông tin nhà cung cấp trong Inventory
    const updateData = {
      supplier: new_supplier_name.trim(),
      supplier_phone: new_supplier_phone.trim()
    };

    // Nếu có cập nhật da_thanh_toan_nhap, áp dụng cho đơn gần nhất
    if (da_thanh_toan && da_thanh_toan > 0) {
      const latestOrder = await Inventory.findOne(query).sort({ import_date: -1 });
      if (latestOrder) {
        await Inventory.findByIdAndUpdate(latestOrder._id, {
          ...updateData,
          da_thanh_toan_nhap: Number(da_thanh_toan)
        });
      }
    }

    // Cập nhật tất cả records khác
    await Inventory.updateMany(query, updateData);

    res.json({
      message: `✅ Đã cập nhật thông tin nhà cung cấp ${new_supplier_name}`,
      updated_name: new_supplier_name,
      updated_phone: new_supplier_phone
    });
  } catch (err) {
    console.error('❌ Error in update-supplier:', err);
    res.status(500).json({ message: '❌ Lỗi server khi cập nhật nhà cung cấp', error: err.message });
  }
});

module.exports = router;
