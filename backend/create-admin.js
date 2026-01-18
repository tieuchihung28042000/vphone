import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env') });

// Set MONGODB_URI if not already set
if (!process.env.MONGODB_URI) {
  const mongoPort = process.env.MONGODB_PORT || '27017';
  process.env.MONGODB_URI = `mongodb://${process.env.MONGO_ROOT_USERNAME}:${process.env.MONGO_ROOT_PASSWORD}@localhost:${mongoPort}/${process.env.MONGO_DB_NAME}?authSource=admin`;
}

// Import User model
const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  username: { type: String, unique: true, sparse: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'quan_ly_chi_nhanh', 'nhan_vien_ban_hang', 'thu_ngan'], required: true },
  full_name: { type: String, required: true },
  phone: { type: String },
  approved: { type: Boolean, default: false },
  branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  branch_name: { type: String }
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);

async function createAdmin() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check if admin exists
    const existingAdmin = await User.findOne({ email: 'admin@vphone.vn' });
    if (existingAdmin) {
      console.log('✅ Admin user already exists:', existingAdmin.email);
      return;
    }

    // Create admin user
    console.log('🔧 Creating admin user...');
    const hashedPassword = await bcrypt.hash('123456', 10);
    
    const admin = new User({
      email: 'admin@vphone.vn',
      username: 'admin',
      password: hashedPassword,
      role: 'admin',
      full_name: 'Admin User',
      phone: '0123456789',
      approved: true
    });

    await admin.save();
    console.log('✅ Admin user created successfully!');
    console.log('📧 Email: admin@vphone.vn');
    console.log('🔑 Password: 123456');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

createAdmin();
