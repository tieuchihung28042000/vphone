import express from 'express';
import mongoose from 'mongoose';
const router = express.Router();
import Inventory from '../models/Inventory.js';
import ExportHistory from '../models/ExportHistory.js'; // Thêm dòng này
import ActivityLog from '../models/ActivityLog.js';
import { sendResetPasswordEmail } from '../utils/mail.js';
import { authenticateToken, requireReportAccess, filterByBranch } from '../middleware/auth.js';
import ReturnExport from '../models/ReturnExport.js';
import Cashbook from '../models/Cashbook.js';
import XLSX from 'xlsx';

// ==================== API: Báo cáo lợi nhuận có lọc ====================
// Bảo vệ toàn bộ router báo cáo bằng auth + chặn thu_ngan
router.use(authenticateToken, requireReportAccess, filterByBranch);

router.get('/bao-cao-loi-nhuan', async (req, res) => {
  try {
    const { from, to, branch, include_returns } = req.query;

    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setDate(toDate.getDate() + 1);

    const query = {
      sold_date: { $gte: fromDate, $lt: toDate }
    };
    if (branch && branch !== 'all') query.branch = branch;
    const { category } = req.query;
    if (category && category !== 'all') query.category = category;

    // ✅ LẤY TỪ ExportHistory; mặc định loại trừ đơn đã hoàn trả
    const finalQuery = {
      ...query,
      ...(include_returns === 'true' ? {} : { $or: [{ is_returned: { $exists: false } }, { is_returned: false }] })
    };
    const soldItems = await ExportHistory.find(finalQuery).sort({ sold_date: -1, createdAt: -1 });

    const totalDevicesSold = soldItems.length;
    const totalRevenue = soldItems.reduce(
      (sum, item) => sum + (item.price_sell || 0) * (item.quantity || 1), 0
    );
    const totalCost = soldItems.reduce(
      (sum, item) => sum + (item.price_import || 0) * (item.quantity || 1), 0
    );
    const totalProfit = totalRevenue - totalCost;

    res.status(200).json({
      message: '✅ Báo cáo lợi nhuận (từ ExportHistory)',
      totalDevicesSold,
      totalRevenue,
      totalCost,
      totalProfit,
      orders: soldItems,
      data_source: 'export_history'
    });
  } catch (err) {
    console.error('❌ Lỗi khi lấy báo cáo lợi nhuận:', err);
    res.status(500).json({ message: '❌ Lỗi server khi lấy báo cáo' });
  }
});

