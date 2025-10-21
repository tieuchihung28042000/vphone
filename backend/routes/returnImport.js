import express from 'express';
import ReturnImport from '../models/ReturnImport.js';
import Inventory from '../models/Inventory.js';
import Cashbook from '../models/Cashbook.js';
import SupplierDebt from '../models/SupplierDebt.js'; // ✅ Import lại để xử lý công nợ
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

// ✅ API lấy công nợ nhà cung cấp (sử dụng logic tính từ Inventory)
router.get('/supplier-debt', authenticateToken, async (req, res) => {
  try {
    const { supplier } = req.query;
    if (!supplier) {
      return res.status(400).json({ message: 'Thiếu tên nhà cung cấp' });
    }

    const branch = req.user.branch_name || 'Chi nhanh 1';
    
    // Tính công nợ từ Inventory (giống logic trong congno.js)
    const inventoryItems = await Inventory.find({
      supplier: { $eq: supplier }, // Chỉ tìm supplier khớp chính xác
      branch: branch
    });

    let totalDebt = 0;
    console.log(`🔍 Debug supplier debt for "${supplier}" in branch "${branch}":`);
    console.log(`  Found ${inventoryItems.length} items`);
    
    for (const item of inventoryItems) {
      // Tính công nợ từ logic: (price_import × quantity) - da_thanh_toan_nhap
      const priceImport = parseFloat(item.price_import) || 0;
      const quantity = parseInt(item.quantity) || 1;
      const daTT = parseFloat(item.da_thanh_toan_nhap) || 0;
      const congNo = Math.max((priceImport * quantity) - daTT, 0);
      
      console.log(`  - ${item.product_name}: (${priceImport} × ${quantity}) - ${daTT} = ${congNo}`);
      totalDebt += congNo;
    }
    
    console.log(`  Total debt: ${totalDebt}`);
    res.json({ totalDebt });
  } catch (error) {
    handleError(res, error, 'Lỗi khi lấy công nợ nhà cung cấp');
  }
});

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
      return_cash = 0,
      return_transfer = 0,
      payments = [],
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

    // ✅ Xử lý logic dựa trên return_method
    const returnMethod = req.body.return_method || 'tien_mat';
    const hasPayments = Array.isArray(payments) && payments.length > 0;
    
    if (returnMethod === 'cong_no') {
      // ✅ Trả bằng công nợ: Không cần validate payments
      console.log(`🔍 Returning via debt for supplier: ${originalItem.supplier}`);
    } else {
      // ✅ Trả bằng nguồn tiền: Validate payments như cũ
      if (!hasPayments) {
        const rc = Number(return_cash) || 0;
        const rt = Number(return_transfer) || 0;
        const ra = Number(return_amount) || 0;
        // Nếu UI chỉ gửi return_amount mà không tách nguồn, mặc định trả bằng tiền mặt
        if (rc + rt === 0 && ra > 0) {
          req.body.return_cash = ra;
        } else if ((rc + rt) !== ra) {
          return res.status(400).json({ message: 'Tổng tiền trả không khớp' });
        }
      } else {
        const sum = payments.reduce((s, p) => s + Number(p?.amount || 0), 0);
        if (sum !== Number(return_amount)) {
          return res.status(400).json({ message: 'Tổng payments không khớp return_amount' });
        }
      }
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
      return_cash: req.body.return_cash || 0,
      return_transfer: req.body.return_transfer || 0,
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
        payload_snapshot: {
          return_code: returnImport.return_code,
          product_name: returnImport.product_name,
          imei: returnImport.imei,
          return_amount: returnImport.return_amount,
          supplier: returnImport.supplier,
          reason: returnImport.reason,
          note: returnImport.note,
          quantity: returnImport.quantity
        },
        ref_id: returnImport.return_code || String(returnImport._id),
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

    // ✅ Xử lý dựa trên return_method
    if (returnMethod === 'cong_no') {
      // ✅ Trả bằng công nợ: Cập nhật da_thanh_toan_nhap trong Inventory
      console.log(`🔍 Returning via debt for supplier: ${returnImport.supplier}, amount: ${return_amount}`);
      
      // Tìm item gốc trong Inventory
      const originalItem = await Inventory.findById(original_inventory_id);
      if (originalItem) {
        // Cập nhật da_thanh_toan_nhap (tăng số tiền đã thanh toán)
        const currentPaid = parseFloat(originalItem.da_thanh_toan_nhap) || 0;
        const newPaid = currentPaid + return_amount;
        
        await Inventory.findByIdAndUpdate(original_inventory_id, {
          da_thanh_toan_nhap: newPaid
        });
        
        console.log(`✅ Updated da_thanh_toan_nhap: ${currentPaid} -> ${newPaid}`);

        // ✅ Ghi nhật ký công nợ NCC (SupplierDebt) dạng "pay"
        try {
          await SupplierDebt.findOneAndUpdate(
            { supplier_name: returnImport.supplier, branch: returnImport.branch },
            {
              $inc: { total_paid: return_amount, total_debt: -return_amount },
              $push: {
                debt_history: {
                  type: 'pay',
                  amount: return_amount,
                  date: new Date(),
                  note: `Trả đơn hàng ${returnImport.product_name}${returnImport.imei ? ` (IMEI: ${returnImport.imei})` : ''} - ${return_amount}đ`,
                  related_id: returnImport._id.toString()
                }
              }
            },
            { upsert: true }
          );
        } catch (e) {
          console.error('⚠️ Ghi lịch sử công nợ NCC (pay) lỗi:', e.message);
        }
      } else {
        console.log(`⚠️ Original item not found: ${original_inventory_id}`);
      }
    } else {
      // ✅ Trả bằng nguồn tiền: Tạo phiếu thu trong sổ quỹ (vì nhận lại tiền từ nhà cung cấp)
      const returnCash = Number(return_cash) || 0;
      const returnTransfer = Number(return_transfer) || 0;
      
      if (!hasPayments) {
        if (returnCash > 0) {
          await Cashbook.create({
            type: 'thu', // ✅ Phiếu thu vì nhận lại tiền
            amount: returnCash,
            content: `Hoàn tiền trả hàng nhập: ${returnImport.product_name}${returnImport.imei ? ` (IMEI: ${returnImport.imei})` : ''}`,
            category: 'hoan_tien_tra_hang',
            source: 'tien_mat',
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

        if (returnTransfer > 0) {
          await Cashbook.create({
            type: 'thu', // ✅ Phiếu thu vì nhận lại tiền
            amount: returnTransfer,
            content: `Hoàn tiền trả hàng nhập: ${returnImport.product_name}${returnImport.imei ? ` (IMEI: ${returnImport.imei})` : ''}`,
            category: 'hoan_tien_tra_hang',
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
      }

      // payments[] đa nguồn
      if (hasPayments) {
        for (const p of payments) {
          if (!p || !p.amount) continue;
          await Cashbook.create({
            type: 'thu', // ✅ Phiếu thu vì nhận lại tiền
            amount: Number(p.amount),
            content: `Hoàn tiền trả hàng nhập: ${returnImport.product_name}${returnImport.imei ? ` (IMEI: ${returnImport.imei})` : ''}`,
            category: 'hoan_tien_tra_hang',
            source: p.source || 'tien_mat',
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
      }
    }

    res.status(201).json({
      message: returnMethod === 'cong_no' 
        ? 'Tạo phiếu trả hàng và trừ công nợ nhà cung cấp thành công'
        : 'Tạo phiếu trả hàng và tạo phiếu thu hoàn tiền thành công',
      returnImport
    });
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
        payload_snapshot: {
          return_code: returnImport.return_code,
          product_name: returnImport.product_name,
          imei: returnImport.imei,
          return_amount: returnImport.return_amount,
          supplier: returnImport.supplier,
          reason: returnImport.reason,
          status: 'cancelled'
        },
        ref_id: returnImport.return_code || String(returnImport._id),
        branch: returnImport.branch
      });
    } catch (e) { }

    res.json({ message: 'Hủy phiếu trả hàng thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
});

// Lấy chi tiết phiếu trả hàng (đặt cuối để tránh conflict với /supplier-debt)
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

export default router; 