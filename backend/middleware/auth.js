import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Middleware xác thực JWT
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'vphone_secret_key');

    // Lấy thông tin user từ database để đảm bảo thông tin mới nhất
    const user = await User.findById(decoded.id).populate('branch_id');

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    if (!user.approved) {
      return res.status(401).json({ message: 'User not approved' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Middleware kiểm tra quyền theo vai trò
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userRole = req.user.role;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    next();
  };
};

// Middleware kiểm tra quyền truy cập theo chi nhánh
const requireBranch = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  // Admin tổng (role === 'admin' và không có branch_id) có thể truy cập tất cả chi nhánh
  if (req.user.role === 'admin' && !req.user.branch_id) {
    return next();
  }

  // Admin chi nhánh (quan_ly_chi_nhanh) PHẢI có branch_id và branch_name
  if (req.user.role === 'quan_ly_chi_nhanh') {
    if (!req.user.branch_id || !req.user.branch_name) {
      return res.status(403).json({ 
        message: 'Admin chi nhánh phải được gán vào một chi nhánh. Vui lòng liên hệ quản trị viên để cập nhật thông tin chi nhánh.' 
      });
    }
  }

  // Các role khác (thu_ngan, nhan_vien_ban_hang) cũng cần branch info
  if (req.user.role !== 'admin' && !req.user.branch_id && !req.user.branch_name) {
    return res.status(403).json({ 
      message: 'Người dùng chưa được gán vào chi nhánh nào. Vui lòng liên hệ quản trị viên.' 
    });
  }

  // Kiểm tra branch trong query parameter
  if (req.query.branch && req.user.branch_name && req.query.branch !== 'all' && req.query.branch !== req.user.branch_name) {
    return res.status(403).json({ message: 'Không đủ quyền truy cập vào chi nhánh này' });
  }

  // Kiểm tra branch trong body cho các mutation
  if (req.body.branch && req.user.branch_name && req.body.branch !== req.user.branch_name) {
    return res.status(403).json({ message: 'Không đủ quyền thao tác với chi nhánh này' });
  }

  // Tự động set branch filter nếu user có branch_name và chưa có trong query
  if (req.user.branch_name && !req.query.branch) {
    req.query.branch = req.user.branch_name;
  }

  next();
};

// Middleware lọc dữ liệu theo chi nhánh
const filterByBranch = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  // Admin tổng (role === 'admin' và không có branch_id) có thể xem tất cả
  if (req.user.role === 'admin' && !req.user.branch_id) {
    return next();
  }

  // Admin chi nhánh, nhân viên hoặc thu ngân chỉ xem chi nhánh của mình
  if (req.user.branch_name) {
    req.branchFilter = { branch: req.user.branch_name };
  } else if (req.user.role !== 'admin') {
    // Nếu không phải admin tổng và không có branch_name, trả về lỗi
    return res.status(403).json({ 
      message: 'Người dùng chưa được gán vào chi nhánh nào. Vui lòng liên hệ quản trị viên.' 
    });
  }

  next();
};

// Middleware kiểm tra quyền truy cập báo cáo
const requireReportAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  // Thu ngân có thể xem báo cáo nhưng chỉ của chi nhánh mình
  // Admin tổng (không có branch_id) có thể xem tất cả
  // Admin chi nhánh hoặc thu ngân chỉ xem chi nhánh của mình
  if (req.user.branch_name && !req.query.branch) {
    req.query.branch = req.user.branch_name;
  } else if (req.user.branch_name && req.query.branch && req.query.branch !== 'all' && req.query.branch !== req.user.branch_name) {
    return res.status(403).json({ message: 'Access denied to this branch' });
  }

  next();
};

export {
  authenticateToken,
  requireRole,
  requireBranch,
  filterByBranch,
  requireReportAccess
}; 