// ==================== API: Báo cáo tài chính 7 chỉ tiêu ====================
router.get('/financial-report/summary', async (req, res) => {
  try {
    const { from, to, branch, category } = req.query;
    if (!from || !to) {
      return res.status(400).json({ message: 'Thiếu khoảng thời gian' });
    }
    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setDate(toDate.getDate() + 1);

    const exportQuery = { sold_date: { $gte: fromDate, $lt: toDate } };
    if (branch && branch !== 'all') exportQuery.branch = branch;
    if (category && category !== 'all') exportQuery.category = category;

    const exports = await ExportHistory.find(exportQuery);
    const totalRevenue = exports.reduce((s, e) => s + (e.price_sell || 0) * (e.quantity || 1), 0);

    // Tính tổng giá vốn (giá nhập hàng) cho TẤT CẢ đơn bán trong kỳ
    const totalCostRaw = exports.reduce((s, e) => s + (e.price_import || 0) * (e.quantity || 1), 0);

    // Doanh thu trả hàng trong kỳ
    const returnQuery = { return_date: { $gte: fromDate, $lt: toDate } };
    if (branch && branch !== 'all') returnQuery.branch = branch;
    const returns = await ReturnExport.find(returnQuery);
    const totalReturnRevenue = returns.reduce((s, r) => s + (r.return_amount || 0), 0);

    // Doanh thu thuần = Doanh thu bán hàng - Doanh thu trả hàng
    const netRevenue = totalRevenue - totalReturnRevenue;

    // Giá vốn chỉ tính những đơn hàng THÀNH CÔNG (không tính phần đã trả hàng)
    let returnedCost = 0;
    if (returns.length > 0) {
      const exportIds = returns.map(r => r.original_export_id).filter(id => !!id);
      if (exportIds.length > 0) {
        const relatedExports = await ExportHistory.find({ _id: { $in: exportIds } });
        const exportMap = new Map(relatedExports.map(e => [String(e._id), e]));

        for (const r of returns) {
          const ex = exportMap.get(String(r.original_export_id));
          if (!ex) continue;
          const soldDate = ex.sold_date || ex.createdAt;
          if (!soldDate) continue;
          // Chỉ trừ giá vốn nếu đơn bán gốc thuộc cùng kỳ báo cáo
          if (soldDate >= fromDate && soldDate < toDate) {
            const qty = ex.quantity || r.quantity || 1;
            const importPrice = ex.price_import || 0;
            returnedCost += importPrice * qty;
          }
        }
      }
    }

    let totalCost = totalCostRaw - returnedCost;
    if (totalCost < 0) totalCost = 0;

    const cbQuery = { date: { $gte: fromDate, $lt: toDate } };
    if (branch && branch !== 'all') cbQuery.branch = branch;
    const cashItems = await Cashbook.find(cbQuery);

    // ✅ Chi phí chỉ tính những phiếu được tạo thủ công (không tính phiếu tự động) và có include_in_profit = true
    // ❌ KHÔNG tính nhập hàng (related_type: 'nhap_hang') - nhập hàng là giá vốn, không phải chi phí ngoài
    const totalExpense = cashItems
      .filter(i => i.type === 'chi' && i.is_auto === false && (i.include_in_profit !== false) && i.related_type !== 'nhap_hang')
      .reduce((s, i) => s + (i.amount || 0), 0);

    const otherIncome = cashItems
      // Chỉ tính thu nhập khác cho các phiếu thu tạo thủ công (manual) và có include_in_profit = true
      // Loại trừ điều chỉnh tổng quỹ (adjustment) và các phiếu tự động khác
      .filter(i => i.type === 'thu' && i.related_type === 'manual' && (i.include_in_profit !== false))
      .reduce((s, i) => s + (i.amount || 0), 0);

    // Lợi nhuận gộp = Doanh thu thuần - Giá vốn
    const grossProfit = netRevenue - totalCost;

    // Lợi nhuận thuần = Lợi nhuận gộp + Thu nhập khác - Chi phí
    const netProfit = grossProfit + otherIncome - totalExpense;

    // Giữ lại operatingProfit cho tương thích, gán bằng lợi nhuận gộp
    const operatingProfit = grossProfit;

    res.json({
      totalRevenue,
      totalReturnRevenue,
      netRevenue,
      totalCost, // Tổng giá vốn
      grossProfit, // Lợi nhuận gộp = Giá bán - giá vốn
      totalExpense,
      operatingProfit,
      otherIncome,
      netProfit
    });
  } catch (err) {
    res.status(500).json({ message: '❌ Lỗi báo cáo tài chính', error: err.message });
  }
});


