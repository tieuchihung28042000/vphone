// Test helpers for authentication and data setup
import request from 'supertest';
import app from '../test-app.js';
import User from '../models/User.js';
import Branch from '../models/Branch.js';
import bcrypt from 'bcryptjs';

let testData = null;

export const setupTestData = async () => {
  if (testData) {
    return testData;
  }

  const timestamp = Date.now();
  
  // Create test branch
  const testBranch = await Branch.create({
    name: `Test Branch ${timestamp}`,
    address: 'Test Address',
    phone: '0123456789'
  });

  // Create test users with unique emails
  const hashedPassword = await bcrypt.hash('123456', 10);
  
  const adminUser = await User.create({
    email: `admin${timestamp}@test.com`,
    password: hashedPassword,
    role: 'admin',
    full_name: 'Admin User',
    phone: '0123456789',
    approved: true,
    branch_id: testBranch._id,
    branch_name: `Test Branch ${timestamp}`
  });

  const managerUser = await User.create({
    email: `manager${timestamp}@test.com`,
    password: hashedPassword,
    role: 'quan_ly',
    full_name: 'Manager User',
    phone: '0123456789',
    approved: true,
    branch_id: testBranch._id,
    branch_name: `Test Branch ${timestamp}`
  });

  const salesUser = await User.create({
    email: `sales${timestamp}@test.com`,
    password: hashedPassword,
    role: 'nhan_vien_ban_hang',
    full_name: 'Sales User',
    phone: '0123456789',
    approved: true,
    branch_id: testBranch._id,
    branch_name: `Test Branch ${timestamp}`
  });

  const cashierUser = await User.create({
    email: `cashier${timestamp}@test.com`,
    password: hashedPassword,
    role: 'thu_ngan',
    full_name: 'Cashier User',
    phone: '0123456789',
    approved: true,
    branch_id: testBranch._id,
    branch_name: `Test Branch ${timestamp}`
  });

  // Get tokens for all users
  const adminLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: adminUser.email, password: '123456' });
  const adminToken = adminLogin.body.token;

  const managerLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: managerUser.email, password: '123456' });
  const managerToken = managerLogin.body.token;

  const salesLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: salesUser.email, password: '123456' });
  const salesToken = salesLogin.body.token;

  const cashierLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: cashierUser.email, password: '123456' });
  const cashierToken = cashierLogin.body.token;

  testData = {
    testBranch,
    adminUser,
    managerUser,
    salesUser,
    cashierUser,
    adminToken,
    managerToken,
    salesToken,
    cashierToken
  };

  return testData;
};

export const cleanupTestData = async () => {
  if (testData) {
    // Clean up users and branch
    await User.deleteMany({ _id: { $in: [
      testData.adminUser._id,
      testData.managerUser._id,
      testData.salesUser._id,
      testData.cashierUser._id
    ]}});
    await Branch.deleteOne({ _id: testData.testBranch._id });
    testData = null;
  }
};

export const getTestData = () => testData;
