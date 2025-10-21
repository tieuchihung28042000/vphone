import express from 'express';
const router = express.Router();
import Cashbook from '../models/Cashbook.js';
import XLSX from 'xlsx';
import ActivityLog from '../models/ActivityLog.js';
import { authenticateToken } from '../middleware/auth.js';

// Helper function: Tạo mã phiếu thu/chi
function generateReceiptCode(type, date = new Date()) {
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  const prefix = type === 'thu' ? 'PT' : 'PC'; // Phiếu Thu / Phiếu Chi
  return `${prefix}${dateStr}${randomStr}`;
}

// Helper function: Tính số dư sau giao dịch
async function calculateBalance(source, branch, amount, type) {
  try {
    // Lấy giao dịch gần nhất cùng nguồn và chi nhánh
    const lastTransaction = await Cashbook.findOne({ 
      source, 
      branch 
    }).sort({ createdAt: -1 });
    
    const lastBalance = lastTransaction ? (lastTransaction.balance_after || 0) : 0;
    const newBalance = type === 'thu' ? lastBalance + Number(amount) : lastBalance - Number(amount);
    
    return { balance_before: lastBalance, balance_after: newBalance };
  } catch (err) {
    console.error('Error calculating balance:', err);
    return { balance_before: 0, balance_after: Number(amount) * (type === 'thu' ? 1 : -1) };
  }
}

// Helper: Reindex balances for a given source+branch in chronological order
async function reindexBalances(source, branch) {
  const filter = { source };
  if (branch) filter.branch = branch;
  const items = await Cashbook.find(filter).sort({ date: 1, createdAt: 1 });
  let running = 0;
  for (const item of items) {
    const before = running;
    running = item.type === 'thu' ? (running + Number(item.amount)) : (running - Number(item.amount));
    if (item.balance_before !== before || item.balance_after !== running) {
      item.balance_before = before;
      item.balance_after = running;
      await item.save();
    }
  }
  return running;
}

// 1. Thêm mới giao dịch (POST)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { 
      type, content, amount, source, branch, category, 
      supplier, customer, note, user, related_id, related_type, date 
    } = req.body;

    // Validate bắt buộc
    if (!type || !content || !amount || !source || !branch) {
      return res.status(400).json({ 
        message: "Thiếu trường bắt buộc (type/content/amount/source/branch)" 
      });
    }

    // Validate content không phải placeholder
    if (content === "--Chọn loại thu--" || content === "--Chọn loại chi--" || content === "") {
      return res.status(400).json({ message: "Vui lòng chọn đúng loại thu/chi!" });
    }

    // Tạo mã phiếu
    const receipt_code = generateReceiptCode(type, date ? new Date(date) : new Date());

    // Tính số dư
    const balanceInfo = await calculateBalance(source, branch, Number(amount), type);
    // ✅ Bỏ logic kiểm tra số dư âm - cho phép tạo phiếu chi bất kể số dư

    const cashbook = new Cashbook({
      ...req.body,
      amount: Number(amount),
      receipt_code,
      date: date ? new Date(date) : new Date(),
      related_type: related_type || 'manual',
      is_auto: related_type && related_type !== 'manual',
      ...balanceInfo
    });

    await cashbook.save();
    try {
      const activityData = {
        user_id: req.user?._id,
        username: req.user?.username || req.user?.email || '',
        role: req.user?.role,
        action: 'create',
        module: 'cashbook',
        payload_snapshot: {
          receipt_code: cashbook.receipt_code,
          type: cashbook.type,
          content: cashbook.content,
          amount: cashbook.amount,
          customer: cashbook.customer,
          supplier: cashbook.supplier,
          balance_after: cashbook.balance_after,
          source: cashbook.source,
          related_type: cashbook.related_type
        },
        ref_id: cashbook.receipt_code || String(cashbook._id),
        branch: cashbook.branch
      };
      
      // Tạo mô tả chi tiết
      const typeLabel = cashbook.type === 'thu' ? 'phiếu thu' : 'phiếu chi';
      const roleLabel = req.user?.role === 'admin' ? 'Admin' : (req.user?.role === 'thu_ngan' ? 'Thu ngân' : 'User');
      activityData.description = `Nhân viên ${activityData.username} (${roleLabel}) tạo ${typeLabel} #${cashbook.receipt_code || 'N/A'} - Nội dung: ${cashbook.content || 'N/A'} - Số tiền: ${new Intl.NumberFormat('vi-VN').format(cashbook.amount || 0)}đ${cashbook.customer ? ` - Khách hàng: ${cashbook.customer}` : ''}${cashbook.supplier ? ` - Nhà cung cấp: ${cashbook.supplier}` : ''} - Số dư sau: ${new Intl.NumberFormat('vi-VN').format(cashbook.balance_after || 0)}đ`;
      
      await ActivityLog.create(activityData);
    } catch (e) { /* ignore log error */ }
    res.json({ message: '✅ Thêm giao dịch thành công', cashbook });
  } catch (err) {
    res.status(400).json({ message: '❌ Lỗi thêm giao dịch', error: err.message });
  }
});

