import express from 'express';
import bcrypt from 'bcryptjs';
import Admin from '../models/Admin.js';

const router = express.Router();

router.post('/admin-register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email và mật khẩu là bắt buộc' });
    }

    // Kiểm tra email đã tồn tại chưa
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ message: 'Email đã tồn tại' });
    }

    // Hash mật khẩu
    const hashedPassword = await bcrypt.hash(password, 10);

    // Tạo admin mới, không có trạng thái xét duyệt gì hết
    const newAdmin = new Admin({
      email,
      password: hashedPassword,
      role: 'admin'  // hoặc role khác tùy bạn
    });

    await newAdmin.save();

    res.status(201).json({ message: 'Đăng ký admin thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
});

export default router;
