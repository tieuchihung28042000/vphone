const express = require('express');
const ReturnImport = require('../models/ReturnImport');
const Inventory = require('../models/Inventory');
const Cashbook = require('../models/Cashbook');
const { authenticateToken, requireRole, filterByBranch } = require('../middleware/auth');

const router = express.Router();

// Error handling middleware
const handleError = (res, error, message = 'Internal server error') => {
  console.error(`[ReturnImport Error] ${message}:`, error);
  res.status(500).json({ 
    message, 
    error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' 
  });
};

// Lấy danh sách trả hàng nhập
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
        { supplier: { $regex: search, $options: 'i' } },
        { return_reason: { $regex: search, $options: 'i' } }
      ];
    }
    
    const returns = await ReturnImport.find(filter)
      .populate('created_by', 'full_name email')
      .sort({ return_date: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await ReturnImport.countDocuments(filter);
    
    res.json({
      returns,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      totalItems: total
    });
  } catch (error) {
    handleError(res, error, 'Lỗi khi lấy danh sách trả hàng nhập');
  }
});

// Tạo phiếu trả hàng nhập
router.post('/', authenticateToken, requireRole(['admin', 'quan_ly', 'thu_ngan']), async (req, res) => {
  try {
    const {
      original_inventory_id,
      return_amount,
      return_cash = 0,
      return_transfer = 0,
      return_reason,
      note = ''
    } = req.body;

    // Kiểm tra sản phẩm gốc
    const originalItem = await Inventory.findById(original_inventory_id);
    if (!originalItem) {
      return res.status(404).json({ message: 'Không tìm thấy sản phẩm gốc' });
    }

    // Kiểm tra quyền truy cập chi nhánh
    if (req.user.role !== 'admin' && originalItem.branch !== req.user.branch_name) {
      return res.status(403).json({ message: 'Không có quyền trả hàng của chi nhánh khác' });
    }

    // Kiểm tra sản phẩm chưa bán
    if (originalItem.status === 'sold') {
      return res.status(400).json({ message: 'Không thể trả hàng đã bán' });
    }

    // Kiểm tra tổng tiền trả
    if (return_cash + return_transfer !== return_amount) {
      return res.status(400).json({ message: 'Tổng tiền trả không khớp' });
    }

    // Tạo phiếu trả hàng
    const returnImport = new ReturnImport({
      original_inventory_id,
      imei: originalItem.imei,
      sku: originalItem.sku,
      product_name: originalItem.product_name,
      quantity: originalItem.quantity,
      price_import: originalItem.price_import,
      return_amount,
      return_cash,
      return_transfer,
      return_reason,
      supplier: originalItem.supplier,
      branch: originalItem.branch,
      created_by: req.user._id,
      note
    });

    await returnImport.save();

    // Xóa sản phẩm khỏi tồn kho
    await Inventory.findByIdAndDelete(original_inventory_id);

    // ✅ Tích hợp với sổ quỹ - tạo phiếu chi khi trả hàng nhập
    if (returnCash > 0) {
      await Cashbook.create({
        type: 'chi',
        amount: returnCash,
        content: `Trả hàng nhập: ${returnImport.product_name}${returnImport.imei ? ` (IMEI: ${returnImport.imei})` : ''}`,
        category: 'tra_hang_nhap',
        source: 'tien_mat',
        supplier: returnImport.supplier,
        date: new Date(),
        branch: returnImport.branch,
        related_id: returnImport._id.toString(),
        related_type: 'tra_hang_nhap',
        note: `Lý do: ${returnForm.return_reason}. ${returnImport.note || ''}`,
        user: req.user.full_name || req.user.email,
        is_auto: true,
        editable: false
      });
    }

    if (returnTransfer > 0) {
      await Cashbook.create({
        type: 'chi',
        amount: returnTransfer,
        content: `Trả hàng nhập: ${returnImport.product_name}${returnImport.imei ? ` (IMEI: ${returnImport.imei})` : ''}`,
        category: 'tra_hang_nhap',
        source: 'the',
        supplier: returnImport.supplier,
        date: new Date(),
        branch: returnImport.branch,
        related_id: returnImport._id.toString(),
        related_type: 'tra_hang_nhap',
        note: `Lý do: ${return_reason}. ${note || ''}`,
        user: req.user.full_name || req.user.email,
        is_auto: true,
        editable: false
      });
    }

    res.status(201).json({
      message: 'Tạo phiếu trả hàng và cập nhật sổ quỹ thành công',
      returnImport
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
});

// Lấy chi tiết phiếu trả hàng
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const returnImport = await ReturnImport.findById(req.params.id)
      .populate('created_by', 'full_name email')
      .populate('original_inventory_id');

    if (!returnImport) {
      return res.status(404).json({ message: 'Không tìm thấy phiếu trả hàng' });
    }

    // Kiểm tra quyền truy cập
    if (req.user.role !== 'admin' && returnImport.branch !== req.user.branch_name) {
      return res.status(403).json({ message: 'Không có quyền xem phiếu trả hàng của chi nhánh khác' });
    }

    res.json(returnImport);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
});

// Hủy phiếu trả hàng (chỉ admin)
router.delete('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const returnImport = await ReturnImport.findById(req.params.id);
    
    if (!returnImport) {
      return res.status(404).json({ message: 'Không tìm thấy phiếu trả hàng' });
    }

    // Cập nhật trạng thái thành cancelled
    returnImport.status = 'cancelled';
    await returnImport.save();

    res.json({ message: 'Hủy phiếu trả hàng thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
});

module.exports = router; 