// 2. Sửa giao dịch (PUT)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const transaction = await Cashbook.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ message: 'Không tìm thấy giao dịch' });
    }

    // Kiểm tra quyền chỉnh sửa: cho phép nếu chưa bị khóa (editable !== false),
    // hoặc nếu user có vai trò admin/thu_ngan
    const role = req.user?.role;
    const isLocked = transaction.editable === false;
    const canOverride = role === 'admin' || role === 'thu_ngan';
    if (isLocked && !canOverride) {
      return res.status(403).json({ message: 'Giao dịch đã bị khóa, chỉ Admin/Quản lý được chỉnh sửa' });
    }

    // Cập nhật số dư nếu thay đổi số tiền
    let updateData = { ...req.body };
    if (req.body.amount && Number(req.body.amount) !== transaction.amount) {
      const balanceInfo = await calculateBalance(
        req.body.source || transaction.source, 
        req.body.branch || transaction.branch, 
        Number(req.body.amount), 
        req.body.type || transaction.type
      );
      updateData = { ...updateData, ...balanceInfo };
    }

    const oldSource = transaction.source;
    const oldBranch = transaction.branch;

    const updated = await Cashbook.findByIdAndUpdate(req.params.id, updateData, { new: true });

    // Reindex balances cho cả nguồn/chi nhánh cũ và mới để đảm bảo số dư chính xác
    try {
      await reindexBalances(oldSource, oldBranch);
      await reindexBalances(updated.source, updated.branch);
    } catch (e) { /* ignore reindex error */ }
    try {
      const activityData = {
        user_id: req.user?._id,
        username: req.user?.username || req.user?.email || '',
        role: req.user?.role,
        action: 'update',
        module: 'cashbook',
        payload_snapshot: {
          receipt_code: updated.receipt_code,
          before: {
            content: transaction.content,
            amount: transaction.amount,
            type: transaction.type,
            customer: transaction.customer,
            supplier: transaction.supplier
          },
          after: {
            content: updated.content,
            amount: updated.amount,
            type: updated.type,
            customer: updated.customer,
            supplier: updated.supplier
          }
        },
        ref_id: updated.receipt_code || String(updated._id),
        branch: updated.branch
      };
      
      // Tạo mô tả chi tiết
      const roleLabel = req.user?.role === 'admin' ? 'Admin' : (req.user?.role === 'thu_ngan' ? 'Thu ngân' : 'User');
      const typeLabel = updated.type === 'thu' ? 'phiếu thu' : 'phiếu chi';
      activityData.description = `Nhân viên ${activityData.username} (${roleLabel}) cập nhật ${typeLabel} #${updated.receipt_code || 'N/A'} - Nội dung: ${updated.content || 'N/A'} - Số tiền từ ${new Intl.NumberFormat('vi-VN').format(transaction.amount || 0)}đ thành ${new Intl.NumberFormat('vi-VN').format(updated.amount || 0)}đ${updated.customer ? ` - Khách hàng: ${updated.customer}` : ''}${updated.supplier ? ` - Nhà cung cấp: ${updated.supplier}` : ''}`;
      
      await ActivityLog.create(activityData);
    } catch (e) { /* ignore log error */ }
    res.json({ message: '✅ Đã cập nhật giao dịch', cashbook: updated });
  } catch (err) {
    res.status(400).json({ message: '❌ Lỗi cập nhật giao dịch', error: err.message });
  }
});

