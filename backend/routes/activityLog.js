import express from 'express';
import ActivityLog from '../models/ActivityLog.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// GET /api/activity-logs - Lấy danh sách lịch sử hoạt động
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, user, module, branch, startDate, endDate } = req.query;
    
    // Tạo filter object
    const filter = {};
    
    if (user) filter.user = user;
    if (module) filter.module = module;
    if (branch) filter.branch = branch;
    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }
    
    // Tính toán skip
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Lấy dữ liệu với pagination
    const logs = await ActivityLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    // Đếm tổng số records
    const total = await ActivityLog.countDocuments(filter);
    
    res.json({
      success: true,
      data: logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi khi lấy lịch sử hoạt động',
      error: error.message 
    });
  }
});

export default router;
