const express = require('express');
const ReturnExport = require('../models/ReturnExport');
const ExportHistory = require('../models/ExportHistory');
const Inventory = require('../models/Inventory');
const Cashbook = require('../models/Cashbook');
const { authenticateToken, requireRole, filterByBranch } = require('../middleware/auth');

const router = express.Router();

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

    // Tạo phiếu trả hàng
    const returnExport = new ReturnExport({
      original_export_id,
      imei: originalExport.imei,
      sku: originalExport.sku,
      product_name: originalExport.product_name,
      quantity: originalExport.quantity,
      price_sell: originalExport.price_sell,
      return_amount,
      return_method,
      return_reason,
      customer_name: originalExport.customer_name,
      customer_phone: originalExport.customer_phone,
      branch: originalExport.branch,
      created_by: req.user._id,
      note
    });

    await returnExport.save();

    // Tạo lại sản phẩm trong tồn kho (nếu cần)
    if (returnExport.return_to_inventory) {
      const newInventoryItem = new Inventory({
        imei: originalExport.imei,
        sku: originalExport.sku,
        product_name: originalExport.product_name,
        price_import: 0, // Không có giá nhập cho hàng trả
        price_sell: originalExport.price_sell,
        import_date: new Date(),
        quantity: originalExport.quantity,
        category: originalExport.category,
        branch: originalExport.branch,
        status: 'in_stock',
        note: `Trả hàng từ: ${originalExport.customer_name}`,
        is_return_item: true // Đánh dấu là hàng trả
      });

      await newInventoryItem.save();
    }

    // ✅ Tích hợp với sổ quỹ - tạo phiếu chi khi trả hàng bán
    const sourceMapping = {
      'cash': 'tien_mat',
      'transfer': 'the'
    };

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

    res.json({ message: 'Hủy phiếu trả hàng thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
});

module.exports = router; 