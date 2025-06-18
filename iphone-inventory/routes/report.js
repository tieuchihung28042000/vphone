const express = require('express');
const router = express.Router();
const Inventory = require('../models/Inventory');
const { sendResetPasswordEmail } = require('../utils/mail');

// ==================== API: Báo cáo lợi nhuận có lọc ====================
router.get('/bao-cao-loi-nhuan', async (req, res) => {
  try {
    const { from, to, branch } = req.query;

    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setDate(toDate.getDate() + 1); // Bao gồm cả ngày cuối cùng

    const query = {
      status: 'sold',
      sold_date: { $gte: fromDate, $lt: toDate }
    };

    if (branch && branch !== 'all') {
      query.branch = branch;
    }

    const soldItems = await Inventory.find(query);

    const totalDevicesSold = soldItems.length;
    // Hỗ trợ cả 2 kiểu trường giá (giaBan hoặc price_sell, giaNhap hoặc price_import)
    const totalRevenue = soldItems.reduce(
      (sum, item) => sum + (item.giaBan || item.price_sell || 0), 0
    );
    const totalCost = soldItems.reduce(
      (sum, item) => sum + (item.giaNhap || item.price_import || 0), 0
    );
    const totalProfit = totalRevenue - totalCost;

    res.status(200).json({
      message: '✅ Báo cáo lợi nhuận',
      totalDevicesSold,
      totalRevenue,
      totalCost,
      totalProfit,
      orders: soldItems // <--- Có thể dùng cho mục đích thống kê khác
    });
  } catch (err) {
    console.error('❌ Lỗi khi lấy báo cáo lợi nhuận:', err);
    res.status(500).json({ message: '❌ Lỗi server khi lấy báo cáo' });
  }
});

// ==================== API: Báo cáo chi tiết đơn hàng đã bán ====================
router.get('/bao-cao-don-hang-chi-tiet', async (req, res) => {
  try {
    const { from, to, branch } = req.query;
    if (!from || !to) {
      return res.status(400).json({ message: "❌ Thiếu tham số ngày" });
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setDate(toDate.getDate() + 1); // Lấy hết ngày "to"

    const query = {
      status: 'sold',
      sold_date: { $gte: fromDate, $lt: toDate }
    };
    if (branch && branch !== "all") {
      query.branch = branch;
    }

    const orders = await Inventory.find(query).sort({ sold_date: -1 });

    // Chuẩn hóa field cho frontend
    const result = orders.map(item => ({
      _id: item._id,
      sku: item.sku,
      product_name: item.product_name || item.tenSanPham,
      sold_date: item.sold_date,
      customer_name: item.customer_name || item.khachHang || "Khách lẻ",
      price_import: item.giaNhap || item.price_import || 0,
      price_sell: item.giaBan || item.price_sell || 0
    }));

    res.status(200).json({
      message: "✅ Danh sách đơn hàng chi tiết",
      orders: result
    });
  } catch (err) {
    console.error("❌ Lỗi khi lấy chi tiết đơn hàng:", err);
    res.status(500).json({ message: "❌ Lỗi server khi lấy chi tiết đơn hàng" });
  }
});

// ==================== API: Lấy danh sách hàng đã nhập ====================
router.get('/nhap-hang', async (req, res) => {
  try {
    const { search = "", page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {
      status: 'in_stock',
      $or: [
        { imei: { $regex: search, $options: 'i' } },
        { tenSanPham: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } }
      ]
    };

    const total = await Inventory.countDocuments(query);
    const items = await Inventory.find(query)
      .sort({ import_date: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      message: "✅ Danh sách hàng đã nhập",
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      items
    });
  } catch (error) {
    console.error("❌ Lỗi khi lấy danh sách nhập hàng:", error);
    res.status(500).json({ message: "❌ Lỗi server", error: error.message });
  }
});

// ==================== API: Gửi email reset mật khẩu ====================
router.post('/send-reset-link', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: '❌ Vui lòng nhập email' });
  }

  try {
    const resetLink = `http://localhost:5173/reset-mat-khau?email=${encodeURIComponent(email)}`;
    await sendResetPasswordEmail(email, resetLink);

    res.status(200).json({ message: '✅ Đã gửi email đặt lại mật khẩu' });
  } catch (err) {
    console.error('❌ Gửi email lỗi:', err.message);
    res.status(500).json({ message: '❌ Gửi email thất bại', error: err.message });
  }
});
// API: Cảnh báo tồn kho phụ kiện (gộp mỗi mã 1 dòng)
router.get('/canh-bao-ton-kho', async (req, res) => {
  try {
    // Lấy toàn bộ hàng phụ kiện (không có imei) còn trong kho
    const accessories = await Inventory.find({
      status: 'in_stock',
      $or: [{ imei: null }, { imei: "" }],
    });

    // Gom nhóm theo SKU + chi nhánh
    const grouped = {};
    for (const item of accessories) {
      const key = (item.sku || "") + "|" + (item.branch || "");
      if (!grouped[key]) {
        grouped[key] = {
          sku: item.sku,
          tenSanPham: item.product_name || item.tenSanPham,
          branch: item.branch,
          totalRemain: 0,
        };
      }
      grouped[key].totalRemain += Number(item.quantity) || 0;
    }

    // Lọc ra chỉ những sản phẩm có tồn kho < 2
    const items = Object.values(grouped).filter(row => row.totalRemain < 2);

    res.json({ items });
  } catch (err) {
    res.status(500).json({ message: "Lỗi truy vấn cảnh báo tồn kho", error: err.message });
  }
});

module.exports = router;
