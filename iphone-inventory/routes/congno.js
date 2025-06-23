const express = require('express');
const router = express.Router();
const Inventory = require('../models/Inventory');

// 1. Lấy danh sách khách hàng còn công nợ (Tổng hợp theo customer_name + customer_phone)
router.get('/cong-no-list', async (req, res) => {
  try {
    const { search = "", show_all = "false" } = req.query;
    
    let query = {
      status: "sold",
      customer_name: { $ne: null, $ne: "" }
    };

    // Thêm tìm kiếm theo tên hoặc sđt
    if (search.trim()) {
      query.$or = [
        { customer_name: { $regex: search, $options: 'i' } },
        { customer_phone: { $regex: search, $options: 'i' } }
      ];
    }

    const items = await Inventory.find(query);

    // Gom nhóm theo customer_name + customer_phone
    const grouped = {};
    items.forEach(item => {
      const key = item.customer_name + "|" + (item.customer_phone || "");
      if (!grouped[key]) {
        grouped[key] = {
          customer_name: item.customer_name,
          customer_phone: item.customer_phone || "",
          total_debt: 0,
          total_paid: 0,
          debt_history: [],
          product_list: []
        };
      }
      grouped[key].total_debt += item.debt || 0;
      grouped[key].total_paid += item.da_tra || 0;

      // Gom lịch sử trả nợ/cộng nợ
      if (item.debt_history && Array.isArray(item.debt_history)) {
        grouped[key].debt_history = grouped[key].debt_history.concat(item.debt_history);
      }

      // Thêm sản phẩm chi tiết
      grouped[key].product_list.push({
        imei: item.imei,
        product_name: item.product_name,
        price_sell: item.price_sell,
        sold_date: item.sold_date,
        debt: item.debt,
        da_tra: item.da_tra
      });
    });

    Object.values(grouped).forEach(group => {
      group.debt_history = group.debt_history.sort((a, b) =>
        new Date(b.date) - new Date(a.date)
      );
    });

    // Chỉ hiển thị khách còn nợ (trừ khi show_all=true)
    let result = Object.values(grouped);
    if (show_all !== "true") {
      result = result.filter(customer => customer.total_debt > 0);
    }

    res.json({ items: result });
  } catch (err) {
    res.status(500).json({ message: '❌ Lỗi server khi lấy công nợ', error: err.message });
  }
});

// 2. Lấy danh sách đơn còn nợ của 1 khách hàng (theo tên + sđt)
router.get('/cong-no-orders', async (req, res) => {
  const { customer_name, customer_phone } = req.query;
  if (!customer_name) return res.status(400).json({ message: "Thiếu tên khách hàng" });
  try {
    const query = {
      customer_name,
      status: "sold",
      debt: { $gt: 0 }
    };
    if (customer_phone) query.customer_phone = customer_phone;
    const orders = await Inventory.find(query).sort({ sold_date: -1 });
    res.json({ orders });
  } catch (err) {
    res.status(500).json({ message: '❌ Lỗi server khi lấy đơn nợ', error: err.message });
  }
});

// 3. Trừ nợ tổng cho từng khách (theo tên + sđt, cho phép trừ tổng nhiều đơn) -- CÓ GHI CHÚ
router.put('/cong-no-pay-customer', async (req, res) => {
  const { customer_name, customer_phone, amount, note } = req.body;
  if (!customer_name || !amount || isNaN(amount)) return res.status(400).json({ message: "Thiếu thông tin hoặc số tiền trả" });
  try {
    const query = { customer_name, status: "sold", debt: { $gt: 0 } };
    if (customer_phone) query.customer_phone = customer_phone;
    const orders = await Inventory.find(query).sort({ sold_date: 1 });

    let remain = Number(amount);
    let total_paid = 0;
    let total_debt = 0;
    let debt_history = [];

    for (const order of orders) {
      if (remain <= 0) break;
      const toPay = Math.min(remain, order.debt);
      order.da_tra = (order.da_tra || 0) + toPay;
      order.debt = (order.debt || 0) - toPay;

      // Lưu lịch sử trừ nợ
      if (!order.debt_history) order.debt_history = [];
      order.debt_history.push({
        type: "pay",
        amount: toPay,
        date: new Date(),
        note: note || ""
      });

      await order.save();
      remain -= toPay;
    }

    // Sau khi cập nhật, tính lại tổng nợ/tổng trả
    const allOrders = await Inventory.find(query);
    allOrders.forEach(item => {
      total_paid += item.da_tra || 0;
      total_debt += item.debt || 0;
      if (item.debt_history) debt_history = debt_history.concat(item.debt_history);
    });

    debt_history = debt_history.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json({
      message: "Đã cập nhật công nợ!",
      total_debt,
      total_paid,
      debt_history
    });
  } catch (err) {
    res.status(500).json({ message: '❌ Lỗi server khi cập nhật nợ', error: err.message });
  }
});

