import express from 'express';
const router = express.Router();
import ActivityLog from '../models/ActivityLog.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

// Helper functions
function formatCurrency(amount) {
  if (!amount || amount === 0) return '0đ';
  return new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
}

function getRoleLabel(role) {
  const roleMap = {
    admin: 'Admin',
    thu_ngan: 'Thu ngân',
    nhan_vien_ban_hang: 'Nhân viên bán hàng',
    user: 'User'
  };
  return roleMap[role] || role;
}

// Helper: tạo mô tả chi tiết cho lịch sử hoạt động theo chuẩn nghiệp vụ
function createDetailedDescription(item) {
  const payload = item.payload_snapshot || {};
  const username = item.username || 'Hệ thống';
  const role = getRoleLabel(item.role);
  
  // Debug log để kiểm tra
  console.log('🔍 Creating description for:', { module: item.module, action: item.action, payload });
  
  switch (item.module) {
    case 'nhap_hang':
      if (item.action === 'create') {
        const receiptCode = payload.receipt_code || payload.ref_id || 'N/A';
        return `Nhân viên ${username} (${role}) tạo phiếu nhập hàng #${receiptCode} - Sản phẩm: ${payload.product_name || 'N/A'}${payload.imei ? ` (IMEI: ${payload.imei})` : ''} - Giá nhập: ${formatCurrency(payload.price_import || 0)}${payload.supplier ? ` - Nhà cung cấp: ${payload.supplier}` : ''} - Số lượng: ${payload.quantity || 1}`;
      }
      if (item.action === 'update') {
        const receiptCode = payload.receipt_code || payload.ref_id || 'N/A';
        return `Nhân viên ${username} (${role}) cập nhật phiếu nhập hàng #${receiptCode} - Sản phẩm: ${payload.product_name || 'N/A'}`;
      }
      return `Nhân viên ${username} (${role}) thao tác với phiếu nhập hàng`;
      
    case 'xuat_hang':
      if (item.action === 'create') {
        const orderCode = payload.order_code || payload.ref_id || 'N/A';
        return `Nhân viên ${username} (${role}) tạo đơn bán hàng #${orderCode} - Sản phẩm: ${payload.product_name || 'N/A'}${payload.imei ? ` (IMEI: ${payload.imei})` : ''} - Giá bán: ${formatCurrency(payload.price_sell || 0)}${payload.customer_name ? ` - Khách hàng: ${payload.customer_name}` : ''} - Số lượng: ${payload.quantity || 1}`;
      }
      if (item.action === 'update') {
        const orderCode = payload.order_code || payload.ref_id || 'N/A';
        return `Nhân viên ${username} (${role}) cập nhật đơn bán hàng #${orderCode} - Sản phẩm: ${payload.product_name || 'N/A'}`;
      }
      return `Nhân viên ${username} (${role}) thao tác với đơn bán hàng`;
      
    case 'return_export':
      if (item.action === 'create') {
        const returnCode = payload.return_code || payload.ref_id || 'N/A';
        return `Nhân viên ${username} (${role}) tạo phiếu trả hàng bán #${returnCode} - Sản phẩm: ${payload.product_name || 'N/A'}${payload.imei ? ` (IMEI: ${payload.imei})` : ''} - Số tiền hoàn: ${formatCurrency(payload.return_amount || 0)}${payload.customer_name ? ` - Khách hàng: ${payload.customer_name}` : ''} - Lý do: ${payload.reason || 'Không rõ'}`;
      }
      if (item.action === 'delete') {
        const returnCode = payload.return_code || payload.ref_id || 'N/A';
        return `Nhân viên ${username} (${role}) hủy phiếu trả hàng bán #${returnCode} - Sản phẩm: ${payload.product_name || 'N/A'}`;
      }
      return `Nhân viên ${username} (${role}) thao tác với phiếu trả hàng bán`;
      
    case 'return_import':
      if (item.action === 'create') {
        const returnCode = payload.return_code || payload.ref_id || 'N/A';
        return `Nhân viên ${username} (${role}) tạo phiếu trả hàng nhập #${returnCode} - Sản phẩm: ${payload.product_name || 'N/A'}${payload.imei ? ` (IMEI: ${payload.imei})` : ''} - Số tiền hoàn: ${formatCurrency(payload.return_amount || 0)}${payload.supplier ? ` - Nhà cung cấp: ${payload.supplier}` : ''} - Lý do: ${payload.reason || 'Không rõ'}`;
      }
      if (item.action === 'delete') {
        const returnCode = payload.return_code || payload.ref_id || 'N/A';
        return `Nhân viên ${username} (${role}) hủy phiếu trả hàng nhập #${returnCode} - Sản phẩm: ${payload.product_name || 'N/A'}`;
      }
      return `Nhân viên ${username} (${role}) thao tác với phiếu trả hàng nhập`;
      
    case 'cashbook':
      if (item.action === 'create') {
        const receiptCode = payload.receipt_code || payload.ref_id || 'N/A';
        const typeLabel = payload.type === 'thu' ? 'phiếu thu' : 'phiếu chi';
        return `Nhân viên ${username} (${role}) tạo ${typeLabel} #${receiptCode} - Nội dung: ${payload.content || 'N/A'} - Số tiền: ${formatCurrency(payload.amount || 0)}${payload.customer ? ` - Khách hàng: ${payload.customer}` : ''}${payload.supplier ? ` - Nhà cung cấp: ${payload.supplier}` : ''} - Số dư sau: ${formatCurrency(payload.balance_after || 0)}`;
      }
      if (item.action === 'update') {
        const receiptCode = payload.receipt_code || payload.ref_id || 'N/A';
        if (payload.before && payload.after) {
          const before = payload.before;
          const after = payload.after;
          return `Nhân viên ${username} (${role}) cập nhật phiếu #${receiptCode} - Nội dung: ${after.content || 'N/A'} - Số tiền từ ${formatCurrency(before.amount || 0)} thành ${formatCurrency(after.amount || 0)}${after.customer ? ` - Khách hàng: ${after.customer}` : ''}${after.supplier ? ` - Nhà cung cấp: ${after.supplier}` : ''}`;
        }
        // Xử lý dữ liệu cũ - có thể payload chứa toàn bộ object
        if (payload.content || payload.amount) {
          return `Nhân viên ${username} (${role}) cập nhật phiếu sổ quỹ #${receiptCode} - Nội dung: ${payload.content || 'N/A'} - Số tiền: ${formatCurrency(payload.amount || 0)}${payload.customer ? ` - Khách hàng: ${payload.customer}` : ''}${payload.supplier ? ` - Nhà cung cấp: ${payload.supplier}` : ''}`;
        }
        // Fallback cho dữ liệu cũ không có thông tin chi tiết
        return `Nhân viên ${username} (${role}) cập nhật phiếu sổ quỹ #${receiptCode} - Thông tin chi tiết không khả dụng`;
      }
      if (item.action === 'delete') {
        const receiptCode = payload.receipt_code || payload.ref_id || 'N/A';
        return `Nhân viên ${username} (${role}) xóa phiếu sổ quỹ #${receiptCode} - Nội dung: ${payload.content || 'N/A'} - Số tiền: ${formatCurrency(payload.amount || 0)}`;
      }
      return `Nhân viên ${username} (${role}) thao tác với sổ quỹ`;
      
    case 'user':
      if (item.action === 'create') {
        return `Nhân viên ${username} (${role}) tạo tài khoản mới - Email: ${payload.email || 'N/A'} - Vai trò: ${getRoleLabel(payload.role)}${payload.full_name ? ` - Họ tên: ${payload.full_name}` : ''}${payload.branch_name ? ` - Chi nhánh: ${payload.branch_name}` : ''}`;
      }
      if (item.action === 'update') {
        return `Nhân viên ${username} (${role}) cập nhật thông tin tài khoản - Email: ${payload.email || 'N/A'}${payload.full_name ? ` - Họ tên: ${payload.full_name}` : ''}`;
      }
      if (item.action === 'delete') {
        return `Nhân viên ${username} (${role}) xóa tài khoản - Email: ${payload.email || 'N/A'}`;
      }
      return `Nhân viên ${username} (${role}) thao tác với tài khoản người dùng`;
      
    case 'inventory':
      if (item.action === 'create') {
        return `Nhân viên ${username} (${role}) tạo sản phẩm mới - Tên: ${payload.product_name || 'N/A'}${payload.imei ? ` (IMEI: ${payload.imei})` : ''} - Số lượng: ${payload.quantity || 0} - Giá nhập: ${formatCurrency(payload.price_import || 0)}${payload.supplier ? ` - Nhà cung cấp: ${payload.supplier}` : ''}`;
      }
      if (item.action === 'update') {
        return `Nhân viên ${username} (${role}) cập nhật sản phẩm - Tên: ${payload.product_name || 'N/A'}${payload.imei ? ` (IMEI: ${payload.imei})` : ''} - Số lượng: ${payload.quantity || 0} - Trạng thái: ${payload.status === 'in_stock' ? 'Còn hàng' : 'Hết hàng'}`;
      }
      if (item.action === 'delete') {
        return `Nhân viên ${username} (${role}) xóa sản phẩm - Tên: ${payload.product_name || 'N/A'}${payload.imei ? ` (IMEI: ${payload.imei})` : ''} - Số lượng: ${payload.quantity || 0}`;
      }
      if (item.action === 'adjust') {
        return `Nhân viên ${username} (${role}) điều chỉnh tồn kho - Sản phẩm: ${payload.product_name || 'N/A'}${payload.imei ? ` (IMEI: ${payload.imei})` : ''} - Số lượng từ ${payload.old_quantity || 0} thành ${payload.new_quantity || 0} - Lý do: ${payload.reason || 'Không rõ'}`;
      }
      return `Nhân viên ${username} (${role}) thao tác với sản phẩm - Tên: ${payload.product_name || 'N/A'}`;
      
    case 'cong_no':
      if (item.action === 'create') {
        return `Nhân viên ${username} (${role}) tạo công nợ - ${payload.customer_name || payload.supplier || 'Đối tác'}: ${formatCurrency(payload.amount || 0)} - Loại: ${payload.type === 'customer' ? 'Công nợ khách hàng' : 'Công nợ nhà cung cấp'}`;
      }
      if (item.action === 'update') {
        if (payload.paid_amount) {
          return `Nhân viên ${username} (${role}) thu nợ khách hàng - Khách hàng: ${payload.customer_name || 'N/A'}${payload.customer_phone ? ` (${payload.customer_phone})` : ''} - Số tiền thu: ${formatCurrency(payload.paid_amount)} - Nợ còn lại: ${formatCurrency(payload.remaining_debt || 0)}`;
        }
        if (payload.added_amount) {
          return `Nhân viên ${username} (${role}) cộng nợ khách hàng - Khách hàng: ${payload.customer_name || 'N/A'} - Số tiền cộng: ${formatCurrency(payload.added_amount)}`;
        }
        return `Nhân viên ${username} (${role}) cập nhật công nợ - ${payload.customer_name || payload.supplier || 'Đối tác'}: ${formatCurrency(payload.amount || 0)}`;
      }
      return `Nhân viên ${username} (${role}) thao tác với công nợ`;
      
    case 'supplier_debt':
      if (item.action === 'create') {
        return `Hệ thống cộng nợ nhà cung cấp - Nhà cung cấp: ${payload.supplier_name || 'N/A'}${payload.supplier_phone ? ` (${payload.supplier_phone})` : ''} - Số tiền: ${formatCurrency(payload.amount || 0)} - Chi nhánh: ${payload.branch || 'N/A'}${payload.note ? ` - Ghi chú: ${payload.note}` : ''}`;
      }
      if (item.action === 'update') {
        if (payload.paid_amount) {
          return `Hệ thống trả nợ nhà cung cấp - Nhà cung cấp: ${payload.supplier_name || 'N/A'}${payload.supplier_phone ? ` (${payload.supplier_phone})` : ''} - Số tiền trả: ${formatCurrency(payload.paid_amount)} - Nợ còn lại: ${formatCurrency(payload.remaining_debt || 0)} - Chi nhánh: ${payload.branch || 'N/A'}${payload.note ? ` - Ghi chú: ${payload.note}` : ''}`;
        }
        return `Hệ thống cập nhật công nợ nhà cung cấp - Nhà cung cấp: ${payload.supplier_name || 'N/A'}`;
      }
      return `Hệ thống thao tác với công nợ nhà cung cấp`;
      
    case 'xuat_hang':
      if (item.action === 'create') {
        if (payload.export_type === 'accessory') {
          return `Nhân viên ${username} (${role}) tạo đơn xuất hàng phụ kiện - Sản phẩm: ${payload.product_name || 'N/A'} (SKU: ${payload.sku || 'N/A'}) - Số lượng: ${payload.quantity || 0} - Giá bán: ${formatCurrency(payload.price_sell || 0)}${payload.customer_name ? ` - Khách hàng: ${payload.customer_name}` : ''}${payload.customer_phone ? ` (${payload.customer_phone})` : ''} - Đã thanh toán: ${formatCurrency(payload.total_paid || 0)}`;
        } else {
          return `Nhân viên ${username} (${role}) tạo đơn xuất hàng - Sản phẩm: ${payload.product_name || 'N/A'}${payload.imei ? ` (IMEI: ${payload.imei})` : ''} - Giá bán: ${formatCurrency(payload.price_sell || 0)}${payload.customer_name ? ` - Khách hàng: ${payload.customer_name}` : ''}${payload.customer_phone ? ` (${payload.customer_phone})` : ''} - Đã thanh toán: ${formatCurrency(payload.total_paid || 0)}`;
        }
      }
      return `Nhân viên ${username} (${role}) thao tác với đơn xuất hàng`;
      
    case 'category':
      if (item.action === 'create') {
        return `Nhân viên ${username} (${role}) tạo danh mục mới - Tên: ${payload.name || 'N/A'} - Mô tả: ${payload.description || 'Không có'}`;
      }
      if (item.action === 'update') {
        return `Nhân viên ${username} (${role}) cập nhật danh mục - Tên: ${payload.name || 'N/A'}`;
      }
      return `Nhân viên ${username} (${role}) thao tác với danh mục`;
      
    case 'branch':
      if (item.action === 'create') {
        return `Nhân viên ${username} (${role}) tạo chi nhánh mới - Tên: ${payload.name || 'N/A'} - Địa chỉ: ${payload.address || 'Không có'}`;
      }
      if (item.action === 'update') {
        return `Nhân viên ${username} (${role}) cập nhật thông tin chi nhánh - Tên: ${payload.name || 'N/A'}`;
      }
      return `Nhân viên ${username} (${role}) thao tác với chi nhánh`;
      
    default:
      // Fallback: tạo mô tả từ module và action
      const moduleMap = {
        'nhap_hang': 'phiếu nhập hàng',
        'xuat_hang': 'đơn bán hàng', 
        'return_export': 'phiếu trả hàng bán',
        'return_import': 'phiếu trả hàng nhập',
        'cashbook': 'sổ quỹ',
        'user': 'tài khoản người dùng',
        'inventory': 'tồn kho',
        'cong_no': 'công nợ',
        'category': 'danh mục',
        'branch': 'chi nhánh'
      };
      
      const actionMap = {
        'create': 'tạo',
        'update': 'cập nhật',
        'delete': 'xóa',
        'return': 'trả',
        'sale': 'bán',
        'purchase': 'nhập',
        'adjust': 'điều chỉnh',
        'other': 'thao tác'
      };
      
      const moduleVi = moduleMap[item.module] || item.module;
      const actionVi = actionMap[item.action] || item.action;
      
      return `Nhân viên ${username} (${role}) ${actionVi} ${moduleVi}`;
  }
}

