const express = require('express');
const User = require('../models/User');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// API lấy danh sách user chưa duyệt
router.get('/pending-users', authenticateToken, requireRole(['admin', 'quan_ly']), async (req, res) => {
  try {
    const pendingUsers = await User.find({ approved: false }).populate('branch_id');
    res.status(200).json(pendingUsers);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server khi lấy danh sách user chưa duyệt', error: error.message });
  }
});

// API lấy tất cả user
router.get('/all-users', authenticateToken, requireRole(['admin', 'quan_ly']), async (req, res) => {
  try {
    let query = {};
    
    // Nếu không phải admin, chỉ xem user trong chi nhánh của mình
    if (req.user.role !== 'admin') {
      query.branch_id = req.user.branch_id;
    }
    
    const allUsers = await User.find(query).populate('branch_id').select('-password');
    res.status(200).json(allUsers);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server khi lấy danh sách user', error: error.message });
  }
});

// API phê duyệt user (cập nhật approved = true)
router.post('/approve-user/:id', authenticateToken, requireRole(['admin', 'quan_ly']), async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User không tồn tại' });
    }

    // Nếu không phải admin, chỉ được duyệt user trong chi nhánh của mình
    if (req.user.role !== 'admin') {
      if (!req.user.branch_id || !user.branch_id || String(user.branch_id) !== String(req.user.branch_id)) {
        return res.status(403).json({ message: 'Chỉ được duyệt user trong chi nhánh của bạn' });
      }
    }

    if (user.approved) {
      return res.status(400).json({ message: 'User đã được phê duyệt trước đó' });
    }

    user.approved = true;
    await user.save();

    res.status(200).json({ message: 'Phê duyệt user thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server khi phê duyệt user', error: error.message });
  }
});

// API cập nhật vai trò user
router.put('/update-role/:id', authenticateToken, requireRole(['admin', 'quan_ly']), async (req, res) => {
  try {
    const userId = req.params.id;
    const { role } = req.body;

    const validRoles = ['user', 'admin', 'thu_ngan', 'quan_ly', 'nhan_vien_ban_hang'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Vai trò không hợp lệ' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User không tồn tại' });
    }

    // Chỉ admin mới có thể cập nhật vai trò admin
    if (role === 'admin' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Chỉ admin mới có thể tạo admin' });
    }

    // Nếu không phải admin, chỉ được đổi vai trò user trong chi nhánh của mình
    if (req.user.role !== 'admin') {
      if (!req.user.branch_id || !user.branch_id || String(user.branch_id) !== String(req.user.branch_id)) {
        return res.status(403).json({ message: 'Chỉ được cập nhật user trong chi nhánh của bạn' });
      }
    }

    user.role = role;
    await user.save();

    res.status(200).json({ message: 'Cập nhật vai trò thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server khi cập nhật vai trò', error: error.message });
  }
});

// API xóa user
router.delete('/delete-user/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const userId = req.params.id;
    
    if (userId === req.user.id) {
      return res.status(400).json({ message: 'Không thể xóa chính mình' });
    }

    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      return res.status(404).json({ message: 'User không tồn tại' });
    }

    res.status(200).json({ message: 'Xóa user thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server khi xóa user', error: error.message });
  }
});

module.exports = router;
