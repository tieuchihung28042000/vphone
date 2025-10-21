import express from 'express';
import ReturnImport from '../models/ReturnImport.js';
import Inventory from '../models/Inventory.js';
import Cashbook from '../models/Cashbook.js';
import SupplierDebt from '../models/SupplierDebt.js'; // ✅ Import lại để tính công nợ
import { authenticateToken, requireRole, filterByBranch } from '../middleware/auth.js';
import ActivityLog from '../models/ActivityLog.js';

const router = express.Router();

// ✅ Helper function tính công nợ nhà cung cấp
const calculateSupplierDebt = async (supplier, branch) => {
  try {
    const inventoryItems = await Inventory.find({
      supplier: { $eq: supplier },
      branch: branch
    });

    let totalDebt = 0;
    for (const item of inventoryItems) {
      const priceImport = parseFloat(item.price_import) || 0;
      const quantity = parseInt(item.quantity) || 1;
      const daTT = parseFloat(item.da_thanh_toan_nhap) || 0;
      const congNo = Math.max((priceImport * quantity) - daTT, 0);
      totalDebt += congNo;
    }
    
    return totalDebt;
  } catch (error) {
    console.error('Error calculating supplier debt:', error);
    return 0;
  }
};

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
router.post('/', authenticateToken, requireRole(['admin', 'thu_ngan']), async (req, res) => {
  try {
    const {
      original_inventory_id,
      return_amount,
      return_quantity = 1, // ✅ Số lượng trả
      return_method = 'tien_mat', // ✅ Nguồn tiền mặc định
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

    // ✅ Kiểm tra số lượng trả
    if (return_quantity <= 0) {
      return res.status(400).json({ message: 'Số lượng trả phải lớn hơn 0' });
    }

    if (return_quantity > originalItem.quantity) {
      return res.status(400).json({ message: 'Số lượng trả không được vượt quá số lượng hiện có' });
    }

    // ✅ Chỉ validate return_amount (logic mới không cần return_cash/return_transfer)
    if (!return_amount || return_amount <= 0) {
      return res.status(400).json({ message: 'Số tiền trả phải lớn hơn 0' });
    }

    // Tạo phiếu trả hàng
    const returnImport = new ReturnImport({
      original_inventory_id,
      imei: originalItem.imei,
      sku: originalItem.sku,
      product_name: originalItem.product_name,
      quantity: return_quantity, // ✅ Số lượng trả thực tế
      price_import: originalItem.price_import,
      return_amount: req.body.return_amount,
      return_reason,
      supplier: originalItem.supplier,
      branch: originalItem.branch,
      created_by: req.user._id,
      note
    });

    await returnImport.save();
    try {
      await ActivityLog.create({
        user_id: req.user?._id,
        username: req.user?.full_name || req.user?.email || '',
        role: req.user?.role,
        action: 'create',
        module: 'return_import',
        payload_snapshot: returnImport.toObject(),
        ref_id: String(returnImport._id),
        branch: returnImport.branch
      });
    } catch (e) { }

    // ✅ Cập nhật số lượng trong tồn kho thay vì xóa
    const newQuantity = originalItem.quantity - return_quantity;
    if (newQuantity <= 0) {
      // Nếu hết hàng thì xóa
      await Inventory.findByIdAndDelete(original_inventory_id);
    } else {
      // Nếu còn hàng thì cập nhật số lượng và status
      await Inventory.findByIdAndUpdate(original_inventory_id, {
        quantity: newQuantity,
        status: newQuantity > 0 ? 'in_stock' : 'sold'
      });
    }

    // ✅ Logic ưu tiên: Trả công nợ nhà cung cấp trước, nếu không có công nợ thì cộng vào sổ quỹ
    const currentDebt = await calculateSupplierDebt(returnImport.supplier, returnImport.branch);
    console.log(`🔍 Supplier debt for ${returnImport.supplier}: ${currentDebt}, Return amount: ${return_amount}`);
    
    if (currentDebt > 0) {
      // ✅ Có công nợ: Ưu tiên trả công nợ trước
      const debtToPay = Math.min(currentDebt, return_amount);
      const remainingAmount = return_amount - debtToPay;
      
      console.log(`💰 Paying debt: ${debtToPay}, Remaining: ${remainingAmount}`);
      
      // Trả công nợ
      if (debtToPay > 0) {
        // Tìm hoặc tạo SupplierDebt record
        let supplierDebt = await SupplierDebt.findOne({
          supplier_name: returnImport.supplier,
          branch: returnImport.branch
        });
        
        if (!supplierDebt) {
          supplierDebt = new SupplierDebt({
            supplier_name: returnImport.supplier,
            branch: returnImport.branch,
            total_debt: currentDebt,
            total_paid: 0,
            debt_history: []
          });
        }
        
        // Cập nhật công nợ
        supplierDebt.total_debt = Math.max(0, supplierDebt.total_debt - debtToPay);
        supplierDebt.total_paid += debtToPay;
        supplierDebt.debt_history.push({
          type: 'pay',
          amount: debtToPay,
          note: `Trả hàng nhập: ${returnImport.product_name} (${return_quantity} sản phẩm)`,
          date: new Date(),
          related_id: returnImport._id.toString()
        });
        await supplierDebt.save();
      }
      
      // Nếu còn tiền thừa thì cộng vào sổ quỹ
      if (remainingAmount > 0) {
        console.log(`💵 Adding remaining amount to cashbook: ${remainingAmount}`);
        await Cashbook.create({
          type: 'thu', // ✅ Cộng tiền vào sổ quỹ
          amount: remainingAmount,
          content: `Trả hàng nhập: ${returnImport.product_name}${returnImport.imei ? ` (IMEI: ${returnImport.imei})` : ''}`,
          category: 'tra_hang_nhap',
        source: return_method || 'tien_mat',
          supplier: returnImport.supplier,
          date: new Date(),
          branch: returnImport.branch,
          related_id: returnImport._id.toString(),
          related_type: 'tra_hang_nhap',
          note: `Lý do: ${return_reason}. ${note || ''} (Số tiền thừa sau khi trả công nợ)`,
          user: req.user.full_name || req.user.email,
          is_auto: true,
          editable: false
        });
      }
    } else {
      // ✅ Không có công nợ: Cộng toàn bộ vào sổ quỹ
      console.log(`💵 No debt, adding full amount to cashbook: ${return_amount}`);
      await Cashbook.create({
        type: 'thu', // ✅ Cộng tiền vào sổ quỹ
        amount: return_amount,
        content: `Trả hàng nhập: ${returnImport.product_name}${returnImport.imei ? ` (IMEI: ${returnImport.imei})` : ''}`,
        category: 'tra_hang_nhap',
        source: return_method || 'tien_mat',
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

    try {
      await ActivityLog.create({
        user_id: req.user?._id,
        username: req.user?.full_name || req.user?.email || '',
        role: req.user?.role,
        action: 'delete',
        module: 'return_import',
        payload_snapshot: returnImport.toObject(),
        ref_id: String(returnImport._id),
        branch: returnImport.branch
      });
    } catch (e) { }

    res.json({ message: 'Hủy phiếu trả hàng thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
});

export default router; 