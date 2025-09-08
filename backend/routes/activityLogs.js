const express = require('express');
const router = express.Router();
const ActivityLog = require('../models/ActivityLog');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Chỉ admin và quản lý được xem log
router.get('/', authenticateToken, requireRole(['admin','quan_ly']), async (req, res) => {
  try {
    const { from, to, user, module, branch, page = 1, limit = 50 } = req.query;
    const query = {};

    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(new Date(to).setDate(new Date(to).getDate() + 1));
    }
    if (user) query.username = new RegExp(user, 'i');
    if (module && module !== 'all') query.module = module;
    if (branch && branch !== 'all') query.branch = branch;

    // Quản lý chỉ xem log trong chi nhánh của mình
    if (req.user.role === 'quan_ly' && req.user.branch_name) {
      query.branch = req.user.branch_name;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const items = await ActivityLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));
    const total = await ActivityLog.countDocuments(query);

    res.json({ items, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi khi lấy activity logs', error: err.message });
  }
});

module.exports = router;


