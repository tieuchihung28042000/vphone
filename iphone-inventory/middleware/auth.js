const jwt = require('jsonwebtoken');
const User = require('../models/User');

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
    return res.status(403).json({ message: 'Invalid token' });
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

  // Admin có thể truy cập tất cả chi nhánh
  if (req.user.role === 'admin') {
    return next();
  }

  // Kiểm tra xem user có branch_id không
  if (!req.user.branch_id) {
    return res.status(403).json({ message: 'User not assigned to any branch' });
  }

  // Thêm branch filter vào query nếu có
  if (req.query.branch && req.user.branch_name !== req.query.branch) {
    return res.status(403).json({ message: 'Access denied to this branch' });
  }

  next();
};

// Middleware lọc dữ liệu theo chi nhánh
const filterByBranch = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  // Admin có thể xem tất cả
  if (req.user.role === 'admin') {
    return next();
  }

  // Thêm filter chi nhánh vào query
  req.branchFilter = { branch: req.user.branch_name };
  
  next();
};

// Middleware kiểm tra quyền truy cập báo cáo
const requireReportAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  // Thu ngân không được xem báo cáo
  if (req.user.role === 'thu_ngan') {
    return res.status(403).json({ message: 'Cashiers cannot access reports' });
  }

  next();
};

module.exports = {
  authenticateToken,
  requireRole,
  requireBranch,
  filterByBranch,
  requireReportAccess
}; 