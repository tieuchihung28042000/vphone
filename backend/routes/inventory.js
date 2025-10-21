import express from 'express';
import Inventory from '../models/Inventory.js';
import ActivityLog from '../models/ActivityLog.js';
import { authenticateToken, requireRole, filterByBranch } from '../middleware/auth.js';

const router = express.Router();

// GET /api/inventory - Lấy danh sách inventory
router.get('/', authenticateToken, filterByBranch, async (req, res) => {
  try {
    const { page = 1, limit = 10, search, category, branch } = req.query;
    
    // Tạo filter object
    const filter = {};
    
    if (search) {
      filter.$or = [
        { product_name: { $regex: search, $options: 'i' } },
        { imei: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (category) filter.category = category;
    if (branch) filter.branch = branch;
    
    // Tính toán skip
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Lấy dữ liệu với pagination
    const inventories = await Inventory.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    // Đếm tổng số records
    const total = await Inventory.countDocuments(filter);
    
    res.json({
      success: true,
      data: inventories,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi khi lấy danh sách inventory',
      error: error.message 
    });
  }
});

// POST /api/inventory - Tạo inventory mới
router.post('/', authenticateToken, requireRole(['admin', 'thu_ngan']), async (req, res) => {
  try {
    const inventory = new Inventory(req.body);
    await inventory.save();
    
    // Ghi nhận hoạt động
    try {
      const activityData = {
        user_id: req.user?._id,
        username: req.user?.username || req.user?.email || '',
        role: req.user?.role,
        action: 'create',
        module: 'inventory',
        payload_snapshot: {
          product_name: inventory.product_name,
          imei: inventory.imei,
          quantity: inventory.quantity,
          price_import: inventory.price_import,
          supplier: inventory.supplier,
          category: inventory.category
        },
        ref_id: inventory.imei || String(inventory._id),
        branch: inventory.branch
      };
      
      // Tạo mô tả chi tiết
      const roleLabel = req.user?.role === 'admin' ? 'Admin' : (req.user?.role === 'thu_ngan' ? 'Thu ngân' : 'User');
      activityData.description = `Nhân viên ${activityData.username} (${roleLabel}) tạo sản phẩm mới - Tên: ${inventory.product_name || 'N/A'}${inventory.imei ? ` (IMEI: ${inventory.imei})` : ''} - Số lượng: ${inventory.quantity || 0} - Giá nhập: ${new Intl.NumberFormat('vi-VN').format(inventory.price_import || 0)}đ${inventory.supplier ? ` - Nhà cung cấp: ${inventory.supplier}` : ''}`;
      
      await ActivityLog.create(activityData);
    } catch (e) { /* ignore log error */ }
    
    res.status(201).json({
      success: true,
      data: inventory,
      message: 'Tạo inventory thành công'
    });
  } catch (error) {
    console.error('Error creating inventory:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi khi tạo inventory',
      error: error.message 
    });
  }
});

// PUT /api/inventory/:id - Cập nhật inventory
router.put('/:id', authenticateToken, requireRole(['admin', 'thu_ngan']), async (req, res) => {
  try {
    const { quantity, ...otherFields } = req.body;
    
    // ✅ Tự động cập nhật status dựa trên quantity
    let updateData = { ...otherFields };
    if (quantity !== undefined) {
      updateData.quantity = quantity;
      // Logic: nếu quantity > 0 thì status = 'in_stock', nếu quantity = 0 thì status = 'sold'
      updateData.status = quantity > 0 ? 'in_stock' : 'sold';
    }
    
    const inventory = await Inventory.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy inventory'
      });
    }
    
    // Ghi nhận hoạt động
    try {
      const activityData = {
        user_id: req.user?._id,
        username: req.user?.username || req.user?.email || '',
        role: req.user?.role,
        action: 'update',
        module: 'inventory',
        payload_snapshot: {
          product_name: inventory.product_name,
          imei: inventory.imei,
          quantity: inventory.quantity,
          price_import: inventory.price_import,
          supplier: inventory.supplier,
          status: inventory.status
        },
        ref_id: inventory.imei || String(inventory._id),
        branch: inventory.branch
      };
      
      // Tạo mô tả chi tiết
      const roleLabel = req.user?.role === 'admin' ? 'Admin' : (req.user?.role === 'thu_ngan' ? 'Thu ngân' : 'User');
      activityData.description = `Nhân viên ${activityData.username} (${roleLabel}) cập nhật sản phẩm - Tên: ${inventory.product_name || 'N/A'}${inventory.imei ? ` (IMEI: ${inventory.imei})` : ''} - Số lượng: ${inventory.quantity || 0} - Trạng thái: ${inventory.status === 'in_stock' ? 'Còn hàng' : 'Hết hàng'}`;
      
      await ActivityLog.create(activityData);
    } catch (e) { /* ignore log error */ }
    
    res.json({
      success: true,
      data: inventory,
      message: 'Cập nhật inventory thành công'
    });
  } catch (error) {
    console.error('Error updating inventory:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi khi cập nhật inventory',
      error: error.message 
    });
  }
});

