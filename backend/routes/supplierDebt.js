const express = require('express');
const router = express.Router();
const SupplierDebt = require('../models/SupplierDebt');

// 1. Lấy danh sách công nợ nhà cung cấp
router.get('/list', async (req, res) => {
  try {
    const { search = "", branch = "", show_all = "false" } = req.query;
    
    let query = {};
    
    // Lọc theo chi nhánh
    if (branch && branch !== 'all') {
      query.branch = branch;
    }
    
    // Tìm kiếm theo tên hoặc số điện thoại
    if (search.trim()) {
      query.$or = [
        { supplier_name: { $regex: search, $options: 'i' } },
        { supplier_phone: { $regex: search, $options: 'i' } }
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
router.post('/add-debt', async (req, res) => {
  try {
    const { supplier_name, supplier_phone, supplier_address, amount, note, branch, user, related_id } = req.body;
    
    if (!supplier_name || !amount || !branch) {
      return res.status(400).json({ message: 'Thiếu thông tin bắt buộc' });
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
        user: user || 'System'
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
          user: user || 'System'
        }]
      });
      
      await supplier.save();
    }
    
    res.json({ 
      message: '✅ Đã cập nhật công nợ nhà cung cấp',
      supplier 
    });
  } catch (err) {
    res.status(500).json({ message: '❌ Lỗi cập nhật công nợ', error: err.message });
  }
});

// 3. Trả nợ cho nhà cung cấp
router.post('/pay-debt', async (req, res) => {
  try {
    const { supplier_name, supplier_phone, branch, amount, note, user, source } = req.body;
    
    if (!supplier_name || !amount || !branch) {
      return res.status(400).json({ message: 'Thiếu thông tin bắt buộc' });
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
      user: user || 'System'
    });
    
    await supplier.save();
    
    // Tự động ghi sổ quỹ (chi tiền)
    if (source) {
      const Cashbook = require('../models/Cashbook');
      await Cashbook.create({
        type: 'chi',
        amount: payAmount,
        content: 'Trả nợ nhà cung cấp',
        note: `Trả nợ cho ${supplier_name}: ${note || ''}`,
        branch,
        source,
        supplier: supplier_name,
        related_type: 'tra_no_ncc',
        user: user || 'System'
      });
    }
    
    res.json({ 
      message: '✅ Đã trả nợ nhà cung cấp thành công',
      supplier 
    });
  } catch (err) {
    res.status(500).json({ message: '❌ Lỗi trả nợ', error: err.message });
  }
});

// 4. Lấy chi tiết công nợ một nhà cung cấp
router.get('/detail/:id', async (req, res) => {
  try {
    const supplier = await SupplierDebt.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ message: 'Không tìm thấy nhà cung cấp' });
    }
    
    res.json({ supplier });
  } catch (err) {
    res.status(500).json({ message: '❌ Lỗi lấy chi tiết', error: err.message });
  }
});

// 5. Xóa nhà cung cấp (reset công nợ về 0)
router.delete('/delete/:id', async (req, res) => {
  try {
    const supplier = await SupplierDebt.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ message: 'Không tìm thấy nhà cung cấp' });
    }
    
    supplier.total_debt = 0;
    supplier.total_paid = 0;
    supplier.debt_history = [];
    await supplier.save();
    
    res.json({ message: '✅ Đã reset công nợ nhà cung cấp' });
  } catch (err) {
    res.status(500).json({ message: '❌ Lỗi xóa công nợ', error: err.message });
  }
});

// 6. Cập nhật thông tin nhà cung cấp
router.put('/update/:id', async (req, res) => {
  try {
    const { supplier_name, supplier_phone, supplier_address } = req.body;
    
    const supplier = await SupplierDebt.findByIdAndUpdate(
      req.params.id,
      { supplier_name, supplier_phone, supplier_address },
      { new: true }
    );
    
    if (!supplier) {
      return res.status(404).json({ message: 'Không tìm thấy nhà cung cấp' });
    }
    
    res.json({ 
      message: '✅ Đã cập nhật thông tin nhà cung cấp',
      supplier 
    });
  } catch (err) {
    res.status(500).json({ message: '❌ Lỗi cập nhật thông tin', error: err.message });
  }
});

module.exports = router; 