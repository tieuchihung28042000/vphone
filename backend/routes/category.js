// routes/category.js
import express from 'express';
const router = express.Router();
import Category from '../models/Category.js';

// Lấy tất cả category
router.get('/', async (req, res) => {
  const categories = await Category.find({});
  res.json(categories.map(c => ({ _id: c._id, name: c.name })));
});

// Thêm category
router.post('/', async (req, res) => {
  try {
    const category = new Category({ name: req.body.name });
    await category.save();
    res.json(category);
  } catch (err) {
    res.status(400).json({ message: 'Tên thư mục đã tồn tại hoặc lỗi.' });
  }
});

// Sửa category
router.put('/:id', async (req, res) => {
  await Category.findByIdAndUpdate(req.params.id, { name: req.body.name });
  res.json({ message: 'Đã cập nhật thư mục' });
});

// Xoá category
router.delete('/:id', async (req, res) => {
  await Category.findByIdAndDelete(req.params.id);
  res.json({ message: 'Đã xoá thư mục' });
});

export default router;
