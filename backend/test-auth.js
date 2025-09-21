import mongoose from 'mongoose';
import User from './models/User.js';
import Branch from './models/Branch.js';
import jwt from 'jsonwebtoken';

async function testAuth() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://admin:123456@localhost:27017/vphone_production?authSource=admin');
    console.log('Connected to MongoDB');

    // Create test branch
    const testBranch = await Branch.create({
      name: `Test Branch ${Date.now()}`,
      address: 'Test Address',
      phone: '0123456789'
    });
    console.log('Created branch:', testBranch.name);

    // Create test user
    const adminUser = await User.create({
      email: `admin${Date.now()}@test.com`,
      password: '$2b$10$test.hash',
      role: 'admin',
      full_name: 'Admin User',
      phone: '0123456789',
      approved: true,
      branch_id: testBranch._id,
      branch_name: testBranch.name
    });
    console.log('Created user:', adminUser.email);

    // Test JWT creation
    const token = jwt.sign(
      { id: adminUser._id, email: adminUser.email },
      'vphone_secret_key',
      { expiresIn: '1h' }
    );
    console.log('Created token:', token.substring(0, 50) + '...');

    // Test JWT verification
    const decoded = jwt.verify(token, 'vphone_secret_key');
    console.log('Decoded token:', decoded);

    // Test user lookup
    const foundUser = await User.findById(decoded.id).populate('branch_id');
    console.log('Found user:', foundUser ? foundUser.email : 'Not found');

    console.log('Test completed successfully');

  } catch (error) {
    console.error('Test error:', error);
  } finally {
    await mongoose.connection.close();
  }
}

testAuth();
