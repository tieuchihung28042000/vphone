import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';

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

export { createDefaultAdmin };

// Nếu file được chạy trực tiếp
if (import.meta.url === `file://${process.argv[1]}`) {
  import('dotenv').then(({ default: dotenv }) => {
    import('path').then(({ default: path }) => {
      // Load environment variables from root .env
      dotenv.config({ path: path.join(process.cwd(), '..', '.env') });
      
      // Set MONGODB_URI if not already set
      if (!process.env.MONGODB_URI) {
        const mongoPort = process.env.MONGODB_PORT || '27017';
        process.env.MONGODB_URI = `mongodb://${process.env.MONGO_ROOT_USERNAME}:${process.env.MONGO_ROOT_PASSWORD}@localhost:${mongoPort}/${process.env.MONGO_DB_NAME}?authSource=admin`;
      }
      
      console.log('🔧 MONGODB_URI:', process.env.MONGODB_URI);
      
      import('mongoose').then(({ default: mongoose }) => {
        mongoose.connect(process.env.MONGODB_URI)
          .then(() => {
            console.log('✅ Connected to MongoDB');
            return createDefaultAdmin();
          })
          .then(() => {
            console.log('✅ Script completed');
            process.exit(0);
          })
          .catch(err => {
            console.error('❌ Error:', err);
            process.exit(1);
          });
      });
    });
  });
} 