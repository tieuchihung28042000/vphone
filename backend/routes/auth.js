const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const nodemailer = require('nodemailer');

const router = express.Router();

// ===== Đăng ký tài khoản user =====
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: '❌ Email và mật khẩu là bắt buộc' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: '❌ Email đã tồn tại' });
    }

    const hashed = await bcrypt.hash(password, 10);

    await User.create({
      email,
      password: hashed,
      role: 'user'
    });

    res.status(201).json({ message: '✅ Tạo tài khoản thành công' });
  } catch (err) {
    res.status(500).json({ message: '❌ Lỗi server', error: err.message });
  }
});

// ===== Đăng nhập user =====
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: '❌ Email và mật khẩu là bắt buộc' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: '❌ Email không tồn tại' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({ message: '❌ Mật khẩu sai' });
    }

    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET || 'vphone_secret_key',
      { expiresIn: '7d' }
    );

    res.status(200).json({ message: '✅ Đăng nhập thành công', token });
  } catch (err) {
    res.status(500).json({ message: '❌ Lỗi server', error: err.message });
  }
});

// ==== Quên mật khẩu (Gửi OTP, xác thực OTP để đổi mật khẩu) ====
// OTP lưu tạm ở RAM, production thì nên dùng Redis/DB
const otpStore = {};

// Tạo OTP 6 số
function generateOTP(length = 6) {
  return Math.floor(100000 + Math.random() * 900000).toString().slice(0, length);
}

// Gửi OTP qua email (cần cấu hình SMTP)
async function sendOTP(email, otp) {
  const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
      user: process.env.EMAIL_USER,   // tài khoản Gmail/app password
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: '"VPhone App" <no-reply@vphone.vn>',
    to: email,
    subject: 'Mã xác thực đổi mật khẩu',
    html: `<p>Mã xác thực OTP đổi mật khẩu là: <b>${otp}</b><br>Mã có hiệu lực trong 10 phút.</p>`,
  });
}

// B1: Gửi OTP về email (cùng với mật khẩu mới)
router.post('/send-reset-otp', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Thiếu email hoặc mật khẩu mới!' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'Email không tồn tại!' });

    const otp = generateOTP(6);
    otpStore[email] = {
      otp,
      password,  // Lưu plain password tạm thời
      expire: Date.now() + 10 * 60 * 1000, // 10 phút
    };

    await sendOTP(email, otp);
    res.json({ message: 'Đã gửi mã xác thực về email.' });
  } catch (err) {
    console.error('Lỗi gửi OTP:', err);
    res.status(500).json({ message: 'Không gửi được email!', error: err.message });
  }
});

// B2: Xác thực OTP và đổi mật khẩu
router.post('/verify-reset-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: 'Thiếu email hoặc OTP!' });

    const entry = otpStore[email];
    if (!entry) return res.status(400).json({ message: 'Bạn chưa gửi yêu cầu quên mật khẩu.' });
    if (entry.otp !== otp) return res.status(400).json({ message: 'Sai mã xác thực OTP!' });
    if (Date.now() > entry.expire) {
      delete otpStore[email];
      return res.status(400).json({ message: 'Mã xác thực đã hết hạn. Vui lòng gửi lại!' });
    }

    const hashed = await bcrypt.hash(entry.password, 10);
    await User.updateOne({ email }, { password: hashed });

    delete otpStore[email];
    res.json({ message: 'Đổi mật khẩu thành công!' });
  } catch (err) {
    console.error('Lỗi xác thực OTP:', err);
    res.status(500).json({ message: 'Lỗi xác thực OTP', error: err.message });
  }
});

module.exports = router;
