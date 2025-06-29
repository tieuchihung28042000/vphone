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

    // LẤY TỪ Inventory với status = 'sold', KHÔNG PHẢI ExportHistory!
    const soldItems = await Inventory.find({ 
      status: 'sold',
      sold_date: query.sold_date,
      ...(query.branch ? { branch: query.branch } : {})
    });

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
        return res.status(400).json({ message: `❌ Không đủ phụ kiện trong kho (còn ${acc?.quantity || 0}, cần ${quantity})` });
      }

      let updateObj = {};
      let soldAccessory = null;
      if (acc.quantity > quantity) {
        // Giảm số lượng, giữ trạng thái in_stock
        updateObj = { $inc: { quantity: -quantity } };
        soldAccessory = await Inventory.findByIdAndUpdate(acc._id, updateObj, { new: true });
      } else if (acc.quantity === quantity) {
        // Hết đúng: cập nhật quantity = 0 NHƯNG VẪN GIỮ status = 'in_stock'
        updateObj = {
          $set: {
            quantity: 0,
            // KHÔNG thay đổi status, giữ in_stock để có thể trả hàng về sau
          }
        };
        soldAccessory = await Inventory.findByIdAndUpdate(acc._id, updateObj, { new: true });
      } else {
        return res.status(400).json({ message: `❌ Số lượng không hợp lệ` });
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
    const {
      imei,
      sku,
      product_name,
      price_sell,
      sale_price,    // ✅ Thêm field từ frontend
      customer_name,
      customer_phone,
      buyer_name,    // ✅ Thêm field từ frontend  
      buyer_phone,   // ✅ Thêm field từ frontend
      warranty,
      note,
      branch,
      sold_date,
      sale_date,     // ✅ Thêm field từ frontend
      source,
      debt
    } = req.body;

    console.log('🔍 Routes PUT Request data:', req.body); // Debug

    // ✅ FIX: Flexible field mapping để support cả frontend và backend fields
    const finalSalePrice = parseFloat(sale_price || price_sell) || 0;
    const finalCustomerName = buyer_name || customer_name || '';
    const finalCustomerPhone = buyer_phone || customer_phone || '';
    const finalSaleDate = sale_date || sold_date;

    console.log('🔍 Field mapping debug:', {
      sale_price, price_sell, finalSalePrice,
      buyer_name, customer_name, finalCustomerName
    }); // Debug

    const updateFields = {
      status: 'sold',
      // Price fields - ưu tiên field từ frontend
      price_sell: finalSalePrice,
      giaBan: finalSalePrice,
      // Customer info - ưu tiên field từ frontend
      customer_name: finalCustomerName,
      customer_phone: finalCustomerPhone,
      // Product info  
      product_name: product_name || '',
      sku: sku || '',
      imei: imei || '',
      // Other fields
      warranty: warranty || '',
      note: note || '',
      branch: branch || '',
      source: source || 'tien_mat',
      sold_date: finalSaleDate ? new Date(finalSaleDate) : new Date(),
      debt: parseFloat(debt) || 0,
      updatedAt: new Date()
    };

    // Remove empty fields
    Object.keys(updateFields).forEach(key => {
      if (updateFields[key] === undefined || updateFields[key] === '') {
        delete updateFields[key];
      }
    });

    // Ensure at least one field to update
    if (Object.keys(updateFields).length === 0) {
      updateFields.updatedAt = new Date();
    }

    console.log('🔍 Routes processed update fields:', updateFields); // Debug

    const updated = await Inventory.findByIdAndUpdate(
      req.params.id, 
      { $set: updateFields }, 
      { new: true }
    );
    
    if (!updated) {
      return res.status(404).json({ message: "❌ Không tìm thấy đơn xuất để cập nhật." });
    }

    console.log('✅ Routes PUT update successful:', updated.product_name); // Debug
    res.json({ message: "✅ Đã cập nhật đơn xuất thành công!", item: updated });
  } catch (err) {
    console.error('❌ Routes PUT error:', err);
    res.status(500).json({ message: "❌ Lỗi khi cập nhật đơn xuất", error: err.message });
  }
});

// DELETE route đã chuyển sang server.js để tránh conflict



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

// ==================== API: Migration data từ Inventory cũ sang ExportHistory ====================
router.post('/migrate-export-history', async (req, res) => {
  try {
    console.log('�� Starting migration check from Inventory to ExportHistory...');
    
    // ✅ Lấy tất cả records từ ExportHistory để so sánh
    const exportHistoryItems = await ExportHistory.find({});
    console.log(`📋 Found ${exportHistoryItems.length} records in ExportHistory`);
    
    // Lấy tất cả records đã bán từ Inventory để so sánh
    const soldInventoryItems = await Inventory.find({ status: 'sold' });
    console.log(`📋 Found ${soldInventoryItems.length} sold items in Inventory`);
    
    // ✅ Kiểm tra xem có record nào trong Inventory mà chưa có trong ExportHistory không
    let missingRecords = [];
    
    for (const item of soldInventoryItems) {
      // Kiểm tra xem đã có trong ExportHistory chưa
      const existingExport = await ExportHistory.findOne({
        imei: item.imei || null,
        sku: item.sku,
        product_name: item.product_name || item.tenSanPham,
        sold_date: item.sold_date
      });
      
      if (!existingExport) {
        missingRecords.push(item);
      }
    }
    
    console.log(`📋 Found ${missingRecords.length} records in Inventory that are missing in ExportHistory`);
    
    // ✅ Nếu có record thiếu thì migrate
    let migratedCount = 0;
    
    for (const item of missingRecords) {
      // Tạo record mới trong ExportHistory
      await ExportHistory.create({
        imei: item.imei || '',
        sku: item.sku || '',
        product_name: item.product_name || item.tenSanPham || '',
        quantity: 1, // iPhone luôn là 1
        price_import: item.price_import || 0,
        price_sell: item.price_sell || item.giaBan || 0,
        sold_date: item.sold_date || item.createdAt || new Date(),
        customer_name: item.customer_name || '',
        customer_phone: item.customer_phone || '',
        warranty: item.warranty || '',
        note: item.note || '',
        debt: item.debt || 0,
        branch: item.branch || '',
        category: item.category || '',
        export_type: item.imei ? 'normal' : 'accessory',
        is_accessory: !item.imei // Phụ kiện không có IMEI
      });
      
      migratedCount++;
      console.log(`✅ Migrated: ${item.product_name || item.tenSanPham} (${item.imei || item.sku})`);
    }
    
    console.log(`🎉 Migration check completed: ${migratedCount} records migrated`);
    res.status(200).json({ 
      message: `✅ Migration check hoàn tất! ${migratedCount > 0 ? `Đã chuyển ${migratedCount} records từ Inventory sang ExportHistory.` : 'Tất cả dữ liệu đã được đồng bộ.'}`,
      migratedCount,
      totalExportHistory: exportHistoryItems.length,
      totalSoldInventory: soldInventoryItems.length,
      missingRecords: missingRecords.length
    });
  } catch (error) {
    console.error('❌ Migration error:', error);
    res.status(500).json({ message: '❌ Lỗi khi migration dữ liệu', error: error.message });
  }
});

module.exports = router;
