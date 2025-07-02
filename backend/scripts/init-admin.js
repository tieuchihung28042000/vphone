const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../models/User');

const DEFAULT_ADMIN = {
  email: 'admin@vphone.vn',
  username: 'admin',
  password: '123456',
  role: 'admin',
  approved: true
};

async function createDefaultAdmin() {
  try {
    console.log('🔍 Checking for admin user...');
    
    // Kiểm tra xem đã có admin chưa
    const existingAdmin = await User.findOne({ 
      $or: [
        { email: DEFAULT_ADMIN.email },
        { username: DEFAULT_ADMIN.username },
        { role: 'admin' }
      ]
    });

    if (existingAdmin) {
      console.log('✅ Admin user already exists:', existingAdmin.email);
      return;
    }

    // Tạo admin mới
    console.log('🔧 Creating default admin user...');
    const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN.password, 10);
    
    const admin = new User({
      email: DEFAULT_ADMIN.email,
      username: DEFAULT_ADMIN.username,
      password: hashedPassword,
      role: DEFAULT_ADMIN.role,
      approved: DEFAULT_ADMIN.approved
    });

    await admin.save();
    console.log('✅ Default admin user created successfully!');
    console.log('📧 Email:', DEFAULT_ADMIN.email);
    console.log('👤 Username:', DEFAULT_ADMIN.username);
    console.log('🔑 Password:', DEFAULT_ADMIN.password);
    console.log('⚠️  Please change the default password after first login!');

  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
  }
}

module.exports = { createDefaultAdmin }; 