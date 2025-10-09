import express from 'express';
import ReturnExport from '../models/ReturnExport.js';
import ExportHistory from '../models/ExportHistory.js';
import Inventory from '../models/Inventory.js';
import Cashbook from '../models/Cashbook.js';
import { authenticateToken, requireRole, filterByBranch } from '../middleware/auth.js';
import ActivityLog from '../models/ActivityLog.js';

const router = express.Router();

// Error handling middleware
const handleError = (res, error, message = 'Internal server error') => {
  console.error(`[ReturnExport Error] ${message}:`, error);
  res.status(500).json({ 
    message, 
    error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' 
  });
};

// API lấy danh sách khách hàng cho autocomplete
router.get('/customers', authenticateToken, filterByBranch, async (req, res) => {
  try {
    const { search = '', limit = 20 } = req.query;
    
    let filter = {};
    
    // Lọc theo chi nhánh (nếu không phải admin)
    if (req.branchFilter) {
      filter.branch = req.user.branch_name;
    }
    
    // Tìm kiếm theo tên hoặc số điện thoại
    if (search && search.length >= 2) {
      filter.$or = [
        { customer_name: { $regex: search, $options: 'i' } },
        { customer_phone: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Lấy danh sách khách hàng từ ExportHistory
    const customers = await ExportHistory.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            customer_name: '$customer_name',
            customer_phone: '$customer_phone'
          },
          last_purchase: { $max: '$export_date' },
          total_purchases: { $sum: 1 },
          total_amount: { $sum: { $multiply: ['$price_sell', '$quantity'] } }
        }
      },
      {
        $match: {
          '_id.customer_name': { $exists: true, $ne: null, $ne: '' }
        }
      },
      {
        $project: {
          customer_name: '$_id.customer_name',
          customer_phone: '$_id.customer_phone',
          last_purchase: 1,
          total_purchases: 1,
          total_amount: 1
        }
      },
      { $sort: { last_purchase: -1 } },
      { $limit: parseInt(limit) }
    ]);
    
    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server khi lấy danh sách khách hàng', error: error.message });
  }
});

