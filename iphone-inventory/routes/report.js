const express = require('express');
const router = express.Router();
const Inventory = require('../models/Inventory');
const ExportHistory = require('../models/ExportHistory');
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

    // Format orders để đảm bảo frontend hiển thị đúng
    const formattedOrders = soldItems.map(item => ({
      _id: item._id,
      imei: item.imei,
      sku: item.sku,
      tenSanPham: item.tenSanPham || item.product_name,
      product_name: item.product_name || item.tenSanPham,
      branch: item.branch,
      category: item.category,
      sold_date: item.sold_date,
      // Mapping các field giá cho frontend
      import_price: item.price_import || item.giaNhap || 0,
      sale_price: item.price_sell || item.giaBan || 0,
      cost: item.price_import || item.giaNhap || 0,
      revenue: item.price_sell || item.giaBan || 0,
      // Thông tin khách hàng
      buyer_name: item.customer_name || item.khachHang,
      buyer_phone: item.customer_phone || item.sdt,
      customer_name: item.customer_name || item.khachHang,
      customer_phone: item.customer_phone || item.sdt,
      // Thông tin khác
      warranty: item.warranty,
      note: item.note,
      debt: item.debt || 0,
      supplier: item.supplier
    }));

    res.status(200).json({
      message: '✅ Báo cáo lợi nhuận',
      totalDevicesSold,
      totalRevenue,
      totalCost,
      totalProfit,
      orders: formattedOrders,
      items: formattedOrders // Backup field name
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

// ==================== API: Xuất hàng (iPhone & phụ kiện) ====================
router.post('/xuat-hang', async (req, res) => {
  try {
    const {
      imei,
      sku,
      product_name,
      quantity,
      warranty,
      sale_price,
      buyer_name,
      buyer_phone,
      branch,
      note,
      source,
      sale_date
    } = req.body;

    // Validation cơ bản
    if (!sale_price || isNaN(sale_price) || sale_price <= 0) {
      return res.status(400).json({ message: "❌ Giá bán không hợp lệ" });
    }

    if (imei && imei.toString().trim() !== "") {
      // ===== XUẤT iPHONE =====
      const item = await Inventory.findOneAndUpdate(
        { imei: imei.trim(), status: 'in_stock' },
        {
          $set: {
            status: 'sold',
            sold_date: sale_date ? new Date(sale_date) : new Date(),
            price_sell: parseFloat(sale_price),
            customer_name: buyer_name || "",
            customer_phone: buyer_phone || "",
            warranty: warranty || "",
            note: note || "",
            branch: branch || ""
          }
        },
        { new: true }
      );
      
      if (!item) {
        return res.status(404).json({ message: "❌ Không tìm thấy máy trong kho hoặc đã được bán" });
      }

      // ✅ Tạo ExportHistory record cho iPhone
      await ExportHistory.create({
        imei: item.imei,
        sku: item.sku,
        product_name: item.product_name || item.tenSanPham,
        quantity: 1,
        price_import: item.price_import || 0,
        price_sell: parseFloat(sale_price) || 0,
        sold_date: sale_date ? new Date(sale_date) : new Date(),
        customer_name: buyer_name || '',
        customer_phone: buyer_phone || '',
        warranty: warranty || '',
        note: note || '',
        debt: 0,
        branch: branch || item.branch || '',
        category: item.category || '',
        export_type: 'iphone'
      });

      const profit = (parseFloat(sale_price) || 0) - (item.price_import || 0);
      return res.status(200).json({ 
        message: "✅ Xuất máy thành công!", 
        profit, 
        item 
      });
    } else {
      // ===== XUẤT PHỤ KIỆN =====
      if (!sku || !product_name) {
        return res.status(400).json({ message: "❌ Thiếu SKU hoặc tên sản phẩm" });
      }
      if (!quantity || quantity < 1) {
        return res.status(400).json({ message: "❌ Số lượng không hợp lệ" });
      }

      // Tìm phụ kiện có đủ số lượng
      const accessory = await Inventory.findOne({
        sku,
        product_name,
        status: 'in_stock',
        $or: [{ imei: null }, { imei: "" }],
        quantity: { $gte: parseInt(quantity) }
      });

      if (!accessory) {
        return res.status(400).json({ message: `❌ Không đủ phụ kiện trong kho` });
      }

      // Cập nhật số lượng
      if (accessory.quantity > parseInt(quantity)) {
        // Giảm số lượng
        accessory.quantity -= parseInt(quantity);
        await accessory.save();
      } else if (accessory.quantity === parseInt(quantity)) {
        // Hết hàng - set quantity = 0 nhưng giữ status in_stock
        accessory.quantity = 0;
        await accessory.save();
      }

      // ✅ Tạo ExportHistory record cho phụ kiện
      await ExportHistory.create({
        imei: null, // Phụ kiện không có IMEI
        sku: accessory.sku,
        product_name: accessory.product_name || accessory.tenSanPham,
        quantity: parseInt(quantity),
        price_import: accessory.price_import || 0,
        price_sell: parseFloat(sale_price) || 0,
        sold_date: sale_date ? new Date(sale_date) : new Date(),
        customer_name: buyer_name || '',
        customer_phone: buyer_phone || '',
        warranty: warranty || '',
        note: note || '',
        debt: 0,
        branch: branch || accessory.branch || '',
        category: accessory.category || '',
        export_type: 'accessory'
      });

      const totalProfit = (parseFloat(sale_price) || 0) * parseInt(quantity) - (accessory.price_import || 0) * parseInt(quantity);
      
      return res.status(200).json({
        message: "✅ Xuất phụ kiện thành công!",
        profit: totalProfit,
        quantity: parseInt(quantity)
      });
    }
  } catch (err) {
    console.error("❌ Lỗi xuất hàng:", err);
    res.status(500).json({ message: "❌ Lỗi server khi xuất hàng" });
  }
});

// ==================== API: Lấy danh sách đã xuất ====================
router.get('/xuat-hang-list', async (req, res) => {
  try {
    // ✅ Query từ ExportHistory để có cả iPhone và phụ kiện đã xuất
    const rawItems = await ExportHistory.find({}).sort({ sold_date: -1 });
    
    // Debug: Log một sample để check field
    if (rawItems.length > 0) {
      console.log('Sample export history fields:', {
        price_sell: rawItems[0].price_sell,
        export_type: rawItems[0].export_type,
        all_keys: Object.keys(rawItems[0].toObject())
      });
    }
    
    // ✅ FIX: Mapping field từ ExportHistory
    const items = rawItems.map(item => ({
      _id: item._id,
      sale_date: item.sold_date || item.createdAt,
      // ✅ Giá bán từ ExportHistory
      sale_price: item.price_sell || 0,
      buyer_name: item.customer_name || '',
      buyer_phone: item.customer_phone || '',
      branch: item.branch || '',
      note: item.note || '',
      source: 'tien_mat', // Default value, có thể thêm field này vào ExportHistory sau
      warranty: item.warranty || '',
      quantity: item.quantity || 1,
      export_type: item.export_type || 'normal',
      // ✅ Thêm các field quan trọng khác
      price_import: item.price_import || 0,
      profit: (item.price_sell || 0) - (item.price_import || 0),
      debt: item.debt || 0,
      item: {
        _id: item._id,
        product_name: item.product_name,
        tenSanPham: item.product_name,
        imei: item.imei || '',
        sku: item.sku || '',
        category: item.category || '',
      }
    }));
    
    res.status(200).json({ 
      message: '✅ Danh sách xuất hàng',
      total: items.length,
      items 
    });
  } catch (error) {
    console.error('❌ Lỗi API xuat-hang-list:', error);
    res.status(500).json({ message: '❌ Lỗi lấy danh sách xuất hàng', error: error.message });
  }
});

// ==================== API: Cập nhật đơn xuất ====================
router.put('/xuat-hang/:id', async (req, res) => {
  try {
    const {
      imei,
      sku,
      product_name,
      sale_price,
      buyer_name,
      buyer_phone,
      warranty,
      note,
      branch,
      sale_date,
      source
    } = req.body;

    console.log('PUT Request data:', req.body); // Debug

    // ✅ Proper field mapping để consistent với POST API
    const updateFields = {
      status: 'sold',
      // Price fields - map to both formats
      price_sell: parseFloat(sale_price) || 0,
      giaBan: parseFloat(sale_price) || 0,
      // Customer info
      customer_name: buyer_name || '',
      customer_phone: buyer_phone || '',
      // Product info
      product_name: product_name || '',
      sku: sku || '',
      imei: imei || '',
      // Other fields
      warranty: warranty || '',
      note: note || '',
      branch: branch || '',
      source: source || 'tien_mat',
      sold_date: sale_date ? new Date(sale_date) : new Date(),
      // Update timestamp
      updatedAt: new Date()
    };

    // Remove undefined fields
    Object.keys(updateFields).forEach(key => {
      if (updateFields[key] === undefined || updateFields[key] === '') {
        delete updateFields[key];
      }
    });

    console.log('Processed update fields:', updateFields); // Debug

    const updated = await Inventory.findByIdAndUpdate(
      req.params.id, 
      { $set: updateFields }, 
      { new: true, runValidators: true }
    );
    
    if (!updated) {
      return res.status(404).json({ message: '❌ Không tìm thấy đơn xuất để cập nhật.' });
    }

    console.log('Updated item:', updated.price_sell, updated.giaBan); // Debug

    res.status(200).json({ 
      message: '✅ Đã cập nhật đơn xuất thành công!', 
      item: updated 
    });
  } catch (error) {
    console.error('❌ Error updating xuat-hang:', error);
    res.status(500).json({ message: '❌ Lỗi khi cập nhật đơn xuất', error: error.message });
  }
});

// ==================== API: Xóa đơn xuất (trả hàng về kho) ====================
router.delete('/xuat-hang/:id', async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id);
    if (!item || item.status !== 'sold') {
      return res.status(404).json({ message: '❌ Không tìm thấy đơn xuất hàng.' });
    }

    // Trả hàng về kho
    item.status = 'in_stock';
    item.price_sell = undefined;
    item.sold_date = undefined;
    item.customer_name = undefined;
    item.customer_phone = undefined;
    item.warranty = undefined;

    await item.save();

    res.status(200).json({ message: '✅ Đã chuyển hàng về tồn kho!', item });
  } catch (error) {
    res.status(500).json({ message: '❌ Lỗi khi xoá đơn xuất', error: error.message });
  }
});

// API lấy chi tiết thông tin IMEI (cho modal tồn kho)
router.get('/imei-detail/:imei', async (req, res) => {
  try {
    const { imei } = req.params;
    
    if (!imei) {
      return res.status(400).json({ message: "IMEI không được để trống" });
    }

    const item = await Inventory.findOne({ imei: imei });
    
    if (!item) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm với IMEI này" });
    }

    const detail = {
      imei: item.imei,
      product_name: item.product_name || item.tenSanPham,
      sku: item.sku,
      price_import: item.price_import,
      import_date: item.import_date,
      branch: item.branch,
      supplier: item.supplier,
      category: item.category,
      status: item.status,
      imported_by: item.imported_by || 'Không rõ',
      // Thông tin bán hàng (nếu đã bán)
      price_sell: item.price_sell,
      sold_date: item.sold_date,
      customer_name: item.customer_name,
      profit: item.price_sell ? (item.price_sell - item.price_import) : null
    };

    res.json({ item: detail });
  } catch (err) {
    res.status(500).json({ message: '❌ Lỗi server khi lấy chi tiết IMEI', error: err.message });
  }
});

module.exports = router;