// 3. Xoá giao dịch (DELETE)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const transaction = await Cashbook.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ message: 'Không tìm thấy giao dịch' });
    }

    // Kiểm tra quyền xóa: cho phép nếu chưa bị khóa (editable !== false),
    // hoặc nếu user có vai trò admin/thu_ngan
    const role = req.user?.role;
    const isLocked = transaction.editable === false;
    const canOverride = role === 'admin' || role === 'thu_ngan';
    if (isLocked && !canOverride) {
      return res.status(403).json({ message: 'Giao dịch đã bị khóa, chỉ Admin/Quản lý được xoá' });
    }

    const src = transaction.source;
    const br = transaction.branch;
    await Cashbook.findByIdAndDelete(req.params.id);
    try {
      const activityData = {
        user_id: req.user?._id,
        username: req.user?.username || req.user?.email || '',
        role: req.user?.role,
        action: 'delete',
        module: 'cashbook',
        payload_snapshot: {
          receipt_code: transaction.receipt_code,
          type: transaction.type,
          content: transaction.content,
          amount: transaction.amount,
          customer: transaction.customer,
          supplier: transaction.supplier,
          source: transaction.source
        },
        ref_id: transaction.receipt_code || String(transaction._id),
        branch: transaction.branch
      };
      
      // Tạo mô tả chi tiết
      const roleLabel = req.user?.role === 'admin' ? 'Admin' : (req.user?.role === 'thu_ngan' ? 'Thu ngân' : 'User');
      const typeLabel = transaction.type === 'thu' ? 'phiếu thu' : 'phiếu chi';
      activityData.description = `Nhân viên ${activityData.username} (${roleLabel}) xóa ${typeLabel} #${transaction.receipt_code || 'N/A'} - Nội dung: ${transaction.content || 'N/A'} - Số tiền: ${new Intl.NumberFormat('vi-VN').format(transaction.amount || 0)}đ${transaction.customer ? ` - Khách hàng: ${transaction.customer}` : ''}${transaction.supplier ? ` - Nhà cung cấp: ${transaction.supplier}` : ''}`;
      
      await ActivityLog.create(activityData);
    } catch (e) { /* ignore log error */ }
    // Reindex balances cho cùng nguồn và chi nhánh để số dư chính xác
    try {
      await reindexBalances(src, br);
    } catch (e) { /* ignore reindex error */ }
    res.json({ message: '✅ Đã xoá giao dịch và cập nhật số dư' });
  } catch (err) {
    res.status(400).json({ message: '❌ Lỗi xoá giao dịch', error: err.message });
  }
});

// 4. Lấy danh sách, lọc nâng cao (GET)
router.get('/', async (req, res) => {
  try {
    const { 
      type, from, to, branch, source, category, 
      search, customer, supplier, related_type, page = 1, limit = 100 
    } = req.query;

    let query = {};
    
    // Lọc theo loại thu/chi
    if (type && type !== 'all') query.type = type;
    
    // Lọc theo chi nhánh
    if (branch && branch !== 'all') query.branch = branch;
    
    // Lọc theo nguồn tiền
    if (source && source !== 'all') query.source = source;
    
    // Lọc theo phân loại
    if (category && category !== 'all') query.category = category;
    
    // Lọc theo loại liên kết
    if (related_type && related_type !== 'all') query.related_type = related_type;
    
    // Lọc theo khách hàng
    if (customer) query.customer = new RegExp(customer, 'i');
    
    // Lọc theo nhà cung cấp
    if (supplier) query.supplier = new RegExp(supplier, 'i');
    
    // Tìm kiếm trong nội dung và ghi chú
    if (search) {
      query.$or = [
        { content: new RegExp(search, 'i') },
        { note: new RegExp(search, 'i') },
        { customer: new RegExp(search, 'i') },
        { supplier: new RegExp(search, 'i') }
      ];
    }

    // Lọc theo thời gian
    if (from && to) {
      query.date = {
        $gte: new Date(from),
        $lt: new Date(new Date(to).setDate(new Date(to).getDate() + 1))
      };
    }

    const skip = (page - 1) * limit;
    const items = await Cashbook.find(query)
      .sort({ createdAt: -1, date: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Cashbook.countDocuments(query);

    // Tính tổng thu/chi trong kết quả lọc
    const stats = await Cashbook.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalThu: { $sum: { $cond: [{ $eq: ["$type", "thu"] }, "$amount", 0] } },
          totalChi: { $sum: { $cond: [{ $eq: ["$type", "chi"] }, "$amount", 0] } }
        }
      }
    ]);

    const summary = stats[0] || { totalThu: 0, totalChi: 0 };
    summary.balance = summary.totalThu - summary.totalChi;

    res.json({ 
      items, 
      total, 
      page: Number(page), 
      limit: Number(limit),
      summary 
    });
  } catch (err) {
    res.status(400).json({ message: '❌ Lỗi lấy danh sách giao dịch', error: err.message });
  }
});

