import express from 'express';
import Inventory from '../models/Inventory.js';
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
router.post('/', authenticateToken, requireRole(['admin', 'quan_ly']), async (req, res) => {
  try {
    const inventory = new Inventory(req.body);
    await inventory.save();
    
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
router.put('/:id', authenticateToken, requireRole(['admin', 'quan_ly']), async (req, res) => {
  try {
    const inventory = await Inventory.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy inventory'
      });
    }
    
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
router.delete('/:id', authenticateToken, requireRole(['admin', 'quan_ly']), async (req, res) => {
  try {
    const inventory = await Inventory.findByIdAndDelete(req.params.id);
    
    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy inventory'
      });
    }
    
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