// Chỉ admin và quản lý được xem log
router.get('/', authenticateToken, requireRole(['admin','thu_ngan']), async (req, res) => {
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
    if (req.user.role === 'thu_ngan' && req.user.branch_name) {
      query.branch = req.user.branch_name;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const items = await ActivityLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));
    const total = await ActivityLog.countDocuments(query);

    const detailed = items.map(i => {
      const item = i.toObject();
      console.log('🔍 Raw item:', { module: item.module, action: item.action, payload: item.payload_snapshot });
      
      // Sử dụng mô tả đã lưu hoặc tạo mới nếu chưa có
      let description = item.description;
      if (!description) {
        try {
          description = createDetailedDescription(item);
          console.log('🔍 Generated new description:', description);
          
          // Cập nhật mô tả vào database (async, không cần chờ)
          ActivityLog.findByIdAndUpdate(item._id, { description }).catch(e => {});
        } catch (error) {
          console.error('🔍 Error creating description:', error);
          description = `Nhân viên ${item.username || 'Hệ thống'} (${item.role || 'User'}) ${item.action || 'thao tác'} ${item.module || 'mục'}`;
        }
      } else {
        console.log('🔍 Using saved description:', description);
      }
      
      return {
        ...item,
        description: description
      };
    });
    
    console.log('🔍 Final response:', { itemsCount: detailed.length, firstItem: detailed[0] });
    res.json({ items: detailed, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi khi lấy activity logs', error: err.message });
  }
});

export default router;


