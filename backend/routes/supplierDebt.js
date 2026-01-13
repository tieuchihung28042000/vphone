import express from 'express';
const router = express.Router();
import SupplierDebt from '../models/SupplierDebt.js';
import ActivityLog from '../models/ActivityLog.js';
import Cashbook from '../models/Cashbook.js';
import { authenticateToken, requireRole, filterByBranch } from '../middleware/auth.js';

// 1. Lấy danh sách công nợ nhà cung cấp
router.get('/list', authenticateToken, filterByBranch, async (req, res) => {
  try {
    const { search = "", branch, show_all = "false" } = req.query;

    let query = {};

    // Apply branch filter (middleware or explicit query)
    if (req.branchFilter) {
      query = { ...query, ...req.branchFilter };
    } else if (branch && branch !== 'all') {
      query.branch = branch;
    }

    // Tìm kiếm theo tên hoặc số điện thoại
    if (search.trim()) {
      query.$or = [
        { supplier_name: { $regex: search.trim(), $options: 'i' } },
        { supplier_phone: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    const suppliers = await SupplierDebt.find(query).sort({ updated_at: -1 });

    // Chỉ hiển thị nhà cung cấp còn nợ (trừ khi show_all=true)
    let result = suppliers;
    if (show_all !== "true") {
      result = suppliers.filter(supplier => supplier.total_debt > 0);
    }

    res.json({ suppliers: result });
  } catch (err) {
    res.status(500).json({ message: '❌ Lỗi server', error: err.message });
  }
});

// 2. Thêm mới hoặc cập nhật công nợ nhà cung cấp
router.post('/add-debt', authenticateToken, requireRole(['admin', 'thu_ngan']), async (req, res) => {
  try {
    const { supplier_name, supplier_phone, supplier_address, amount, note, branch, user, related_id } = req.body;

    if (!supplier_name || !amount || !branch) {
      return res.status(400).json({ message: 'Thiếu thông tin bắt buộc' });
    }

    // Kiểm tra quyền truy cập chi nhánh
    if (req.user.role !== 'admin' && branch !== req.user.branch_name) {
      return res.status(403).json({ message: 'Không có quyền thêm công nợ cho chi nhánh khác' });
    }

    // Tìm nhà cung cấp hiện có
    let supplier = await SupplierDebt.findOne({
      supplier_name,
      branch,
      ...(supplier_phone && { supplier_phone })
    });

    if (supplier) {
      // Cập nhật công nợ hiện có
      supplier.total_debt += Number(amount);
      supplier.debt_history.push({
        type: 'add',
        amount: Number(amount),
        note: note || '',
        related_id,
        user: req.user?.full_name || user || 'System'
      });

      if (supplier_phone) supplier.supplier_phone = supplier_phone;
      if (supplier_address) supplier.supplier_address = supplier_address;

      await supplier.save();
    } else {
      // Tạo mới nhà cung cấp
      supplier = new SupplierDebt({
        supplier_name,
        supplier_phone: supplier_phone || '',
        supplier_address: supplier_address || '',
        total_debt: Number(amount),
        total_paid: 0,
        branch,
        debt_history: [{
          type: 'add',
          amount: Number(amount),
          note: note || '',
          related_id,
          user: req.user?.full_name || user || 'System'
        }]
      });

      await supplier.save();
    }

    // === GHI NHẬN HOẠT ĐỘNG ===
    try {
      const activityData = {
        user_id: req.user?._id,
        username: req.user?.full_name || user || 'Hệ thống',
        role: req.user?.role || 'system',
        action: 'create',
        module: 'supplier_debt',
        payload_snapshot: {
          supplier_name: supplier_name,
          supplier_phone: supplier_phone || '',
          amount: Number(amount),
          note: note || '',
          branch: branch,
          related_id: related_id,
          action_type: 'add_debt'
        },
        ref_id: supplier._id.toString(),
        branch: branch
      };

      // Tạo mô tả chi tiết
      activityData.description = `${activityData.username} (${activityData.role}) cộng nợ nhà cung cấp - Nhà cung cấp: ${supplier_name}${supplier_phone ? ` (${supplier_phone})` : ''} - Số tiền: ${new Intl.NumberFormat('vi-VN').format(Number(amount))}đ - Chi nhánh: ${branch}${note ? ` - Ghi chú: ${note}` : ''}`;

      await ActivityLog.create(activityData);
    } catch (e) { /* ignore log error */ }

    res.json({
      message: '✅ Đã cập nhật công nợ nhà cung cấp',
      supplier
    });
  } catch (err) {
    res.status(500).json({ message: '❌ Lỗi cập nhật công nợ', error: err.message });
  }
});

// 3. Trả nợ cho nhà cung cấp
router.post('/pay-debt', authenticateToken, requireRole(['admin', 'thu_ngan']), async (req, res) => {
  try {
    const { supplier_name, supplier_phone, branch, amount, note, source } = req.body;

    if (!supplier_name || !amount || !branch) {
      return res.status(400).json({ message: 'Thiếu thông tin bắt buộc' });
    }

    // Kiểm tra quyền truy cập chi nhánh
    if (req.user.role !== 'admin' && branch !== req.user.branch_name) {
      return res.status(403).json({ message: 'Không có quyền trả nợ cho chi nhánh khác' });
    }

    const supplier = await SupplierDebt.findOne({
      supplier_name,
      branch,
      ...(supplier_phone && { supplier_phone })
    });

    if (!supplier) {
      return res.status(404).json({ message: 'Không tìm thấy nhà cung cấp' });
    }

    const payAmount = Number(amount);
    if (payAmount > supplier.total_debt) {
      return res.status(400).json({ message: 'Số tiền trả lớn hơn công nợ hiện tại' });
    }

    // Cập nhật công nợ
    supplier.total_debt -= payAmount;
    supplier.total_paid += payAmount;
    supplier.debt_history.push({
      type: 'pay',
      amount: payAmount,
      note: note || '',
      user: req.user?.full_name || 'System'
    });

    await supplier.save();

    // Tự động ghi sổ quỹ (chi tiền)
    if (source) {
      await Cashbook.create({
        type: 'chi',
        amount: payAmount,
        content: `Trả nợ nhà cung cấp: ${supplier_name}`,
        note: `Trả nợ cho ${supplier_name}: ${note || ''}`,
        branch,
        source: (['tien_mat', 'the', 'vi_dien_tu'].includes(source)) ? source : 'tien_mat',
        supplier: supplier_name,
        related_type: 'tra_no_ncc',
        user: req.user?.full_name || 'System',
        date: new Date(),
        is_auto: true
      });
    }

    // === GHI NHẬN HOẠT ĐỘNG ===
    try {
      const activityData = {
        user_id: req.user?._id,
        username: req.user?.full_name || 'Hệ thống',
        role: req.user?.role || 'system',
        action: 'update',
        module: 'supplier_debt',
        payload_snapshot: {
          supplier_name: supplier_name,
          supplier_phone: supplier_phone || '',
          paid_amount: payAmount,
          remaining_debt: supplier.total_debt,
          note: note || '',
          branch: branch,
          source: source,
          action_type: 'pay_debt'
        },
        ref_id: supplier._id.toString(),
        branch: branch
      };

      // Tạo mô tả chi tiết
      activityData.description = `${activityData.username} (${activityData.role}) trả nợ nhà cung cấp - Nhà cung cấp: ${supplier_name}${supplier_phone ? ` (${supplier_phone})` : ''} - Số tiền trả: ${new Intl.NumberFormat('vi-VN').format(payAmount)}đ - Nợ còn lại: ${new Intl.NumberFormat('vi-VN').format(supplier.total_debt)}đ - Chi nhánh: ${branch}${note ? ` - Ghi chú: ${note}` : ''}`;

      await ActivityLog.create(activityData);
    } catch (e) { /* ignore log error */ }

    res.json({
      message: '✅ Đã trả nợ nhà cung cấp thành công',
      supplier
    });
  } catch (err) {
    res.status(500).json({ message: '❌ Lỗi trả nợ', error: err.message });
  }
});

// 4. Lấy chi tiết công nợ một nhà cung cấp
router.get('/detail/:id', authenticateToken, async (req, res) => {
  try {
    const supplier = await SupplierDebt.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ message: 'Không tìm thấy nhà cung cấp' });
    }

    // Kiểm tra quyền truy cập chi nhánh
    if (req.user.role !== 'admin' && supplier.branch !== req.user.branch_name) {
      return res.status(403).json({ message: 'Không có quyền xem công nợ chi nhánh khác' });
    }

    res.json({ supplier });
  } catch (err) {
    res.status(500).json({ message: '❌ Lỗi lấy chi tiết', error: err.message });
  }
});

