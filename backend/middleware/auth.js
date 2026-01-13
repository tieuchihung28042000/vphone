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

  // Admin tổng (không có branch_id) có thể truy cập tất cả chi nhánh
  if (req.user.role === 'admin' && !req.user.branch_id) {
    return next();
  }

  // Admin chi nhánh hoặc user khác chỉ truy cập chi nhánh của mình
  if (!req.user.branch_id && !req.user.branch_name) {
    return res.status(403).json({ message: 'User not assigned to any branch' });
  }

  // Thêm branch filter vào query nếu có
  if (req.query.branch && req.user.branch_name && req.user.branch_name !== req.query.branch) {
    return res.status(403).json({ message: 'Access denied to this branch (query)' });
  }

  // Kiểm tra branch trong body cho các mutation
  if (req.body.branch && req.user.branch_name && req.user.branch_name !== req.body.branch) {
    return res.status(403).json({ message: 'Access denied to this branch (body)' });
  }

  // Tự động set branch filter nếu user có branch_name
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

  // Admin tổng (không có branch_id) có thể xem tất cả
  if (req.user.role === 'admin' && !req.user.branch_id) {
    return next();
  }

  // Admin chi nhánh, nhân viên hoặc thu ngân chỉ xem chi nhánh của mình
  if (req.user.branch_name) {
    req.branchFilter = { branch: req.user.branch_name };
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