// 4. Cộng nợ tổng cho khách (theo tên + sđt, cộng vào đơn mới nhất) -- CÓ GHI CHÚ
router.put('/cong-no-add-customer', async (req, res) => {
  const { customer_name, customer_phone, amount, note } = req.body;
  if (!customer_name || !amount || isNaN(amount)) return res.status(400).json({ message: "Thiếu thông tin hoặc số tiền cộng nợ" });
  try {
    // Cộng nợ vào đơn còn nợ nhiều nhất, hoặc đơn mới nhất
    const query = { customer_name, status: "sold" };
    if (customer_phone) query.customer_phone = customer_phone;
    const order = await Inventory.findOne(query).sort({ sold_date: -1 });

    if (!order) return res.status(404).json({ message: "Không tìm thấy đơn để cộng nợ" });

    order.debt = (order.debt || 0) + Number(amount);
    if (!order.debt_history) order.debt_history = [];
    order.debt_history.push({
      type: "add",
      amount: Number(amount),
      date: new Date(),
      note: note || ""
    });

    await order.save();

    // Tính lại tổng sau cộng nợ
    const orders = await Inventory.find(query);
    let total_paid = 0, total_debt = 0, debt_history = [];
    orders.forEach(item => {
      total_paid += item.da_tra || 0;
      total_debt += item.debt || 0;
      if (item.debt_history) debt_history = debt_history.concat(item.debt_history);
    });
    debt_history = debt_history.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({
      message: "Đã cộng thêm nợ!",
      total_debt,
      total_paid,
      debt_history
    });
  } catch (err) {
    res.status(500).json({ message: '❌ Lỗi server khi cộng nợ', error: err.message });
  }
});

// 5. Trả nợ/cộng nợ từng đơn (nếu frontend vẫn dùng nút trừ/cộng từng đơn thì giữ lại API này) -- CÓ GHI CHÚ
router.put('/cong-no-pay/:id', async (req, res) => {
  const { amount, note } = req.body;
  if (!amount || isNaN(amount)) return res.status(400).json({ message: "Thiếu số tiền trả" });
  try {
    const order = await Inventory.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Không tìm thấy đơn nợ" });

    const tra = Number(amount);
    if (tra <= 0) return res.status(400).json({ message: "Số tiền trả phải > 0" });
    if ((order.debt || 0) <= 0) return res.status(400).json({ message: "Đơn này không còn công nợ" });

    order.da_tra = (order.da_tra || 0) + tra;
    order.debt = Math.max((order.debt || 0) - tra, 0);

    if (!order.debt_history) order.debt_history = [];
    order.debt_history.push({
      type: "pay",
      amount: tra,
      date: new Date(),
      note: note || ""
    });

    await order.save();
    res.json({ message: "Đã cập nhật công nợ!", order });
  } catch (err) {
    res.status(500).json({ message: '❌ Lỗi server khi cập nhật nợ', error: err.message });
  }
});

// 6. Sửa thông tin khách hàng (tên, sđt)
router.put('/update-customer', async (req, res) => {
  const { old_customer_name, old_customer_phone, new_customer_name, new_customer_phone } = req.body;
  if (!old_customer_name || !new_customer_name) {
    return res.status(400).json({ message: "Thiếu thông tin tên khách hàng" });
  }
  try {
    const query = { customer_name: old_customer_name };
    if (old_customer_phone) query.customer_phone = old_customer_phone;

    const updateResult = await Inventory.updateMany(
      query,
      {
        $set: {
          customer_name: new_customer_name,
          customer_phone: new_customer_phone || ""
        }
      }
    );

    res.json({ 
      message: "✅ Đã cập nhật thông tin khách hàng!",
      modified_count: updateResult.modifiedCount
    });
  } catch (err) {
    res.status(500).json({ message: '❌ Lỗi server khi cập nhật thông tin khách hàng', error: err.message });
  }
});

// 7. Xóa khách hàng khỏi công nợ (xóa tất cả debt và debt_history)
router.delete('/delete-customer', async (req, res) => {
  const { customer_name, customer_phone } = req.body;
  if (!customer_name) return res.status(400).json({ message: "Thiếu tên khách hàng" });
  try {
    const query = { customer_name, status: "sold" };
    if (customer_phone) query.customer_phone = customer_phone;

    const updateResult = await Inventory.updateMany(
      query,
      {
        $set: {
          debt: 0,
          da_tra: 0
        },
        $unset: {
          debt_history: ""
        }
      }
    );

    res.json({ 
      message: "✅ Đã xóa công nợ của khách hàng!",
      modified_count: updateResult.modifiedCount
    });
  } catch (err) {
    res.status(500).json({ message: '❌ Lỗi server khi xóa công nợ khách hàng', error: err.message });
  }
});

module.exports = router;
