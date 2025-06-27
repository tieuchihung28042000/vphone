require('dotenv').config(); // BẮT BUỘC DÒNG NÀY Ở ĐẦU

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Admin = require('./models/Admin');
const User = require('./models/User');

const ADMIN_EMAIL = "admin@vphone.com";
const NEW_PASSWORD = "123456";

async function transferAdminToUser() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Kết nối MongoDB thành công');

    // 1. Tìm admin trong collection admins
    const admin = await Admin.findOne({ email: ADMIN_EMAIL });
    if (!admin) {
      console.log("❌ Không tìm thấy admin trong collection admins:", ADMIN_EMAIL);
      process.exit(1);
    }

    console.log('📧 Tìm thấy admin trong collection admins:', admin.email);

    // 2. Hash mật khẩu mới
    const hashedPassword = await bcrypt.hash(NEW_PASSWORD, 10);

    // 3. Kiểm tra xem đã có user này chưa
    const existingUser = await User.findOne({ email: ADMIN_EMAIL });
    
    if (existingUser) {
      // Cập nhật user hiện có
      await User.updateOne(
        { email: ADMIN_EMAIL },
        { 
          password: hashedPassword,
          role: "admin",
          approved: true
        }
      );
      console.log("✅ Đã cập nhật user hiện có thành admin!");
    } else {
      // Tạo user mới từ dữ liệu admin
      const newUser = new User({
        email: admin.email,
        password: hashedPassword,
        role: "admin",
        approved: true
      });
      
      await newUser.save();
      console.log("✅ Đã tạo user mới với role admin!");
    }

    // 4. Xóa admin khỏi collection admins
    await Admin.deleteOne({ email: ADMIN_EMAIL });
    console.log("🗑️ Đã xóa admin khỏi collection admins");

    console.log("📧 Email:", ADMIN_EMAIL);
    console.log("🔐 Mật khẩu:", NEW_PASSWORD);
    console.log("👤 Role: admin");
    console.log("✅ Approved: true");
    console.log("🔄 Đã chuyển từ collection admins sang users");
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    process.exit(1);
  }
}

transferAdminToUser(); 