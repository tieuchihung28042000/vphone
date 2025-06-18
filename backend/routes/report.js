const express = require('express');
const router = express.Router();
const Inventory = require('../models/Inventory');
const ExportHistory = require('../models/ExportHistory'); // Thêm dòng này
const { sendResetPasswordEmail } = require('../utils/mail');

// ==================== API: Báo cáo lợi nhuận có lọc ====================
router.get('/bao-cao-loi-nhuan', async (req, res) => {
  try {
    const { from, to, branch } = req.query;

    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setDate(toDate.getDate() + 1);

    const query = {
      sold_date: { $gte: fromDate, $lt: toDate }
    };
    if (branch && branch !== 'all') query.branch = branch;

    // LẤY TỪ ExportHistory, KHÔNG PHẢI Inventory!
    const soldItems = await ExportHistory.find(query);

    const totalDevicesSold = soldItems.length;
    const totalRevenue = soldItems.reduce(
      (sum, item) => sum + (item.price_sell || 0) * (item.quantity || 1), 0
    );
    const totalCost = soldItems.reduce(
      (sum, item) => sum + (item.price_import || 0) * (item.quantity || 1), 0
    );
    const totalProfit = totalRevenue - totalCost;

    res.status(200).json({
      message: '✅ Báo cáo lợi nhuận',
      totalDevicesSold,
      totalRevenue,
      totalCost,
      totalProfit,
      orders: soldItems
    });
  } catch (err) {
    console.error('❌ Lỗi khi lấy báo cáo lợi nhuận:', err);
    res.status(500).json({ message: '❌ Lỗi server khi lấy báo cáo' });
  }
});


