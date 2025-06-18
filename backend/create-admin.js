require('dotenv').config(); // BẮT BUỘC DÒNG NÀY Ở ĐẦU

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('./models/User');

const ADMIN_EMAIL = "vphone24h1@gmail.com";
const ADMIN_PASSWORD = "0985630451vU";

async function createAdmin() {
  await mongoose.connect(process.env.MONGODB_URI);

  const existing = await User.findOne({ email: ADMIN_EMAIL });
  if (existing) {
    console.log("❗️Admin đã tồn tại!");
    process.exit(0);
  }

  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const admin = new User({
    email: ADMIN_EMAIL,
    password: hashedPassword,
    approved: true,
    role: "admin",
  });

  await admin.save();
  console.log("✅ Tạo tài khoản admin thành công!");
  process.exit(0);
}

createAdmin().catch(err => {
  console.error(err);
  process.exit(1);
});
