// routes/branch.js
import express from 'express';
const router = express.Router();
import Branch from '../models/Branch.js';

// Lấy tất cả branch
router.get('/', async (req, res) => {
  const branches = await Branch.find({});
  res.json(branches.map(b => ({ _id: b._id, name: b.name })));
});

// Thêm branch
router.post('/', async (req, res) => {
  try {
    const branch = new Branch({ name: req.body.name });
    await branch.save();
    res.json(branch);
  } catch (err) {
    res.status(400).json({ message: 'Tên chi nhánh đã tồn tại hoặc lỗi.' });
  }
});

// Sửa branch
router.put('/:id', async (req, res) => {
  await Branch.findByIdAndUpdate(req.params.id, { name: req.body.name });
  res.json({ message: 'Đã cập nhật chi nhánh' });
});

// Xoá branch
router.delete('/:id', async (req, res) => {
  await Branch.findByIdAndDelete(req.params.id);
  res.json({ message: 'Đã xoá chi nhánh' });
});

export default router;
