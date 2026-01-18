import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Branch from '../models/Branch.js';
import nodemailer from 'nodemailer';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// ===== Đăng ký tài khoản user =====
router.post('/register', authenticateToken, requireRole(['admin', 'thu_ngan']), async (req, res) => {
  try {
    console.log('🔧 [REGISTER] Received registration request:', req.body);
    const { email, password, username, role, branch_id, branch_name, full_name, phone } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: '❌ Email và mật khẩu là bắt buộc' });
    }

    // Kiểm tra vai trò hợp lệ
    const validRoles = ['user', 'admin', 'quan_ly_chi_nhanh', 'thu_ngan', 'nhan_vien_ban_hang'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ message: '❌ Vai trò không hợp lệ' });
    }

    // Kiểm tra branch_id cho các vai trò không phải admin (Admin tổng)
    if (role && role !== 'admin' && !branch_id) {
      return res.status(400).json({ message: '❌ Chi nhánh là bắt buộc cho vai trò này' });
    }

    // Kiểm tra branch_id có phải ObjectId hợp lệ không
    if (branch_id && !mongoose.Types.ObjectId.isValid(branch_id)) {
      return res.status(400).json({ message: '❌ ID chi nhánh không hợp lệ' });
    }

    // Validate và lấy thông tin branch nếu cần
    let branch = null;
    let finalBranchName = branch_name;

    if (role && role !== 'admin' && branch_id) {
      // Đặc biệt kiểm tra cho admin chi nhánh (quan_ly_chi_nhanh)
      if (role === 'quan_ly_chi_nhanh' && !branch_id) {
        return res.status(400).json({ message: '❌ Admin chi nhánh phải được gán vào một chi nhánh' });
      }

      // Kiểm tra branch_id có tồn tại trong database không
      branch = await Branch.findById(branch_id);
      if (!branch) {
        return res.status(400).json({ message: '❌ Chi nhánh không tồn tại trong hệ thống' });
      }

      // Nếu không có branch_name, tự động lấy từ Branch model
      if (!branch_name && branch) {
        finalBranchName = branch.name;
      }
    }

    // Kiểm tra email đã tồn tại
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ message: '❌ Email đã tồn tại' });
    }

    // Kiểm tra username đã tồn tại (nếu có)
    if (username) {
      const existingUsername = await User.findOne({ username });
      if (existingUsername) {
        return res.status(400).json({ message: '❌ Username đã tồn tại' });
      }
    }

    const hashed = await bcrypt.hash(password, 10);

    const userData = {
      email,
      username: (username && username.trim()) ? username.trim() : null, // Xử lý empty string và spaces
      password: hashed,
      role: role || 'user',
      full_name,
      phone,
      approved: true, // Tự động approve user được tạo bởi admin
    };

    // Chỉ thêm branch info nếu không phải admin tổng
    if (role !== 'admin') {
      userData.branch_id = branch_id;
      userData.branch_name = finalBranchName || branch_name;
      
      // Đảm bảo branch_name được set
      if (!userData.branch_name && branch) {
        userData.branch_name = branch.name;
      }
      
      // Validate cuối cùng: quan_ly_chi_nhanh phải có branch_name
      if (role === 'quan_ly_chi_nhanh' && !userData.branch_name) {
        return res.status(400).json({ message: '❌ Không thể xác định tên chi nhánh. Vui lòng cung cấp branch_name hoặc đảm bảo branch_id hợp lệ.' });
      }
    } else {
      // Admin tổng không có branch_id và branch_name
      userData.branch_id = null;
      userData.branch_name = null;
    }

    console.log('🔧 [REGISTER] Creating user with data:', userData);
    await User.create(userData);
    console.log('✅ [REGISTER] User created successfully');

    res.status(201).json({ message: '✅ Tạo tài khoản thành công' });
  } catch (err) {
    console.error('❌ [REGISTER] Error creating user:', err);
    res.status(500).json({ message: '❌ Lỗi server', error: err.message });
  }
});

// ===== Đăng nhập user =====
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body; // email có thể là email hoặc username

    if (!email || !password) {
      return res.status(400).json({ message: '❌ Email/Username và mật khẩu là bắt buộc' });
    }

    // Tìm user bằng email hoặc username
    const user = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { username: email } // Sử dụng field email để nhận cả username
      ]
    });

    if (!user) {
      return res.status(401).json({ message: '❌ Email/Username không tồn tại' });
    }

    if (!user.approved) {
      return res.status(401).json({ message: '❌ Tài khoản chưa được phê duyệt' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: '❌ Mật khẩu sai' });
    }

    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
        branch_id: user.branch_id,
        branch_name: user.branch_name,
        full_name: user.full_name,
      },
      process.env.JWT_SECRET || 'vphone_secret_key',
      { expiresIn: '7d' }
    );

    res.status(200).json({
      message: '✅ Đăng nhập thành công',
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        branch_id: user.branch_id,
        branch_name: user.branch_name,
        full_name: user.full_name,
        phone: user.phone
      }
    });
  } catch (err) {
    console.error('❌ [LOGIN] Error:', err && err.stack ? err.stack : err);
    res.status(500).json({ message: '❌ Lỗi server', error: err && err.message ? err.message : String(err) });
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

export default router;
