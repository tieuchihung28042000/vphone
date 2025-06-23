const express = require('express');
const router = express.Router();
const Cashbook = require('../models/Cashbook');
const XLSX = require('xlsx');

// 1. Thêm mới giao dịch (POST)
// 1. Thêm mới giao dịch (POST)
router.post('/', async (req, res) => {
  try {
    const { date, type, content, amount } = req.body;
    // Validate tối thiểu
    if (!date || !type || !content || !amount) {
      return res.status(400).json({ message: "Thiếu trường bắt buộc (date/type/content/amount)" });
    }
    // Validate loại thu/chi phải khác placeholder
    if (
      content === "--Chọn loại thu--" ||
      content === "--Chọn loại chi--" ||
      content === ""
    ) {
      return res.status(400).json({ message: "Vui lòng chọn đúng loại thu/chi!" });
    }
    const cashbook = new Cashbook(req.body);
    await cashbook.save();
    res.json({ message: '✅ Thêm giao dịch thành công', cashbook });
  } catch (err) {
    res.status(400).json({ message: '❌ Lỗi thêm giao dịch', error: err });
  }
});


// 2. Sửa giao dịch (PUT)
router.put('/:id', async (req, res) => {
  try {
    const updated = await Cashbook.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ message: '✅ Đã cập nhật giao dịch', cashbook: updated });
  } catch (err) {
    res.status(400).json({ message: '❌ Lỗi cập nhật giao dịch', error: err });
  }
});

// 3. Xoá giao dịch (DELETE)
router.delete('/:id', async (req, res) => {
  try {
    await Cashbook.findByIdAndDelete(req.params.id);
    res.json({ message: '✅ Đã xoá giao dịch' });
  } catch (err) {
    res.status(400).json({ message: '❌ Lỗi xoá giao dịch', error: err });
  }
});

// 4. Lấy danh sách, lọc (GET)
router.get('/', async (req, res) => {
  try {
    const { type, from, to, branch, source, category } = req.query;
    let query = {};
    if (type) query.type = type;
    if (branch && branch !== 'all') query.branch = branch;
    if (source && source !== 'all') query.source = source;
    if (category && category !== 'all') query.category = category;
    if (from && to) {
      query.createdAt = {
        $gte: new Date(from),
        $lt: new Date(new Date(to).setDate(new Date(to).getDate() + 1)), // đến hết ngày to
      };
    }
    const items = await Cashbook.find(query).sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    res.status(400).json({ message: '❌ Lỗi lấy danh sách giao dịch', error: err });
  }
});

// 5. Xuất Excel (GET)
router.get('/export-excel', async (req, res) => {
  try {
    // Sử dụng lại logic lọc như bên trên
    const { type, from, to, branch, source, category } = req.query;
    let query = {};
    if (type) query.type = type;
    if (branch && branch !== 'all') query.branch = branch;
    if (source && source !== 'all') query.source = source;
    if (category && category !== 'all') query.category = category;
    if (from && to) {
      query.createdAt = {
        $gte: new Date(from),
        $lt: new Date(new Date(to).setDate(new Date(to).getDate() + 1)),
      };
    }
    const items = await Cashbook.find(query);
    // Chuyển data thành worksheet
    const ws = XLSX.utils.json_to_sheet(items.map(i => ({
      Loai: i.type,
      SoTien: i.amount,
      NoiDung: i.content,
      NguonTien: i.source,
      NhaCungCap: i.supplier,
      KhachHang: i.customer,
      Ngay: i.createdAt,
      ChiNhanh: i.branch,
      GhiChu: i.note,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SoQuy');
    // Ghi file vào buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.set('Content-Disposition', 'attachment; filename="soquy.xlsx"');
    res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    res.status(400).json({ message: '❌ Lỗi xuất excel', error: err });
  }
});

// Đúng chuẩn Node.js CommonJS:
module.exports = router;
