// routes/category.js
import express from 'express';
const router = express.Router();
import Category from '../models/Category.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

// Lấy tất cả category
router.get('/', authenticateToken, async (req, res) => {
  try {
    const categories = await Category.find({});
    res.json(categories.map(c => ({ _id: c._id, name: c.name })));
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server khi lấy danh mục.' });
  }
});

// Thêm category
router.post('/', authenticateToken, requireRole(['admin', 'thu_ngan']), async (req, res) => {
  try {
    const category = new Category({ name: req.body.name });
    await category.save();
    res.json(category);
  } catch (err) {
    res.status(400).json({ message: 'Tên thư mục đã tồn tại hoặc lỗi.' });
  }
});

// Sửa category
router.put('/:id', authenticateToken, requireRole(['admin', 'thu_ngan']), async (req, res) => {
  try {
    await Category.findByIdAndUpdate(req.params.id, { name: req.body.name });
    res.json({ message: 'Đã cập nhật thư mục' });
  } catch (err) {
    res.status(400).json({ message: 'Lỗi khi cập nhật thư mục.' });
  }
});

// Xoá category
router.delete('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    await Category.findByIdAndDelete(req.params.id);
    res.json({ message: 'Đã xoá thư mục' });
  } catch (err) {
    res.status(400).json({ message: 'Lỗi khi xoá thư mục.' });
  }
});

export default router;