// 5. Xóa nhà cung cấp (reset công nợ về 0)
router.delete('/delete/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const supplier = await SupplierDebt.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ message: 'Không tìm thấy nhà cung cấp' });
    }

    supplier.total_debt = 0;
    supplier.total_paid = 0;
    supplier.debt_history = [];
    await supplier.save();

    // Ghi nhận hoạt động
    try {
      await ActivityLog.create({
        user_id: req.user?._id,
        username: req.user?.full_name || 'Hệ thống',
        role: req.user?.role,
        action: 'delete',
        module: 'supplier_debt',
        payload_snapshot: { supplier_name: supplier.supplier_name, branch: supplier.branch },
        ref_id: supplier._id.toString(),
        branch: supplier.branch,
        description: `Admin ${req.user.full_name} reset công nợ nhà cung cấp: ${supplier.supplier_name}`
      });
    } catch (e) { }

    res.json({ message: '✅ Đã reset công nợ nhà cung cấp' });
  } catch (err) {
    res.status(500).json({ message: '❌ Lỗi xóa công nợ', error: err.message });
  }
});

// 6. Cập nhật thông tin nhà cung cấp
router.put('/update/:id', authenticateToken, requireRole(['admin', 'thu_ngan']), async (req, res) => {
  try {
    const { supplier_name, supplier_phone, supplier_address } = req.body;

    const supplier = await SupplierDebt.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ message: 'Không tìm thấy nhà cung cấp' });
    }

    // Kiểm tra quyền truy cập chi nhánh
    if (req.user.role !== 'admin' && supplier.branch !== req.user.branch_name) {
      return res.status(403).json({ message: 'Không có quyền cập nhật NCC chi nhánh khác' });
    }

    supplier.supplier_name = supplier_name || supplier.supplier_name;
    supplier.supplier_phone = supplier_phone || supplier.supplier_phone;
    supplier.supplier_address = supplier_address || supplier.supplier_address;

    await supplier.save();

    res.json({
      message: '✅ Đã cập nhật thông tin nhà cung cấp',
      supplier
    });
  } catch (err) {
    res.status(500).json({ message: '❌ Lỗi cập nhật thông tin', error: err.message });
  }
});

export default router;