// 5. Tự động ghi quỹ từ bán hàng
router.post('/auto-sale', async (req, res) => {
  try {
    const { customer, amount, source, branch, user, sale_id, note } = req.body;
    
    const receipt_code = generateReceiptCode('thu');
    const balanceInfo = await calculateBalance(source, branch, Number(amount), 'thu');

    const cashbook = new Cashbook({
      type: 'thu',
      content: 'Doanh thu bán hàng',
      amount: Number(amount),
      source,
      branch,
      customer,
      user,
      note: note || `Bán hàng cho ${customer}`,
      related_id: sale_id,
      related_type: 'ban_hang',
      is_auto: true,
      receipt_code,
      ...balanceInfo
    });

    await cashbook.save();
    res.json({ message: '✅ Đã ghi quỹ tự động', cashbook });
  } catch (err) {
    res.status(400).json({ message: '❌ Lỗi ghi quỹ bán hàng', error: err.message });
  }
});

// 6. Tự động ghi quỹ từ nhập hàng
router.post('/auto-purchase', async (req, res) => {
  try {
    const { supplier, amount, source, branch, user, purchase_id, note } = req.body;
    
    const receipt_code = generateReceiptCode('chi');
    const balanceInfo = await calculateBalance(source, branch, Number(amount), 'chi');
    if (balanceInfo.balance_after < 0) {
      return res.status(400).json({ message: '❌ Số dư nguồn tiền không đủ để chi (nhập hàng).' });
    }

    const cashbook = new Cashbook({
      type: 'chi',
      content: 'Chi phí nhập hàng',
      amount: Number(amount),
      source,
      branch,
      supplier,
      user,
      note: note || `Nhập hàng từ ${supplier}`,
      related_id: purchase_id,
      related_type: 'nhap_hang',
      is_auto: true,
      receipt_code,
      ...balanceInfo
    });

    await cashbook.save();
    res.json({ message: '✅ Đã ghi quỹ tự động', cashbook });
  } catch (err) {
    res.status(400).json({ message: '❌ Lỗi ghi quỹ nhập hàng', error: err.message });
  }
});

// 7. Tự động ghi quỹ từ trả nợ
router.post('/auto-debt', async (req, res) => {
  try {
    const { customer, amount, source, branch, user, debt_id, note, debt_type } = req.body;
    
    // debt_type: 'pay' (khách trả nợ = thu tiền) hoặc 'add' (cộng nợ = chi tiền)
    const type = debt_type === 'pay' ? 'thu' : 'chi';
    const content = debt_type === 'pay' ? 'Thu tiền trả nợ' : 'Chi tiền công nợ';
    
    const receipt_code = generateReceiptCode(type);
    const balanceInfo = await calculateBalance(source, branch, Number(amount), type);
    if (type === 'chi' && balanceInfo.balance_after < 0) {
      return res.status(400).json({ message: '❌ Số dư nguồn tiền không đủ để chi công nợ.' });
    }

    const cashbook = new Cashbook({
      type,
      content,
      amount: Number(amount),
      source,
      branch,
      customer,
      user,
      note: note || `${debt_type === 'pay' ? 'Thu nợ' : 'Cộng nợ'} từ ${customer}`,
      related_id: debt_id,
      related_type: 'tra_no',
      is_auto: true,
      receipt_code,
      ...balanceInfo
    });

    await cashbook.save();
    res.json({ message: '✅ Đã ghi quỹ tự động', cashbook });
  } catch (err) {
    res.status(400).json({ message: '❌ Lỗi ghi quỹ công nợ', error: err.message });
  }
});