// Lấy danh sách trả hàng bán
router.get('/', authenticateToken, filterByBranch, async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '', from_date, to_date } = req.query;
    
    let filter = {};
    
    // Lọc theo chi nhánh (nếu không phải admin)
    if (req.branchFilter) {
      filter.branch = req.user.branch_name;
    }
    
    // Lọc theo thời gian
    if (from_date && to_date) {
      filter.return_date = {
        $gte: new Date(from_date),
        $lte: new Date(to_date + 'T23:59:59.999Z')
      };
    }
    
    // Tìm kiếm
    if (search) {
      filter.$or = [
        { product_name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { customer_name: { $regex: search, $options: 'i' } },
        { customer_phone: { $regex: search, $options: 'i' } },
        { return_reason: { $regex: search, $options: 'i' } }
      ];
    }
    
    const returns = await ReturnExport.find(filter)
      .populate('created_by', 'full_name email')
      .sort({ return_date: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await ReturnExport.countDocuments(filter);
    
    res.json({
      returns,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      totalItems: total
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
});

// Tạo phiếu trả hàng bán
router.post('/', authenticateToken, requireRole(['admin', 'quan_ly', 'thu_ngan', 'nhan_vien_ban_hang']), async (req, res) => {
  try {
    const {
      original_export_id,
      return_amount,
      return_method,
      payments = [], // [{source, amount}]
      return_reason,
      note = ''
    } = req.body;

    // Kiểm tra phiếu xuất gốc
    const originalExport = await ExportHistory.findById(original_export_id);
    if (!originalExport) {
      return res.status(404).json({ message: 'Không tìm thấy phiếu xuất gốc' });
    }

    // Kiểm tra quyền truy cập chi nhánh
    if (req.user.role !== 'admin' && originalExport.branch !== req.user.branch_name) {
      return res.status(403).json({ message: 'Không có quyền trả hàng của chi nhánh khác' });
    }

    // Kiểm tra đã có phiếu trả hàng chưa
    const existingReturn = await ReturnExport.findOne({ 
      original_export_id,
      status: { $ne: 'cancelled' }
    });
    
    if (existingReturn) {
      return res.status(400).json({ message: 'Sản phẩm này đã được trả hàng' });
    }

    // ✅ Chỉ cho phép trả hàng khi đã thanh toán ĐỦ
    // Tính tổng tiền đơn và tổng đã thanh toán (hỗ trợ batch)
    let totalAmount = 0;
    let totalPaid = 0;
    if (originalExport.batch_id) {
      const batchItems = await ExportHistory.find({ batch_id: originalExport.batch_id, branch: originalExport.branch });
      totalAmount = batchItems.reduce((s, it) => s + (Number(it.price_sell || it.sale_price || 0) * (parseInt(it.quantity) || 1)), 0);
      totalPaid = batchItems.reduce((s, it) => s + (Number(it.da_thanh_toan) || 0), 0);
    } else {
      totalAmount = (Number(originalExport.price_sell || originalExport.sale_price || 0) * (parseInt(originalExport.quantity) || 1));
      totalPaid = Number(originalExport.da_thanh_toan || 0);
    }

    if (totalPaid < totalAmount) {
      return res.status(400).json({ message: 'Chỉ được trả hàng khi đơn đã thanh toán đủ' });
    }

    // Chuẩn hóa dữ liệu trước khi lưu
    const normalizedPriceSell = Number(originalExport.price_sell || originalExport.sale_price || 0);
    const normalizedCustomerName = originalExport.customer_name || 'Khách lẻ';
    const normalizedMethod = (['tien_mat','the','vi_dien_tu'].includes(return_method)) ? return_method : (return_method === 'cash' ? 'tien_mat' : (return_method === 'transfer' ? 'the' : 'tien_mat'));

    // Tạo phiếu trả hàng
    const returnExport = new ReturnExport({
      original_export_id,
      imei: originalExport.imei,
      sku: originalExport.sku,
      product_name: originalExport.product_name,
      quantity: originalExport.quantity,
      price_sell: normalizedPriceSell,
      return_amount,
      return_method: normalizedMethod,
      return_reason,
      customer_name: normalizedCustomerName,
      customer_phone: originalExport.customer_phone,
      branch: originalExport.branch,
      created_by: req.user._id,
      note
    });

    await returnExport.save();
    try {
      await ActivityLog.create({
        user_id: req.user?._id,
        username: req.user?.full_name || req.user?.email || '',
        role: req.user?.role,
        action: 'create',
        module: 'return_export',
        payload_snapshot: returnExport.toObject(),
        ref_id: String(returnExport._id),
        branch: returnExport.branch
      });
    } catch (e) { }

    // ✅ Đánh dấu đơn xuất đã được hoàn trả - xử lý cả batch và single item
    try {
      if (originalExport.batch_id) {
        // Đánh dấu tất cả items trong batch là đã trả hàng
        await ExportHistory.updateMany(
          { 
            batch_id: originalExport.batch_id,
            branch: originalExport.branch
          },
          { 
            $set: { is_returned: true, return_id: returnExport._id }
          }
        );
      } else {
        // Đánh dấu single item như cũ
        await ExportHistory.findByIdAndUpdate(original_export_id, {
          $set: { is_returned: true, return_id: returnExport._id }
        });
      }
    } catch (e) { /* ignore */ }

    // ✅ Hoàn kho: KHÔNG tạo bản ghi nhập hàng mới
    //    - Với hàng có IMEI: chuyển trạng thái bản ghi Inventory tương ứng về in_stock
    //    - Với phụ kiện (không IMEI): cộng dồn quantity vào bản ghi hiện có (cùng sku/branch)
    {
      const restoreOne = async (exp) => {
        if (exp.imei && exp.imei !== 'No IMEI (accessory)') {
          // Hàng có IMEI: tìm đúng bản ghi đã bán và khôi phục
          await Inventory.findOneAndUpdate(
            { imei: exp.imei },
            {
              $set: {
                status: 'in_stock',
                sold_date: null,
                customer_name: '',
                customer_phone: '',
                note: `Khôi phục từ trả hàng: ${exp.customer_name || ''}`,
                is_return_item: true
              }
            }
          );
        } else {
          // Phụ kiện: cộng dồn vào bản ghi hiện có (ưu tiên cùng sku + branch)
          const filter = { sku: exp.sku, branch: exp.branch };
          const updated = await Inventory.findOneAndUpdate(
            filter,
            {
              $inc: { quantity: exp.quantity || 1 },
              $set: { status: 'in_stock' }
            },
            { new: true }
          );
          if (!updated) {
            // Fallback: nếu không có bản ghi sẵn, tạo mới (trường hợp hiếm)
            await Inventory.create({
              imei: null,
              sku: exp.sku,
              product_name: exp.product_name,
              price_import: exp.price_import || 0,
              price_sell: exp.price_sell,
              import_date: new Date(),
              quantity: exp.quantity || 1,
              category: exp.category,
              branch: exp.branch,
              status: 'in_stock',
              note: `Khôi phục từ trả hàng: ${exp.customer_name || ''}`,
              is_return_item: true,
              is_accessory: true
            });
          }
        }
      };

      if (originalExport.batch_id) {
        const batchItems = await ExportHistory.find({ batch_id: originalExport.batch_id, branch: originalExport.branch });
        for (const bi of batchItems) await restoreOne(bi);
      } else {
        await restoreOne(originalExport);
      }
    }

    // ✅ Điều chỉnh công nợ khách: giảm đã thanh toán tương ứng với số tiền hoàn
    try {
      if (originalExport.batch_id) {
        // Với batch, tính tổng đã thanh toán của tất cả items trong batch
        const batchItems = await ExportHistory.find({ 
          batch_id: originalExport.batch_id,
          branch: originalExport.branch
        });
        
        const totalPaid = batchItems.reduce((sum, item) => sum + (item.da_thanh_toan || 0), 0);
        const after = Math.max(totalPaid - Number(return_amount || 0), 0);
        
        // Cập nhật da_thanh_toan cho item đầu tiên (đại diện cho batch)
        const firstItem = batchItems[0];
        if (firstItem) {
          const update = { da_thanh_toan: after };
          await ExportHistory.findByIdAndUpdate(firstItem._id, { $set: update });
        }
      } else {
        // Xử lý single item như cũ
        const after = Math.max((originalExport.da_thanh_toan || 0) - Number(return_amount || 0), 0);
        const update = { da_thanh_toan: after };
        // Nếu đã hoàn đủ số khách đã thanh toán, đánh dấu đơn đã hoàn tất trả
        if (after <= 0) {
          update.is_returned = true;
          update.return_id = returnExport._id;
        }
        await ExportHistory.findByIdAndUpdate(original_export_id, { $set: update });
      }
    } catch (e) { /* ignore */ }

    // ✅ Tích hợp với sổ quỹ - tạo phiếu chi khi trả hàng bán
    const sourceMapping = {
      'cash': 'tien_mat',
      'transfer': 'the',
      'tien_mat': 'tien_mat',
      'the': 'the',
      'vi_dien_tu': 'vi_dien_tu'
    };

    if (Array.isArray(payments) && payments.length > 0) {
      for (const p of payments) {
        if (!p || !p.amount) continue;
        await Cashbook.create({
          type: 'chi',
          amount: Number(p.amount),
          content: `Trả hàng bán: ${returnExport.product_name}${returnExport.imei ? ` (IMEI: ${returnExport.imei})` : ''}`,
          category: 'tra_hang_ban',
          source: sourceMapping[p.source] || p.source || 'tien_mat',
          customer: returnExport.customer_name,
          date: new Date(),
          branch: returnExport.branch,
          related_id: returnExport._id.toString(),
          related_type: 'tra_hang_ban',
          note: `Lý do: ${return_reason}. KH: ${returnExport.customer_name}${returnExport.customer_phone ? ` - ${returnExport.customer_phone}` : ''}. ${note || ''}`,
          user: req.user.full_name || req.user.email,
          is_auto: true,
          editable: false
        });
      }
    } else {
      await Cashbook.create({
        type: 'chi',
        amount: return_amount,
        content: `Trả hàng bán: ${returnExport.product_name}${returnExport.imei ? ` (IMEI: ${returnExport.imei})` : ''}`,
        category: 'tra_hang_ban',
        source: sourceMapping[return_method] || 'tien_mat',
        customer: returnExport.customer_name,
        date: new Date(),
        branch: returnExport.branch,
        related_id: returnExport._id.toString(),
        related_type: 'tra_hang_ban',
        note: `Lý do: ${return_reason}. KH: ${returnExport.customer_name}${returnExport.customer_phone ? ` - ${returnExport.customer_phone}` : ''}. ${note || ''}`,
        user: req.user.full_name || req.user.email,
        is_auto: true,
        editable: false
      });
    }

    res.status(201).json({
      message: 'Tạo phiếu trả hàng và cập nhật sổ quỹ thành công',
      returnExport
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
});

// Lấy chi tiết phiếu trả hàng
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const returnExport = await ReturnExport.findById(req.params.id)
      .populate('created_by', 'full_name email')
      .populate('original_export_id');

    if (!returnExport) {
      return res.status(404).json({ message: 'Không tìm thấy phiếu trả hàng' });
    }

    // Kiểm tra quyền truy cập
    if (req.user.role !== 'admin' && returnExport.branch !== req.user.branch_name) {
      return res.status(403).json({ message: 'Không có quyền xem phiếu trả hàng của chi nhánh khác' });
    }

    res.json(returnExport);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
});

// Hủy phiếu trả hàng (chỉ admin)
router.delete('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const returnExport = await ReturnExport.findById(req.params.id);
    
    if (!returnExport) {
      return res.status(404).json({ message: 'Không tìm thấy phiếu trả hàng' });
    }

    // Cập nhật trạng thái thành cancelled
    returnExport.status = 'cancelled';
    await returnExport.save();

    try {
      await ActivityLog.create({
        user_id: req.user?._id,
        username: req.user?.full_name || req.user?.email || '',
        role: req.user?.role,
        action: 'delete',
        module: 'return_export',
        payload_snapshot: returnExport.toObject(),
        ref_id: String(returnExport._id),
        branch: returnExport.branch
      });
    } catch (e) { }

    res.json({ message: 'Hủy phiếu trả hàng thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
});

// ===== DIAGNOSTICS: Kiểm tra tính nhất quán trả hàng (tạm thời) =====
router.get('/diagnostics/summary', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    // Tổng phiếu trả hàng
    const totalReturns = await ReturnExport.countDocuments({});
    // Tổng chi trả hàng trong sổ quỹ
    const totalCashOut = await Cashbook.aggregate([
      { $match: { related_type: 'tra_hang_ban' } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);
    // Những đơn đã trả nhưng vẫn còn công nợ > 0
    const inconsistentExports = await ExportHistory.aggregate([
      { $match: { is_returned: true } },
      { $project: {
          price_sell: 1,
          sale_price: 1,
          quantity: 1,
          da_thanh_toan: 1,
          calc_amount: { $multiply: [ { $ifNull:['$price_sell', { $ifNull:['$sale_price', 0] }] }, { $ifNull:['$quantity', 1] } ] }
        }
      },
      { $project: { remain: { $subtract: ['$calc_amount', { $ifNull:['$da_thanh_toan', 0] }] } } },
      { $match: { remain: { $gt: 0 } } },
      { $limit: 20 }
    ]);

    // Kiểm tra các bản ghi IMEI đã trả nhưng còn status != in_stock
    const wrongImei = await Inventory.find({ is_return_item: true, imei: { $ne: null }, status: { $ne: 'in_stock' } })
      .select('imei status product_name branch updatedAt')
      .limit(20);

    res.json({
      returns: totalReturns,
      cashbook: { count: totalCashOut[0]?.count || 0, totalAmount: totalCashOut[0]?.total || 0 },
      exportInconsistencies: inconsistentExports.length,
      sampleExportInconsistencies: inconsistentExports,
      imeiIssues: wrongImei.length,
      sampleImeiIssues: wrongImei
    });
  } catch (error) {
    handleError(res, error, 'Lỗi diagnostics');
  }
});

export default router; 