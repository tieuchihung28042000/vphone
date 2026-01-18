import express from 'express';
import User from '../models/User.js';
import Branch from '../models/Branch.js';
import ActivityLog from '../models/ActivityLog.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

const router = express.Router();

// API lấy danh sách user chưa duyệt
router.get('/pending-users', authenticateToken, requireRole(['admin', 'thu_ngan']), async (req, res) => {
  try {
    const pendingUsers = await User.find({ approved: false }).populate('branch_id');
    res.status(200).json(pendingUsers);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server khi lấy danh sách user chưa duyệt', error: error.message });
  }
});

// API lấy tất cả user
router.get('/all-users', authenticateToken, requireRole(['admin', 'thu_ngan']), async (req, res) => {
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
router.post('/approve-user/:id', authenticateToken, requireRole(['admin', 'thu_ngan']), async (req, res) => {
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

    // Ghi nhận hoạt động
    try {
      await ActivityLog.create({
        user_id: req.user?._id,
        username: req.user?.username || req.user?.email || '',
        role: req.user?.role,
        action: 'update',
        module: 'user',
        payload_snapshot: {
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          approved: true,
          branch_name: user.branch_id?.name || 'N/A'
        },
        ref_id: user.email || String(user._id),
        branch: req.user?.branch_name || 'N/A'
      });
    } catch (e) { /* ignore log error */ }

    res.status(200).json({ message: 'Phê duyệt user thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server khi phê duyệt user', error: error.message });
  }
});

// API cập nhật vai trò user
router.put('/update-role/:id', authenticateToken, requireRole(['admin', 'thu_ngan']), async (req, res) => {
  try {
    const userId = req.params.id;
    const { role } = req.body;

    const validRoles = ['user', 'admin', 'quan_ly_chi_nhanh', 'thu_ngan', 'nhan_vien_ban_hang'];
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

    const oldRole = user.role;
    user.role = role;
    await user.save();

    // Ghi nhận hoạt động
    try {
      await ActivityLog.create({
        user_id: req.user?._id,
        username: req.user?.username || req.user?.email || '',
        role: req.user?.role,
        action: 'update',
        module: 'user',
        payload_snapshot: {
          email: user.email,
          full_name: user.full_name,
          old_role: oldRole,
          new_role: role,
          branch_name: user.branch_id?.name || 'N/A'
        },
        ref_id: user.email || String(user._id),
        branch: req.user?.branch_name || 'N/A'
      });
    } catch (e) { /* ignore log error */ }

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

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User không tồn tại' });
    }

    // Ghi nhận hoạt động trước khi xóa
    try {
      await ActivityLog.create({
        user_id: req.user?._id,
        username: req.user?.username || req.user?.email || '',
        role: req.user?.role,
        action: 'delete',
        module: 'user',
        payload_snapshot: {
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          branch_name: user.branch_id?.name || 'N/A'
        },
        ref_id: user.email || String(user._id),
        branch: req.user?.branch_name || 'N/A'
      });
    } catch (e) { /* ignore log error */ }

    await User.findByIdAndDelete(userId);
    res.status(200).json({ message: 'Xóa user thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server khi xóa user', error: error.message });
  }
});

export default router;

