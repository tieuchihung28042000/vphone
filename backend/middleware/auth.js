import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Branch from '../models/Branch.js';

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

    // Đồng bộ branch_name từ populated branch nếu có
    if (user.branch_id) {
      // Kiểm tra nếu branch_id là object (đã được populate)
      if (user.branch_id && typeof user.branch_id === 'object' && user.branch_id.name) {
        // Branch đã được populate thành công, lấy name từ đó
        const populatedBranchName = user.branch_id.name;
        if (!user.branch_name || user.branch_name !== populatedBranchName) {
          console.log('🔄 [AUTH] Syncing branch_name from populated branch:', {
            old: user.branch_name,
            new: populatedBranchName,
            email: user.email
          });
          user.branch_name = populatedBranchName;
          // Lưu lại vào database để đồng bộ (async, không cần await)
          User.findByIdAndUpdate(user._id, { branch_name: populatedBranchName }).catch(err => {
            console.error('❌ [AUTH] Error syncing branch_name:', err.message);
          });
        }
      } else {
        // Branch chưa được populate hoặc là ObjectId string
        // Nếu branch_name chưa có, lấy từ database
        if (!user.branch_name) {
          try {
            const branchIdToQuery = typeof user.branch_id === 'object' && user.branch_id._id 
              ? user.branch_id._id 
              : user.branch_id;
            const branch = await Branch.findById(branchIdToQuery);
            if (branch && branch.name) {
              console.log('🔄 [AUTH] Fetching branch_name from database:', {
                branch_id: branchIdToQuery,
                branch_name: branch.name,
                email: user.email
              });
              user.branch_name = branch.name;
              // Lưu lại vào database
              await User.findByIdAndUpdate(user._id, { branch_name: branch.name });
            } else {
              console.error('❌ [AUTH] Branch not found:', branchIdToQuery);
            }
          } catch (err) {
            console.error('❌ [AUTH] Error fetching branch:', err.message);
          }
        }
      }
      
      // Log để debug
      console.log('✅ [AUTH] User authenticated:', {
        email: user.email,
        role: user.role,
        branch_id: user.branch_id,
        branch_name: user.branch_name,
        branch_id_type: typeof user.branch_id,
        branch_id_is_object: typeof user.branch_id === 'object'
      });
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
      console.error('❌ [REQUIRE_BRANCH] Admin chi nhánh thiếu thông tin:', {
        role: req.user.role,
        branch_id: req.user.branch_id,
        branch_name: req.user.branch_name,
        user_id: req.user._id,
        email: req.user.email
      });
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

  console.log('🔍 [FILTER_BY_BRANCH] User info:', {
    role: req.user.role,
    branch_id: req.user.branch_id,
    branch_name: req.user.branch_name,
    email: req.user.email,
    branch_id_type: typeof req.user.branch_id,
    branch_id_is_object: typeof req.user.branch_id === 'object',
    branch_id_name: req.user.branch_id?.name
  });

  // Admin tổng (role === 'admin' và không có branch_id) có thể xem tất cả
  if (req.user.role === 'admin' && !req.user.branch_id) {
    console.log('✅ [FILTER_BY_BRANCH] Admin tổng - cho phép truy cập tất cả');
    return next();
  }

  // Đồng bộ branch_name từ populated branch nếu có
  if (req.user.branch_id && typeof req.user.branch_id === 'object' && req.user.branch_id.name) {
    if (!req.user.branch_name || req.user.branch_name !== req.user.branch_id.name) {
      req.user.branch_name = req.user.branch_id.name;
      console.log('🔄 [FILTER_BY_BRANCH] Đồng bộ branch_name từ populated branch:', req.user.branch_name);
    }
  }

  // Admin chi nhánh, nhân viên hoặc thu ngân chỉ xem chi nhánh của mình
  if (req.user.branch_name) {
    req.branchFilter = { branch: req.user.branch_name };
    console.log('✅ [FILTER_BY_BRANCH] Set branch filter:', req.branchFilter);
  } else if (req.user.role !== 'admin') {
    // Nếu không phải admin tổng và không có branch_name, trả về lỗi
    console.error('❌ [FILTER_BY_BRANCH] User thiếu branch_name:', {
      role: req.user.role,
      branch_id: req.user.branch_id,
      branch_name: req.user.branch_name,
      email: req.user.email
    });
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