// 8. Xuất Excel nâng cao (GET)
router.get('/export-excel', async (req, res) => {
  try {
    const { 
      type, from, to, branch, source, category, 
      search, customer, supplier, related_type 
    } = req.query;

    // Sử dụng lại logic lọc
    let query = {};
    if (type && type !== 'all') query.type = type;
    if (branch && branch !== 'all') query.branch = branch;
    if (source && source !== 'all') query.source = source;
    if (category && category !== 'all') query.category = category;
    if (related_type && related_type !== 'all') query.related_type = related_type;
    if (customer) query.customer = new RegExp(customer, 'i');
    if (supplier) query.supplier = new RegExp(supplier, 'i');
    if (search) {
      query.$or = [
        { content: new RegExp(search, 'i') },
        { note: new RegExp(search, 'i') },
        { customer: new RegExp(search, 'i') },
        { supplier: new RegExp(search, 'i') }
      ];
    }
    if (from && to) {
      query.date = {
        $gte: new Date(from),
        $lt: new Date(new Date(to).setDate(new Date(to).getDate() + 1))
      };
    }

    const items = await Cashbook.find(query).sort({ createdAt: -1, date: -1 });

    // Format data cho Excel
    const excelData = items.map(item => ({
      'Mã phiếu': item.receipt_code,
      'Ngày': item.date ? item.date.toISOString().slice(0, 10) : '',
      'Loại': item.type === 'thu' ? 'Thu' : 'Chi',
      'Nội dung': item.content,
      'Số tiền': item.amount,
      'Nguồn tiền': item.source === 'tien_mat' ? 'Tiền mặt' : 
                    item.source === 'the' ? 'Thẻ' : 
                    item.source === 'vi_dien_tu' ? 'Ví điện tử' : 'Công nợ',
      'Khách hàng': item.customer || '',
      'Nhà cung cấp': item.supplier || '',
      'Chi nhánh': item.branch,
      'Phân loại': item.category || '',
      'Ghi chú': item.note || '',
      'Người thực hiện': item.user || '',
      'Loại GD': item.is_auto ? 'Tự động' : 'Thủ công',
      'Số dư trước': item.balance_before,
      'Số dư sau': item.balance_after
    }));

    // Tạo workbook
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SoQuy');

    // Thêm sheet thống kê
    const stats = await Cashbook.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalThu: { $sum: { $cond: [{ $eq: ["$type", "thu"] }, "$amount", 0] } },
          totalChi: { $sum: { $cond: [{ $eq: ["$type", "chi"] }, "$amount", 0] } }
        }
      }
    ]);
    const summary = stats[0] || { totalThu: 0, totalChi: 0 };
    
    const statsData = [
      { 'Chỉ tiêu': 'Tổng thu', 'Giá trị': summary.totalThu },
      { 'Chỉ tiêu': 'Tổng chi', 'Giá trị': summary.totalChi },
      { 'Chỉ tiêu': 'Số dư', 'Giá trị': summary.totalThu - summary.totalChi }
    ];
    const statsWs = XLSX.utils.json_to_sheet(statsData);
    XLSX.utils.book_append_sheet(wb, statsWs, 'ThongKe');

    // Xuất file
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const fileName = `soquy_${new Date().toISOString().slice(0, 10)}.xlsx`;
    
    res.set('Content-Disposition', `attachment; filename="${fileName}"`);
    res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    res.status(400).json({ message: '❌ Lỗi xuất excel', error: err.message });
  }
});

// 9. Lấy thống kê số dư theo nguồn
router.get('/balance', async (req, res) => {
  try {
    const { branch } = req.query;
    let query = {};
    if (branch && branch !== 'all') query.branch = branch;

    const balance = await Cashbook.aggregate([
      { $match: query },
      {
        $group: {
          _id: { source: "$source", branch: "$branch" },
          balance: { 
            $sum: { 
              $cond: [
                { $eq: ["$type", "thu"] }, 
                "$amount", 
                { $multiply: ["$amount", -1] }
              ] 
            } 
          }
        }
      }
    ]);

    res.json(balance);
  } catch (err) {
    res.status(400).json({ message: '❌ Lỗi lấy số dư', error: err.message });
  }
});