// =============== APIs mở rộng quản lý user ===============
// Đổi mật khẩu
router.put('/change-password/:id', authenticateToken, requireRole(['admin', 'thu_ngan']), async (req, res) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User không tồn tại' });

    // Nếu không phải admin và đổi mật khẩu người khác → chặn
    if (req.user.role !== 'admin' && String(req.user._id) !== String(id)) {
      return res.status(403).json({ message: 'Không có quyền đổi mật khẩu người khác' });
    }

    if (req.user.role !== 'admin') {
      // kiểm tra currentPassword khi tự đổi mật khẩu
      const ok = await bcrypt.compare(currentPassword || '', user.password || '');
      if (!ok) return res.status(400).json({ message: 'Mật khẩu hiện tại không đúng' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;
    await user.save();
    res.json({ message: 'Đổi mật khẩu thành công' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi đổi mật khẩu', error: err.message });
  }
});

// Cập nhật thông tin user
router.put('/update/:id', authenticateToken, requireRole(['admin', 'thu_ngan']), async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, email, phone, branch_id, branch_name, role } = req.body;

    const target = await User.findById(id);
    if (!target) return res.status(404).json({ message: 'User không tồn tại' });

    if (req.user.role !== 'admin' && String(req.user.branch_id) !== String(target.branch_id)) {
      return res.status(403).json({ message: 'Chỉ cập nhật user trong chi nhánh của bạn' });
    }

    if (role === 'admin' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Chỉ admin mới gán quyền admin' });
    }

    if (email && email !== target.email) {
      const exists = await User.findOne({ email });
      if (exists) return res.status(400).json({ message: 'Email đã tồn tại' });
      target.email = email;
    }

    if (full_name !== undefined) target.full_name = full_name;
    if (phone !== undefined) target.phone = phone;

    // Xử lý role và branch_id
    const newRole = role !== undefined ? role : target.role;
    
    // Nếu cập nhật role thành admin tổng, clear branch info
    if (role === 'admin') {
      target.branch_id = null;
      target.branch_name = null;
    } else if (role === 'quan_ly_chi_nhanh') {
      // Nếu cập nhật role thành quan_ly_chi_nhanh, phải có branch_id
    if (branch_id !== undefined) {
        if (!branch_id || branch_id === '') {
          return res.status(400).json({ message: 'Admin chi nhánh phải được gán vào một chi nhánh' });
        }
        
        // Validate branch_id
        if (!mongoose.Types.ObjectId.isValid(branch_id)) {
          return res.status(400).json({ message: 'ID chi nhánh không hợp lệ' });
        }
        
        // Kiểm tra branch tồn tại
        const branch = await Branch.findById(branch_id);
        if (!branch) {
          return res.status(400).json({ message: 'Chi nhánh không tồn tại trong hệ thống' });
        }
        
        target.branch_id = branch_id;
        // Tự động lấy branch_name nếu không có
        target.branch_name = branch_name || branch.name;
      } else if (!target.branch_id) {
        // Nếu đang cập nhật role thành quan_ly_chi_nhanh mà chưa có branch_id
        return res.status(400).json({ message: 'Admin chi nhánh phải được gán vào một chi nhánh' });
      }
    } else if (branch_id !== undefined) {
      // Các role khác (thu_ngan, nhan_vien_ban_hang)
      if (branch_id === '' || branch_id === null) {
        target.branch_id = null;
        target.branch_name = null;
      } else {
        // Validate branch_id
        if (!mongoose.Types.ObjectId.isValid(branch_id)) {
          return res.status(400).json({ message: 'ID chi nhánh không hợp lệ' });
        }
        
        const branch = await Branch.findById(branch_id);
        if (!branch) {
          return res.status(400).json({ message: 'Chi nhánh không tồn tại trong hệ thống' });
        }
        
        target.branch_id = branch_id;
        target.branch_name = branch_name || branch.name;
      }
    }
    
    if (role !== undefined) {
      target.role = role;
    }

    await target.save();
    res.json({ message: 'Cập nhật user thành công' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi cập nhật user', error: err.message });
  }
});

// Xóa user
router.delete('/:id', authenticateToken, requireRole(['admin', 'thu_ngan']), async (req, res) => {
  try {
    const { id } = req.params;
    if (String(req.user._id) === String(id)) {
      return res.status(400).json({ message: 'Không thể tự xóa chính mình' });
    }
    const target = await User.findById(id);
    if (!target) return res.status(404).json({ message: 'User không tồn tại' });
    if (target.role === 'admin' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Không thể xóa admin' });
    }
    if (req.user.role !== 'admin' && String(req.user.branch_id) !== String(target.branch_id)) {
      return res.status(403).json({ message: 'Chỉ xóa user trong chi nhánh của bạn' });
    }
    await target.deleteOne();
    res.json({ message: 'Xóa user thành công' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi xóa user', error: err.message });
  }
});