// DELETE /api/inventory/:id - Xóa inventory
router.delete('/:id', authenticateToken, requireRole(['admin', 'thu_ngan']), async (req, res) => {
  try {
    const inventory = await Inventory.findById(req.params.id);
    
    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy inventory'
      });
    }
    
    // Ghi nhận hoạt động trước khi xóa
    try {
      const activityData = {
        user_id: req.user?._id,
        username: req.user?.username || req.user?.email || '',
        role: req.user?.role,
        action: 'delete',
        module: 'inventory',
        payload_snapshot: {
          product_name: inventory.product_name,
          imei: inventory.imei,
          quantity: inventory.quantity,
          price_import: inventory.price_import,
          supplier: inventory.supplier
        },
        ref_id: inventory.imei || String(inventory._id),
        branch: inventory.branch
      };
      
      // Tạo mô tả chi tiết
      const roleLabel = req.user?.role === 'admin' ? 'Admin' : (req.user?.role === 'thu_ngan' ? 'Thu ngân' : 'User');
      activityData.description = `Nhân viên ${activityData.username} (${roleLabel}) xóa sản phẩm - Tên: ${inventory.product_name || 'N/A'}${inventory.imei ? ` (IMEI: ${inventory.imei})` : ''} - Số lượng: ${inventory.quantity || 0}`;
      
      await ActivityLog.create(activityData);
    } catch (e) { /* ignore log error */ }
    
    await Inventory.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'Xóa inventory thành công'
    });
  } catch (error) {
    console.error('Error deleting inventory:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi khi xóa inventory',
      error: error.message 
    });
  }
});

export default router;

// ==================== Supplier suggestions by product/sku ====================
// GET /api/inventory/suppliers-suggest?product=...&sku=...&branch=...
router.get('/suppliers-suggest', authenticateToken, filterByBranch, async (req, res) => {
  try {
    const { product = '', sku = '', branch } = req.query;

    const match = {};
    // Text match on product_name or tenSanPham and SKU
    const ors = [];
    if (product && product.trim()) {
      ors.push({ product_name: { $regex: product.trim(), $options: 'i' } });
      ors.push({ tenSanPham: { $regex: product.trim(), $options: 'i' } });
    }
    if (sku && sku.trim()) {
      ors.push({ sku: { $regex: sku.trim(), $options: 'i' } });
    }
    if (ors.length > 0) match.$or = ors;

    // Branch restriction: if requester is limited to a branch, prefer that; otherwise use provided branch filter
    if (req.branchFilter) {
      match.branch = req.user?.branch_name;
    } else if (branch && branch !== 'all') {
      match.branch = branch;
    }

    // Only consider records that actually have a supplier name
    match.supplier = { $exists: true, $ne: '' };

    const results = await Inventory.aggregate([
      { $match: match },
      {
        $group: {
          _id: { supplier: '$supplier', branch: '$branch' },
          count: { $sum: 1 },
          last_import: { $max: '$import_date' },
          products: { $addToSet: { name: '$product_name', sku: '$sku' } }
        }
      },
      { $sort: { count: -1, last_import: -1 } },
      { $limit: 20 },
      {
        $project: {
          _id: 0,
          supplier: '$_id.supplier',
          branch: '$_id.branch',
          count: 1,
          last_import: 1,
          products: 1
        }
      }
    ]);

    return res.json({ suppliers: results });
  } catch (error) {
    console.error('Error getting supplier suggestions:', error);
    return res.status(500).json({ message: 'Lỗi lấy gợi ý nhà cung cấp', error: error.message });
  }
});

// ==================== Simple supplier name suggestions ====================
// GET /api/inventory/suppliers?search=nc&branch=...
router.get('/suppliers', authenticateToken, async (req, res) => {
  try {
    const { search = '' } = req.query;
    const match = { supplier: { $exists: true, $ne: '' } };
    if (search && search.trim()) {
      match.supplier = { $regex: search.trim(), $options: 'i' };
    }

    const results = await Inventory.aggregate([
      { $match: match },
      { $group: { _id: { supplier: '$supplier' }, count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 20 },
      { $project: { _id: 0, supplier: '$_id.supplier', count: 1 } }
    ]);
    res.json({ suppliers: results });
  } catch (e) {
    res.status(500).json({ message: 'Lỗi lấy gợi ý nhà cung cấp', error: e.message });
  }
});