// 10. Chỉnh sửa tổng quỹ theo nguồn tiền
router.post('/adjust-balance', async (req, res) => {
  try {
    const { branch, tien_mat, the, vi_dien_tu, note, user } = req.body;

    if (!branch) {
      return res.status(400).json({ message: 'Thiếu thông tin chi nhánh' });
    }

    // Validate số tiền nhập vào
    if (tien_mat !== undefined && (isNaN(tien_mat) || Number(tien_mat) < 0)) {
      return res.status(400).json({ message: 'Số tiền mặt không hợp lệ' });
    }
    if (the !== undefined && (isNaN(the) || Number(the) < 0)) {
      return res.status(400).json({ message: 'Số tiền thẻ không hợp lệ' });
    }
    if (vi_dien_tu !== undefined && (isNaN(vi_dien_tu) || Number(vi_dien_tu) < 0)) {
      return res.status(400).json({ message: 'Số tiền ví điện tử không hợp lệ' });
    }

    const adjustments = [];
    const date = new Date();

    // Lấy số dư hiện tại
    const currentBalance = await Cashbook.aggregate([
      { $match: { branch } },
      {
        $group: {
          _id: { source: "$source" },
          balance: { 
            $sum: { 
              $cond: [
                { $eq: ["$type", "thu"] }, 
                "$amount", 
                { $multiply: ["$amount", -1] }
              ] 
            } 
          }
        }
      }
    ]);

    const currentBalanceMap = {};
    currentBalance.forEach(item => {
      currentBalanceMap[item._id.source] = item.balance || 0;
    });

    // Điều chỉnh tiền mặt
    if (tien_mat !== undefined && tien_mat !== null && tien_mat !== '') {
      try {
        const newBalance = Number(tien_mat);
        const currentTienMat = currentBalanceMap['tien_mat'] || 0;
        const diff = newBalance - currentTienMat;
        
        if (diff !== 0) {
          const receipt_code = generateReceiptCode(diff > 0 ? 'thu' : 'chi', date);
          const adjustment = new Cashbook({
            type: diff > 0 ? 'thu' : 'chi',
            content: 'Điều chỉnh số dư tiền mặt',
            amount: Math.abs(diff),
            source: 'tien_mat',
            branch,
            note: note || 'Điều chỉnh tổng quỹ',
            user: user || 'System',
            related_type: 'adjustment',
            receipt_code,
            balance_before: currentTienMat,
            balance_after: newBalance,
            date: date
          });
          
          await adjustment.save();
          adjustments.push(adjustment);
        }
      } catch (err) {
        console.error('Error adjusting tien_mat:', err);
        throw new Error(`Lỗi điều chỉnh tiền mặt: ${err.message}`);
      }
    }

    // Điều chỉnh thẻ
    if (the !== undefined && the !== null && the !== '') {
      try {
        const newBalance = Number(the);
        const currentThe = currentBalanceMap['the'] || 0;
        const diff = newBalance - currentThe;
        
        if (diff !== 0) {
          const receipt_code = generateReceiptCode(diff > 0 ? 'thu' : 'chi', date);
          const adjustment = new Cashbook({
            type: diff > 0 ? 'thu' : 'chi',
            content: 'Điều chỉnh số dư thẻ',
            amount: Math.abs(diff),
            source: 'the',
            branch,
            note: note || 'Điều chỉnh tổng quỹ',
            user: user || 'System',
            related_type: 'adjustment',
            receipt_code,
            balance_before: currentThe,
            balance_after: newBalance,
            date: date
          });
          
          await adjustment.save();
          adjustments.push(adjustment);
        }
      } catch (err) {
        console.error('Error adjusting the:', err);
        throw new Error(`Lỗi điều chỉnh thẻ: ${err.message}`);
      }
    }

    // Điều chỉnh ví điện tử
    if (vi_dien_tu !== undefined && vi_dien_tu !== null && vi_dien_tu !== '') {
      try {
        const newBalance = Number(vi_dien_tu);
        const currentViDienTu = currentBalanceMap['vi_dien_tu'] || 0;
        const diff = newBalance - currentViDienTu;
        
        if (diff !== 0) {
          const receipt_code = generateReceiptCode(diff > 0 ? 'thu' : 'chi', date);
          const adjustment = new Cashbook({
            type: diff > 0 ? 'thu' : 'chi',
            content: 'Điều chỉnh số dư ví điện tử',
            amount: Math.abs(diff),
            source: 'vi_dien_tu',
            branch,
            note: note || 'Điều chỉnh tổng quỹ',
            user: user || 'System',
            related_type: 'adjustment',
            receipt_code,
            balance_before: currentViDienTu,
            balance_after: newBalance,
            date: date
          });
          
          await adjustment.save();
          adjustments.push(adjustment);
        }
      } catch (err) {
        console.error('Error adjusting vi_dien_tu:', err);
        throw new Error(`Lỗi điều chỉnh ví điện tử: ${err.message}`);
      }
    }

    res.json({ 
      message: '✅ Đã điều chỉnh tổng quỹ thành công!', 
      adjustments: adjustments.length,
      details: adjustments 
    });
  } catch (err) {
    res.status(400).json({ message: '❌ Lỗi điều chỉnh tổng quỹ', error: err.message });
  }
});

