import express from 'express';
import ActivityLog from '../models/ActivityLog.js';
import { authenticateToken, filterByBranch } from '../middleware/auth.js';

const router = express.Router();

// GET /api/activity-logs - Lấy danh sách lịch sử hoạt động
router.get('/', authenticateToken, filterByBranch, async (req, res) => {
  try {
    const { page = 1, limit = 10, user, module, branch, startDate, endDate, from, to } = req.query;

    // Tạo filter object
    let filter = {};

    // Apply branch filter
    if (req.branchFilter) {
      filter = { ...filter, ...req.branchFilter };
    } else if (branch && branch !== 'all') {
      filter.branch = branch;
    }

    if (user) filter.username = user;
    if (module && module !== 'all') filter.module = module;

    const start = startDate || from;
    const end = endDate || to;
    if (start || end) {
      filter.createdAt = {};
      if (start) filter.createdAt.$gte = new Date(start);
      if (end) filter.createdAt.$lte = new Date(new Date(end).setHours(23, 59, 59, 999));
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