// ==================== API: Báo cáo chi tiết đơn hàng đã bán (lấy từ ExportHistory) ====================
router.get('/bao-cao-don-hang-chi-tiet', async (req, res) => {
  try {
    const { from, to, branch, category } = req.query;
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
    if (category && category !== "all") {
      query.category = category;
    }

    // Lấy từ ExportHistory để có cả phụ kiện và iPhone
    const orders = await ExportHistory.find(query).sort({ sold_date: -1, createdAt: -1 });

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

    let query = {
      $or: [
        { imei: { $regex: search, $options: 'i' } },
        { tenSanPham: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } }
      ]
    };

    // Apply branch filter
    if (req.branchFilter) {
      query = { ...query, ...req.branchFilter };
    } else if (req.query.branch && req.query.branch !== 'all') {
      query.branch = req.query.branch;
    }

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
    let mongoQuery = { status: 'in_stock' };
    let soldQuery = { status: 'sold' };

    // Apply branch filter
    if (req.branchFilter) {
      mongoQuery = { ...mongoQuery, ...req.branchFilter };
      soldQuery = { ...soldQuery, ...req.branchFilter };
    } else if (req.query.branch && req.query.branch !== 'all') {
      mongoQuery.branch = req.query.branch;
      soldQuery.branch = req.query.branch;
    }

    const getImportMonth = (d) => {
      const dt = d ? new Date(d) : null;
      if (!dt || isNaN(dt)) return 'Unknown';
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    };

    // Lấy tất cả phụ kiện (IMEI null) và máy iPhone (có IMEI) - CHỈ items in_stock
    const inventories = await Inventory.find(mongoQuery);

    // ✅ TÍNH TOTAL SOLD: Lấy tất cả items đã bán để tính totalSold chính xác
    const soldInventories = await Inventory.find(soldQuery);

    // ✅ Tạo map để tính totalSold theo key (sku|product|category|branch)
    // NOTE: Frontend bản hiện tại (đang serve dist) đang gộp theo SKU + tên + category + branch (KHÔNG tách theo tháng).
    // Để số liệu "Tổng nhập" khớp với "IMEI(x)" ngay lập tức mà không cần rebuild frontend, backend cũng gộp theo key này.
    const soldCountMap = new Map();
    soldInventories.forEach((item) => {
      const uniqueKey = item.sku && item.sku.trim()
        ? item.sku
        : item.product_name || item.tenSanPham || `product_${item._id}`;
      const key = uniqueKey + "|" + (item.product_name || item.tenSanPham || "") + "|" + (item.category || "") + "|" + (item.branch || "");
      
      const isAccessory = !item.imei;
      const soldQty = isAccessory ? Number(item.quantity) || 0 : 1;
      soldCountMap.set(key, (soldCountMap.get(key) || 0) + soldQty);
    });

    // Lấy tổng xuất theo từng sku (chỉ cho phụ kiện) - từ ExportHistory
    const exportAgg = await ExportHistory.aggregate([
      { $match: { imei: { $in: [null, ""] } } }, // Chỉ phụ kiện (không IMEI)
      { $group: { _id: "$sku", totalExported: { $sum: "$quantity" } } }
    ]);
    const exportMap = {};
    exportAgg.forEach(e => exportMap[e._id] = e.totalExported);

    // ✅ Tính totalImport cho iPhone: Lấy cả in_stock và sold
    const iphoneImportMap = new Map();
    const allIphoneQuery = { 
      imei: { $exists: true, $ne: null, $ne: "" } 
    };
    // Apply branch filter nếu có
    if (req.branchFilter) {
      Object.assign(allIphoneQuery, req.branchFilter);
    } else if (req.query.branch && req.query.branch !== 'all') {
      allIphoneQuery.branch = req.query.branch;
    }
    const allIphones = await Inventory.find(allIphoneQuery); // Lấy cả in_stock và sold
    allIphones.forEach((item) => {
      const uniqueKey = item.sku && item.sku.trim()
        ? item.sku
        : item.product_name || item.tenSanPham || `product_${item._id}`;
      const groupKey = uniqueKey + "|" + (item.product_name || item.tenSanPham || "") + "|" + (item.category || "") + "|" + (item.branch || "");
      iphoneImportMap.set(groupKey, (iphoneImportMap.get(groupKey) || 0) + 1);
    });
    
    // ✅ Gom iPhone theo SKU để tính totalSold chính xác
    const iphoneGroupMap = new Map();
    const accessoriesMap = {};
    const imeiItems = [];
    
    for (const item of inventories) {
      if (item.imei) {
        // ✅ Gom iPhone theo SKU + category + branch để tính totalSold
        const uniqueKey = item.sku && item.sku.trim()
          ? item.sku
          : item.product_name || item.tenSanPham || `product_${item._id}`;
        const groupKey = uniqueKey + "|" + (item.product_name || item.tenSanPham || "") + "|" + (item.category || "") + "|" + (item.branch || "");
        
        if (!iphoneGroupMap.has(groupKey)) {
          iphoneGroupMap.set(groupKey, {
            items: [],
            totalSold: soldCountMap.get(groupKey) || 0,
            totalImport: iphoneImportMap.get(groupKey) || 0 // ✅ Tổng số nhập (in_stock + sold)
          });
        }
        iphoneGroupMap.get(groupKey).items.push(item);
      } else {
        // ✅ Sửa: Gom theo SKU + tên + thư mục + chi nhánh, KHÔNG phân biệt ngày tháng  
        const importMonth = getImportMonth(item.import_date);
        const key = (item.sku || '') + '|' + (item.product_name || item.tenSanPham || '') + '|' + (item.category || '') + '|' + (item.branch || '');
        if (!accessoriesMap[key]) {
          accessoriesMap[key] = {
            sku: item.sku || "",
            product_name: item.product_name || item.tenSanPham || "",
            tenSanPham: item.product_name || item.tenSanPham || "",
            price_import: item.price_import || 0,
            import_date: item.import_date,
            supplier: item.supplier,
            branch: item.branch,
            category: item.category,
            note: item.note,
            importMonth,
            quantity: 0, // Tổng số nhập
            soLuongConLai: 0, // Tổng tồn kho
            totalImport: 0, // Tổng nhập
            totalSold: soldCountMap.get(key) || 0, // ✅ Tổng đã bán từ map
            totalRemain: 0, // Sẽ tính sau
            _id: item._id,
          };
        }
        const importQty = Number(item.quantity) || 1;
        accessoriesMap[key].quantity += importQty;
        accessoriesMap[key].totalImport += importQty;
      }
    }
    
    // ✅ Xử lý iPhone: Thêm totalSold và totalImport cho mỗi item
    for (const [groupKey, group] of iphoneGroupMap.entries()) {
      const totalSold = group.totalSold;
      const totalImport = group.totalImport; // ✅ Tổng số nhập (in_stock + sold)
      const totalRemain = Math.max(totalImport - totalSold, group.items.length, 0); // ✅ Đảm bảo không nhỏ hơn số máy còn in_stock
      
      for (const item of group.items) {
        const itemWithSold = {
          ...item.toObject(),
          totalSold: totalSold, // ✅ Tổng đã bán của cả nhóm
          totalImport: totalImport, // ✅ Tổng nhập của cả nhóm (in_stock + sold)
          totalRemain, // Gán tồn kho nhóm cho từng item để frontend đọc đúng
          importMonth: getImportMonth(item.import_date)
        };
        imeiItems.push(itemWithSold);
      }
    }
    
    // Gán số lượng còn lại (tồn kho) cho phụ kiện
    for (const key in accessoriesMap) {
      const acc = accessoriesMap[key];
      // ✅ Tính totalRemain từ totalImport - totalSold (ưu tiên dùng soldCountMap)
      acc.totalRemain = acc.totalImport - acc.totalSold;
      // Fallback: dùng exportMap nếu không có trong soldCountMap (cho phụ kiện)
      if (acc.totalSold === 0 && exportMap[acc.sku]) {
        acc.totalRemain = acc.totalImport - (exportMap[acc.sku] || 0);
      }
      if (acc.totalRemain < 0) acc.totalRemain = 0;
      acc.soLuongConLai = acc.totalRemain; // Đồng bộ với soLuongConLai
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
      branch,
      payments = []
    } = req.body;

    // Chuẩn hoá payments: lọc số >0, gộp theo nguồn, tối đa mỗi nguồn 1 dòng
    const validSources = new Set(['tien_mat', 'the', 'vi_dien_tu']);
    const normalizedMap = new Map();
    if (Array.isArray(payments)) {
      for (const p of payments) {
        if (!p || !validSources.has(p.source)) continue;
        const amt = Number(p.amount) || 0;
        if (amt <= 0) continue;
        normalizedMap.set(p.source, (normalizedMap.get(p.source) || 0) + amt);
      }
    }
    const normalizedPayments = Array.from(normalizedMap.entries()).map(([source, amount]) => ({ source, amount }));
    const totalPaidFromPayments = normalizedPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

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
            // ✅ REMOVED: note - không cập nhật ghi chú vào Inventory
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
      const createdExport = await ExportHistory.create({
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
        da_thanh_toan: totalPaidFromPayments,
        payments: normalizedPayments,
        branch,
        category: item.category || "",
        export_type: "iphone",
      });

      // === GHI NHẬN HOẠT ĐỘNG ===
      try {
        const activityData = {
          user_id: req.user?._id,
          username: req.user?.username || req.user?.email || '',
          role: req.user?.role,
          action: 'create',
          module: 'xuat_hang',
          payload_snapshot: {
            imei: imei,
            product_name: item.product_name || item.tenSanPham,
            quantity: 1,
            price_sell: price_sell || item.price_sell,
            customer_name: customer_name,
            customer_phone: customer_phone,
            total_paid: totalPaidFromPayments,
            branch: branch
          },
          ref_id: imei || String(createdExport._id),
          branch: branch
        };

        // Tạo mô tả chi tiết
        const roleLabel = req.user?.role === 'admin' ? 'Admin' : (req.user?.role === 'thu_ngan' ? 'Thu ngân' : 'User');
        activityData.description = `Nhân viên ${activityData.username} (${roleLabel}) tạo đơn xuất hàng - Sản phẩm: ${item.product_name || item.tenSanPham}${imei ? ` (IMEI: ${imei})` : ''} - Giá bán: ${new Intl.NumberFormat('vi-VN').format(price_sell || item.price_sell || 0)}đ${customer_name ? ` - Khách hàng: ${customer_name}` : ''}${customer_phone ? ` (${customer_phone})` : ''} - Đã thanh toán: ${new Intl.NumberFormat('vi-VN').format(totalPaidFromPayments || 0)}đ`;

        await ActivityLog.create(activityData);
      } catch (e) { /* ignore log error */ }

      // === Ghi sổ quỹ theo từng payment
      if (normalizedPayments.length > 0) {
        const paidDate = sold_date ? new Date(sold_date) : new Date();
        const branchForEntry = branch || item.branch || '';
        for (const p of normalizedPayments) {
          await Cashbook.create({
            type: 'thu', amount: Number(p.amount), source: p.source,
            content: 'Doanh thu bán hàng', customer: customer_name || '',
            date: paidDate, branch: branchForEntry, related_id: String(createdExport._id), related_type: 'ban_hang',
            is_auto: true, editable: false
          });
        }
      }

      const profit = (item.price_sell || item.giaBan || 0) - (item.price_import || item.giaNhap || 0);
      return res.status(200).json({ message: "✅ Xuất máy thành công!", profit, export: createdExport });
    } else {
      // ===== XUẤT PHỤ KIỆN =====
      if (!sku || !product_name) {
        return res.status(400).json({ message: "❌ Thiếu thông tin sản phẩm phụ kiện" });
      }
      if (!quantity || quantity < 1) {
        return res.status(400).json({ message: "❌ Số lượng phụ kiện không hợp lệ" });
      }

      // ✅ Tìm phụ kiện và kiểm tra số lượng thực tế
      const acc = await Inventory.findOne({
        sku,
        product_name,
        status: 'in_stock',
        $or: [{ imei: null }, { imei: "" }]
      });

      if (!acc) {
        return res.status(400).json({ message: `❌ Không tìm thấy phụ kiện trong kho` });
      }

      // ✅ Kiểm tra số lượng trực tiếp từ Inventory (logic đơn giản)
      if (acc.quantity < quantity) {
        return res.status(400).json({ message: `❌ Không đủ phụ kiện trong kho (còn ${acc.quantity}, cần ${quantity})` });
      }

      // ✅ Cập nhật quantity trong Inventory (logic đơn giản)
      let updateObj = {};
      let soldAccessory = null;
      if (acc.quantity > quantity) {
        // Giảm số lượng, giữ trạng thái in_stock
        updateObj = { $inc: { quantity: -quantity } };
        soldAccessory = await Inventory.findByIdAndUpdate(acc._id, updateObj, { new: true });
      } else if (acc.quantity === quantity) {
        // Hết đúng: cập nhật quantity = 0 và status = 'sold'
        updateObj = {
          $set: {
            quantity: 0,
            status: 'sold'
          }
        };
        soldAccessory = await Inventory.findByIdAndUpdate(acc._id, updateObj, { new: true });
      } else {
        return res.status(400).json({ message: `❌ Số lượng không hợp lệ` });
      }

      console.log('✅ Xuất phụ kiện - ĐÃ trừ quantity trong Inventory');

      // === GHI LỊCH SỬ XUẤT PHỤ KIỆN ===
      const createdExport = await ExportHistory.create({
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
        da_thanh_toan: totalPaidFromPayments,
        payments: normalizedPayments,
        branch,
        category: acc.category || "",
        export_type: "accessory",
      });

      // === GHI NHẬN HOẠT ĐỘNG ===
      try {
        const activityData = {
          user_id: req.user?._id,
          username: req.user?.username || req.user?.email || '',
          role: req.user?.role,
          action: 'create',
          module: 'xuat_hang',
          payload_snapshot: {
            sku: acc.sku,
            product_name: acc.product_name || acc.tenSanPham,
            quantity: quantity,
            price_sell: price_sell || 0,
            customer_name: customer_name,
            customer_phone: customer_phone,
            total_paid: totalPaidFromPayments,
            branch: branch,
            export_type: 'accessory'
          },
          ref_id: acc.sku || String(createdExport._id),
          branch: branch
        };

        // Tạo mô tả chi tiết
        const roleLabel = req.user?.role === 'admin' ? 'Admin' : (req.user?.role === 'thu_ngan' ? 'Thu ngân' : 'User');
        activityData.description = `Nhân viên ${activityData.username} (${roleLabel}) tạo đơn xuất hàng phụ kiện - Sản phẩm: ${acc.product_name || acc.tenSanPham} (SKU: ${acc.sku}) - Số lượng: ${quantity} - Giá bán: ${new Intl.NumberFormat('vi-VN').format(price_sell || 0)}đ${customer_name ? ` - Khách hàng: ${customer_name}` : ''}${customer_phone ? ` (${customer_phone})` : ''} - Đã thanh toán: ${new Intl.NumberFormat('vi-VN').format(totalPaidFromPayments || 0)}đ`;

        await ActivityLog.create(activityData);
      } catch (e) { /* ignore log error */ }

      // === Ghi sổ quỹ theo từng payment
      if (normalizedPayments.length > 0) {
        const paidDate = sold_date ? new Date(sold_date) : new Date();
        const branchForEntry = branch || acc.branch || '';
        for (const p of normalizedPayments) {
          await Cashbook.create({
            type: 'thu', amount: Number(p.amount), source: p.source,
            content: 'Doanh thu bán phụ kiện', customer: customer_name || '',
            date: paidDate, branch: branchForEntry, related_id: String(createdExport._id), related_type: 'ban_hang',
            is_auto: true, editable: false
          });
        }
      }

      let totalProfit = (price_sell || 0) * quantity - (acc.price_import || 0) * quantity;
      return res.status(200).json({
        message: "✅ Xuất phụ kiện thành công!",
        profit: totalProfit,
        quantity,
        export: createdExport
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
      da_thanh_toan,  // ✅ FIX: Thêm field da_thanh_toan
      payments = []   // ✅ Mảng đa nguồn tiền khi cập nhật
    } = req.body;

    console.log('🔄 Routes PUT Request data:', req.body); // Debug
    console.log('🔍 Routes PUT Request ID:', req.params.id); // Debug
    console.log('🔍 DEBUG da_thanh_toan value:', da_thanh_toan); // Debug specific field

    // ✅ Validate ObjectId format
    if (!mongoose.isValidObjectId(req.params.id)) {
      console.log('❌ Invalid ObjectId format:', req.params.id);
      return res.status(400).json({ message: '❌ ID không hợp lệ.' });
    }

    // ✅ Debug: Kiểm tra record có tồn tại không trong ExportHistory TRƯỚC KHI UPDATE
    const existingRecord = await ExportHistory.findById(req.params.id);
    console.log('🔍 Found record for PUT in ExportHistory (backend/routes):', existingRecord ? {
      _id: existingRecord._id,
      product_name: existingRecord.product_name,
      imei: existingRecord.imei || 'No IMEI (accessory)',
      price_sell: existingRecord.price_sell,
      customer_name: existingRecord.customer_name
    } : 'NOT FOUND');

    if (!existingRecord) {
      console.log('❌ Record not found in ExportHistory for ID:', req.params.id);
      return res.status(404).json({ message: '❌ Không tìm thấy đơn xuất để cập nhật.' });
    }

    // ✅ FIX: Flexible field mapping để support cả frontend và backend fields
    const finalSalePrice = parseFloat(sale_price || price_sell) || 0;
    const finalCustomerName = buyer_name || customer_name || '';
    const finalCustomerPhone = buyer_phone || customer_phone || '';
    const finalSaleDate = sale_date || sold_date;

    console.log('🔍 Field mapping debug:', {
      sale_price, price_sell, finalSalePrice,
      buyer_name, customer_name, finalCustomerName
    }); // Debug

    // Chuẩn hoá payments khi cập nhật
    const validSources = new Set(['tien_mat', 'the', 'vi_dien_tu']);
    const mapUpdate = new Map();
    if (Array.isArray(payments)) {
      for (const p of payments) {
        if (!p || !validSources.has(p.source)) continue;
        const amt = Number(p.amount) || 0;
        if (amt <= 0) continue;
        mapUpdate.set(p.source, (mapUpdate.get(p.source) || 0) + amt);
      }
    }
    const normalizedPayments = Array.from(mapUpdate.entries()).map(([source, amount]) => ({ source, amount }));
    const totalPaidFromPayments = normalizedPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

    const updateFields = {
      // Price fields - ưu tiên field từ frontend
      price_sell: finalSalePrice,
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
      da_thanh_toan: totalPaidFromPayments,
      payments: normalizedPayments,
      quantity: parseInt(req.body.quantity) || existingRecord.quantity || 1, // ✅ THÊM QUANTITY
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

    console.log('🔄 Routes processed update fields:', updateFields); // Debug

    // ✅ Cập nhật ExportHistory thay vì Inventory
    const updated = await ExportHistory.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true, runValidators: false }
    );

    if (!updated) {
      console.log('❌ findByIdAndUpdate returned null for ID:', req.params.id);
      return res.status(404).json({ message: "❌ Không tìm thấy đơn xuất để cập nhật." });
    }

    console.log('✅ Routes PUT update successful:', {
      _id: updated._id,
      product_name: updated.product_name,
      price_sell: updated.price_sell,
      customer_name: updated.customer_name
    }); // Debug
    // ✅ Ghi nhận đa nguồn tiền khi cập nhật: thay thế toàn bộ bút toán cũ bằng mảng payments mới (nếu truyền lên)
    let savedPayments = [];
    try {
      if (normalizedPayments.length > 0) {
        await Cashbook.deleteMany({ related_type: 'ban_hang', related_id: String(updated._id) });
        const paidDate = updated.sold_date || new Date();
        const branchForEntry = updated.branch || branch || '';
        const customerForEntry = updated.customer_name || finalCustomerName || '';
        for (const p of normalizedPayments) {
          const created = await Cashbook.create({
            type: 'thu', amount: Number(p.amount), source: p.source,
            content: 'Doanh thu bán hàng (cập nhật)', customer: customerForEntry,
            date: paidDate, branch: branchForEntry,
            related_id: String(updated._id), related_type: 'ban_hang',
            is_auto: true, editable: false
          });
          savedPayments.push({ source: created.source, amount: created.amount });
        }
      }
    } catch (e) {
      console.error('❌ Lỗi cập nhật payments cho đơn lẻ:', e.message);
    }

    // Lấy lại payments từ sổ quỹ theo export_id nếu chưa có savedPayments
    if (savedPayments.length === 0) {
      const existed = await Cashbook.find({ related_type: 'ban_hang', related_id: String(updated._id) }).select('source amount').sort({ _id: 1 });
      savedPayments = existed.map(p => ({ source: p.source, amount: p.amount }));
    }

    res.json({ message: "✅ Đã cập nhật đơn xuất thành công!", item: updated, payments: savedPayments });
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
    console.log(' Starting migration check from Inventory to ExportHistory...');

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

// ==================== API: Xuất Excel báo cáo tài chính ====================
router.get('/export-excel', authenticateToken, requireReportAccess, async (req, res) => {
  try {
    const { from, to, branch, category } = req.query;
    if (!from || !to) {
      return res.status(400).json({ message: 'Thiếu khoảng thời gian' });
    }
    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setDate(toDate.getDate() + 1);

    const exportQuery = { sold_date: { $gte: fromDate, $lt: toDate } };
    if (branch && branch !== 'all') exportQuery.branch = branch;
    if (category && category !== 'all') exportQuery.category = category;

    const exports = await ExportHistory.find(exportQuery).sort({ sold_date: -1, createdAt: -1 });
    const totalRevenue = exports.reduce((s, e) => s + (e.price_sell || 0) * (e.quantity || 1), 0);
    const totalCostRaw = exports.reduce((s, e) => s + (e.price_import || 0) * (e.quantity || 1), 0);

    const returnQuery = { return_date: { $gte: fromDate, $lt: toDate } };
    if (branch && branch !== 'all') returnQuery.branch = branch;
    const returns = await ReturnExport.find(returnQuery);
    const totalReturnRevenue = returns.reduce((s, r) => s + (r.return_amount || 0), 0);

    const netRevenue = totalRevenue - totalReturnRevenue;

    // Tính lại giá vốn chỉ cho các đơn hàng thành công (không tính phần đã trả hàng)
    let returnedCost = 0;
    if (returns.length > 0) {
      const exportIds = returns.map(r => r.original_export_id).filter(id => !!id);
      if (exportIds.length > 0) {
        const relatedExports = await ExportHistory.find({ _id: { $in: exportIds } });
        const exportMap = new Map(relatedExports.map(e => [String(e._id), e]));

        for (const r of returns) {
          const ex = exportMap.get(String(r.original_export_id));
          if (!ex) continue;
          const soldDate = ex.sold_date || ex.createdAt;
          if (!soldDate) continue;
          if (soldDate >= fromDate && soldDate < toDate) {
            const qty = ex.quantity || r.quantity || 1;
            const importPrice = ex.price_import || 0;
            returnedCost += importPrice * qty;
          }
        }
      }
    }

    let totalCost = totalCostRaw - returnedCost;
    if (totalCost < 0) totalCost = 0;

    const grossProfit = netRevenue - totalCost;

    const cbQuery = { date: { $gte: fromDate, $lt: toDate } };
    if (branch && branch !== 'all') cbQuery.branch = branch;
    const cashItems = await Cashbook.find(cbQuery);

    // ✅ Chi phí chỉ tính những phiếu được tạo thủ công (không tính phiếu tự động) và có include_in_profit = true
    // ❌ KHÔNG tính nhập hàng (related_type: 'nhap_hang') - nhập hàng là giá vốn, không phải chi phí ngoài
    const totalExpense = cashItems
      .filter(i => i.type === 'chi' && i.is_auto === false && (i.include_in_profit !== false) && i.related_type !== 'nhap_hang')
      .reduce((s, i) => s + (i.amount || 0), 0);

    const otherIncome = cashItems
      .filter(i => i.type === 'thu' && i.related_type === 'manual' && (i.include_in_profit !== false))
      .reduce((s, i) => s + (i.amount || 0), 0);

    const netProfit = grossProfit + otherIncome - totalExpense;

    // Tạo dữ liệu cho Excel
    const reportData = [
      { 'Chỉ tiêu': 'Tổng doanh thu bán hàng', 'Giá trị': totalRevenue },
      { 'Chỉ tiêu': 'Tổng doanh thu trả hàng', 'Giá trị': totalReturnRevenue },
      { 'Chỉ tiêu': 'Doanh thu thuần', 'Giá trị': netRevenue },
      { 'Chỉ tiêu': 'Giá vốn', 'Giá trị': totalCost },
      { 'Chỉ tiêu': 'Lợi nhuận gộp', 'Giá trị': grossProfit },
      { 'Chỉ tiêu': 'Tổng chi phí', 'Giá trị': totalExpense },
      { 'Chỉ tiêu': 'Thu nhập khác', 'Giá trị': otherIncome },
      { 'Chỉ tiêu': 'Lợi nhuận thuần', 'Giá trị': netProfit }
    ];

    // Tạo workbook
    const ws = XLSX.utils.json_to_sheet(reportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'BaoCaoTaiChinh');

    // Xuất file
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const fileName = `baocao_taichinh_${from}_${to}.xlsx`;

    res.set('Content-Disposition', `attachment; filename="${fileName}"`);
    res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ message: '❌ Lỗi xuất Excel báo cáo', error: err.message });
  }
});

export default router;
// Phụ trợ: trả về payments của 1 export theo id (đơn lẻ)
// GET /api/report/xuat-hang/:id/payments
// Lưu ý: mount path ngoài server sẽ là /api/report/...
router.get('/xuat-hang/:id/payments', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'Thiếu id' });
    const existed = await Cashbook.find({ related_type: 'ban_hang', related_id: String(id) }).select('source amount').sort({ _id: 1 });
    const payments = existed.map(p => ({ source: p.source, amount: p.amount }));
    return res.json({ id, payments });
  } catch (err) {
    return res.status(500).json({ message: '❌ Lỗi lấy payments', error: err.message });
  }
});