// API: Tổng hợp sổ quỹ tất cả chi nhánh
router.get('/total-summary', async (req, res) => {
  try {
    const { from, to, type, source, search } = req.query;
    
    let query = {};
    
    // Filter theo thời gian
    if (from && to) {
      query.date = {
        $gte: new Date(from),
        $lte: new Date(to + 'T23:59:59')
      };
    } else if (from) {
      query.date = { $gte: new Date(from) };
    } else if (to) {
      query.date = { $lte: new Date(to + 'T23:59:59') };
    }
    
    // Filter theo loại giao dịch
    if (type && type !== 'all') {
      query.type = type;
    }
    
    // Filter theo nguồn tiền
    if (source && source !== 'all') {
      query.source = source;
    }
    
    // Search trong content hoặc note
    if (search && search.trim()) {
      query.$or = [
        { content: { $regex: search, $options: 'i' } },
        { note: { $regex: search, $options: 'i' } },
        { customer: { $regex: search, $options: 'i' } },
        { supplier: { $regex: search, $options: 'i' } }
      ];
    }

    // Tổng hợp theo chi nhánh
    const branchSummary = await Cashbook.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$branch',
          totalThu: {
            $sum: { $cond: [{ $eq: ['$type', 'thu'] }, '$amount', 0] }
          },
          totalChi: {
            $sum: { $cond: [{ $eq: ['$type', 'chi'] }, '$amount', 0] }
          },
          transactions: { $sum: 1 }
        }
      },
      {
        $project: {
          branch: '$_id',
          totalThu: 1,
          totalChi: 1,
          balance: { $subtract: ['$totalThu', '$totalChi'] },
          transactions: 1,
          _id: 0
        }
      },
      { $sort: { branch: 1 } }
    ]);

    // Tổng hợp chung
    const totalStats = await Cashbook.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalThu: {
            $sum: { $cond: [{ $eq: ['$type', 'thu'] }, '$amount', 0] }
          },
          totalChi: {
            $sum: { $cond: [{ $eq: ['$type', 'chi'] }, '$amount', 0] }
          },
          totalTransactions: { $sum: 1 }
        }
      }
    ]);

    const stats = totalStats[0] || { totalThu: 0, totalChi: 0, totalTransactions: 0 };
    
    res.json({
      totalThu: stats.totalThu,
      totalChi: stats.totalChi,
      balance: stats.totalThu - stats.totalChi,
      totalTransactions: stats.totalTransactions,
      branchDetails: branchSummary
    });
  } catch (error) {
    res.status(500).json({ message: '❌ Lỗi server khi lấy tổng hợp sổ quỹ', error: error.message });
  }
});

// 11. Gợi ý nội dung đã dùng (distinct content + count)
router.get('/contents', authenticateToken, async (req, res) => {
  try {
    const { type, branch, limit = 50 } = req.query;
    const match = {};
    if (type && type !== 'all') match.type = type;
    if (branch && branch !== 'all') match.branch = branch;

    const results = await Cashbook.aggregate([
      { $match: match },
      { $group: { _id: '$content', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: Number(limit) }
    ]);

    res.json(results.map(r => ({ content: r._id, count: r.count })));
  } catch (err) {
    res.status(400).json({ message: '❌ Lỗi lấy danh sách nội dung', error: err.message });
  }
});

export default router;