// ==================== API: Báo cáo chi tiết đơn hàng đã bán (lấy từ ExportHistory) ====================
router.get('/bao-cao-don-hang-chi-tiet', async (req, res) => {
  try {
    const { from, to, branch } = req.query;
    if (!from || !to) {
      return res.status(400).json({ message: "❌ Thiếu tham số ngày" });
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setDate(toDate.getDate() + 1);

    const query = {
      sold_date: { $gte: fromDate, $lt: toDate }
    };
    if (branch && branch !== "all") {
      query.branch = branch;
    }

    // Lấy từ ExportHistory để có cả phụ kiện và iPhone
    const orders = await ExportHistory.find(query).sort({ sold_date: -1 });

    res.status(200).json({
      message: "✅ Danh sách đơn hàng chi tiết",
      orders
    });
  } catch (err) {
    console.error("❌ Lỗi khi lấy chi tiết đơn hàng:", err);
    res.status(500).json({ message: "❌ Lỗi server khi lấy chi tiết đơn hàng" });
  }
});

// ==================== API: Lấy danh sách hàng đã nhập ====================
router.get('/nhap-hang', async (req, res) => {
  try {
    const { search = "", page = 1, limit = 1000000 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {
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

// ==================== API: TỒN KHO - GỘP PHỤ KIỆN (KHÔNG IMEI) ====================
// API: TỒN KHO – GỘP PHỤ KIỆN (KHÔNG IMEI)
router.get('/ton-kho', async (req, res) => {
  try {
    // Lấy tất cả phụ kiện (IMEI null) và máy iPhone (có IMEI)
    const inventories = await Inventory.find({ status: 'in_stock' });

    // Lấy tổng xuất theo từng sku (chỉ cho phụ kiện)
    const exportAgg = await ExportHistory.aggregate([
      { $match: { imei: { $in: [null, ""] } } }, // Chỉ phụ kiện (không IMEI)
      { $group: { _id: "$sku", totalExported: { $sum: "$quantity" } } }
    ]);
    const exportMap = {};
    exportAgg.forEach(e => exportMap[e._id] = e.totalExported);

    // Gom phụ kiện thành 1 dòng duy nhất mỗi SKU
    const accessoriesMap = {};
    const imeiItems = [];
    for (const item of inventories) {
      if (item.imei) {
        imeiItems.push(item);
      } else {
        // Gom theo SKU + tên
        const key = (item.sku || '') + '|' + (item.product_name || item.tenSanPham || '');
        if (!accessoriesMap[key]) {
          accessoriesMap[key] = {
            sku: item.sku || "",
            product_name: item.product_name || item.tenSanPham || "",
            price_import: item.price_import || 0,
            import_date: item.import_date,
            supplier: item.supplier,
            branch: item.branch,
            category: item.category,
            note: item.note,
            quantity: 0, // Tổng số nhập
            soLuongConLai: 0, // Tổng tồn kho
            _id: item._id,
          };
        }
        accessoriesMap[key].quantity += Number(item.quantity) || 1;
      }
    }
    // Gán số lượng còn lại (tồn kho) cho phụ kiện
    for (const key in accessoriesMap) {
      const acc = accessoriesMap[key];
      acc.soLuongConLai = acc.quantity - (exportMap[acc.sku] || 0);
      if (acc.soLuongConLai < 0) acc.soLuongConLai = 0;
    }
    // Kết quả trả về: iPhone (IMEI riêng) + phụ kiện (mỗi loại 1 dòng)
    const accessoriesItems = Object.values(accessoriesMap);

    res.json({
      imeiItems, // Mỗi máy 1 dòng (IMEI)
      accessoriesItems, // Mỗi SKU phụ kiện 1 dòng, có tổng nhập, tồn kho động
      items: [...imeiItems, ...accessoriesItems]
    });
  } catch (err) {
    res.status(500).json({ message: "Lỗi truy vấn tồn kho", error: err.message });
  }
});



// ==================== API: Xuất hàng (iPhone & phụ kiện, ghi lịch sử) ====================
router.post('/xuat-hang', async (req, res) => {
  try {
    const {
      imei,
      sku,
      product_name,
      quantity,
      price_sell,
      customer_name,
      customer_phone,
      warranty,
      note,
      debt,
      sold_date,
      branch
    } = req.body;

    if (imei && imei.toString().trim() !== "") {
      // ===== XUẤT iPHONE =====
      const item = await Inventory.findOneAndUpdate(
        { imei: imei.trim(), status: 'in_stock' },
        {
          $set: {
            status: 'sold',
            sold_date: sold_date ? new Date(sold_date) : new Date(),
            price_sell,
            customer_name,
            customer_phone,
            warranty,
            note,
            debt: debt || 0,
            branch
          }
        },
        { new: true }
      );
      if (!item) {
        return res.status(404).json({ message: "❌ Không tìm thấy máy trong kho" });
      }

      // === GHI LỊCH SỬ XUẤT iPHONE ===
      await ExportHistory.create({
        imei,
        sku: item.sku,
        product_name: item.product_name || item.tenSanPham,
        quantity: 1,
        price_import: item.price_import || item.giaNhap || 0,
        price_sell: price_sell || item.price_sell,
        sold_date: sold_date ? new Date(sold_date) : new Date(),
        customer_name,
        customer_phone,
        warranty,
        note,
        debt: debt || 0,
        branch,
        category: item.category || "",
        export_type: "iphone",
      });

      const profit = (item.price_sell || item.giaBan || 0) - (item.price_import || item.giaNhap || 0);
      return res.status(200).json({ message: "✅ Xuất máy thành công!", profit, item });
    } else {
      // ===== XUẤT PHỤ KIỆN =====
      if (!sku || !product_name) {
        return res.status(400).json({ message: "❌ Thiếu thông tin sản phẩm phụ kiện" });
      }
      if (!quantity || quantity < 1) {
        return res.status(400).json({ message: "❌ Số lượng phụ kiện không hợp lệ" });
      }

      // Tìm 1 dòng phụ kiện còn quantity đủ
      const acc = await Inventory.findOne({
        sku,
        product_name,
        status: 'in_stock',
        $or: [{ imei: null }, { imei: "" }],
        quantity: { $gte: quantity }
      });
      if (!acc) {
        return res.status(400).json({ message: `❌ Không đủ phụ kiện trong kho` });
      }

      let updateObj = {};
      let soldAccessory = null;
      if (acc.quantity > quantity) {
        // Giảm số lượng
        updateObj = { $inc: { quantity: -quantity } };
        soldAccessory = await Inventory.findByIdAndUpdate(acc._id, updateObj, { new: true });
      } else {
        // Hết sạch: chuyển trạng thái sold
        updateObj = {
          $set: {
            status: 'sold',
            sold_date: sold_date ? new Date(sold_date) : new Date(),
            price_sell,
            customer_name,
            customer_phone,
            warranty,
            note,
            debt: debt || 0,
            branch
          }
        };
        soldAccessory = await Inventory.findByIdAndUpdate(acc._id, updateObj, { new: true });
      }

      // === GHI LỊCH SỬ XUẤT PHỤ KIỆN ===
      await ExportHistory.create({
        imei: null,
        sku: acc.sku,
        product_name: acc.product_name || acc.tenSanPham,
        quantity: quantity,
        price_import: acc.price_import || 0,
        price_sell: price_sell || 0,
        sold_date: sold_date ? new Date(sold_date) : new Date(),
        customer_name,
        customer_phone,
        warranty,
        note,
        debt: debt || 0,
        branch,
        category: acc.category || "",
        export_type: "accessory",
      });

      let totalProfit = (price_sell || 0) * quantity - (acc.price_import || 0) * quantity;
      return res.status(200).json({
        message: "✅ Xuất phụ kiện thành công!",
        profit: totalProfit,
        quantity
      });
    }
  } catch (err) {
    console.error("❌ Lỗi xuất hàng:", err);
    res.status(500).json({ message: "❌ Lỗi server khi xuất hàng" });
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
// ==================== API: Cập nhật đơn xuất ====================
router.put('/xuat-hang/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const updateData = req.body;
    const updated = await ExportHistory.findByIdAndUpdate(id, updateData, { new: true });
    if (!updated) return res.status(404).json({ message: "❌ Không tìm thấy đơn xuất để cập nhật." });
    res.json({ message: "✅ Đã cập nhật đơn xuất", item: updated });
  } catch (err) {
    res.status(500).json({ message: "❌ Lỗi khi cập nhật đơn xuất", error: err.message });
  }
});

// ==================== API: Xoá đơn xuất ====================
// ==================== API: Xoá đơn xuất ====================
// ===================== API: Xoá đơn xuất =====================
router.delete('/xuat-hang/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const deleted = await ExportHistory.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: "❌ Không tìm thấy đơn xuất" });

    // ===== Nếu là xuất iPhone (có IMEI) thì trả lại trạng thái in_stock =====
    if (deleted.imei) {
      await Inventory.updateOne(
        { imei: deleted.imei },
        { $set: { status: "in_stock" } }
      );
    } else {
      // ===== Nếu là xuất phụ kiện (không IMEI) thì hoàn lại số lượng =====
      const filter = { sku: deleted.sku, status: "in_stock" };
      let inventory = await Inventory.findOne(filter);

      if (inventory) {
        // Nếu còn bản ghi thì cộng lại số lượng
        inventory.quantity += deleted.quantity;
        await inventory.save();
      } else {
        // Nếu không còn (đã bán hết hoặc bị xoá), thì tạo lại bản ghi mới với số lượng trả lại
        await Inventory.create({
          sku: deleted.sku,
          product_name: deleted.product_name,
          price_import: deleted.price_import || 0,
          import_date: deleted.import_date || new Date(),
          supplier: deleted.supplier || "",
          branch: deleted.branch || "",
          note: deleted.note || "",
          quantity: deleted.quantity,
          category: deleted.category || "",
          tenSanPham: deleted.tenSanPham || "",
          status: "in_stock"
        });
      }
    }
    // ===============================================================

    res.json({ message: "✅ Đã xoá đơn xuất và hoàn lại tồn kho nếu là phụ kiện" });
  } catch (err) {
    res.status(500).json({ message: "❌ Lỗi khi xoá đơn xuất", error: err.message });
  }
});



// API: Tìm sản phẩm theo IMEI (bất kể đã bán hay chưa)
router.get('/find-by-imei', async (req, res) => {
  try {
    const { imei } = req.query;
    if (!imei) return res.status(400).json({ message: 'Thiếu IMEI' });

    // Tìm bất kỳ sản phẩm nào có IMEI này, không cần quan tâm status
    const product = await Inventory.findOne({ imei });
    if (!product) return res.status(404).json({ message: "Không tìm thấy IMEI" });

    res.json(product);
  } catch (err) {
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
});

module.exports = router;
