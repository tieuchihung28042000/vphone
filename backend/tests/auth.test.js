import request from 'supertest';
import app from '../test-app.js';
import User from '../models/User.js';
import Branch from '../models/Branch.js';
import bcrypt from 'bcryptjs';
import { setupSharedTestData, getSharedTestData } from './shared-setup.js';

describe('Authentication and Authorization', () => {
  let testBranch;
  let adminUser;
  let managerUser;
  let salesUser;
  let adminToken;
  let managerToken;
  let salesToken;

  beforeAll(async () => {
    // Set environment variable to prevent database clearing
    process.env.CLEAR_DB = 'false';
    
    const timestamp = Date.now();
    
    // Create test branch
    testBranch = await Branch.create({
      name: `Test Branch ${timestamp}`,
      address: 'Test Address',
      phone: '0123456789'
    });

    // Create test users with hashed passwords
    const hashedPassword = await bcrypt.hash('123456', 10);
    
    adminUser = await User.create({
      email: `admin${timestamp}@test.com`,
      password: hashedPassword,
      role: 'admin',
      full_name: 'Admin User',
      phone: '0123456789',
      approved: true,
      branch_id: testBranch._id,
      branch_name: `Test Branch ${timestamp}`
    });

    managerUser = await User.create({
      email: `manager${timestamp}@test.com`,
      password: hashedPassword,
      role: 'quan_ly',
      full_name: 'Manager User',
      phone: '0123456789',
      approved: true,
      branch_id: testBranch._id,
      branch_name: `Test Branch ${timestamp}`
    });

    salesUser = await User.create({
      email: `sales${timestamp}@test.com`,
      password: hashedPassword,
      role: 'nhan_vien_ban_hang',
      full_name: 'Sales User',
      phone: '0123456789',
      approved: true,
      branch_id: testBranch._id,
      branch_name: `Test Branch ${timestamp}`
    });

    // Get tokens
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: adminUser.email, password: '123456' });
    console.log('Admin login response:', adminLogin.status, adminLogin.body);
    adminToken = adminLogin.body.token;

    const managerLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: managerUser.email, password: '123456' });
    console.log('Manager login response:', managerLogin.status, managerLogin.body);
    managerToken = managerLogin.body.token;

    const salesLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: salesUser.email, password: '123456' });
    console.log('Sales login response:', salesLogin.status, salesLogin.body);
    salesToken = salesLogin.body.token;
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: adminUser.email,
          password: '123456'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(adminUser.email);
    });

    it('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: adminUser.email,
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message');
    });

    it('should reject unapproved users', async () => {
      const unapprovedUser = await User.create({
        email: 'unapproved@test.com',
        password: await bcrypt.hash('123456', 10),
        role: 'nhan_vien_ban_hang',
        full_name: 'Unapproved User',
        phone: '0123456789',
        approved: false,
        branch_id: testBranch._id,
        branch_name: testBranch.name
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'unapproved@test.com',
          password: '123456'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/auth/register', () => {
    it('should register new user with valid data', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'newuser@test.com',
          password: '123456',
          full_name: 'New User',
          phone: '0123456789',
          role: 'nhan_vien_ban_hang',
          branch_id: testBranch._id.toString(),
          branch_name: 'Test Branch'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message');
    });

    it('should reject registration without admin token', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'unauthorized@test.com',
          password: '123456',
          full_name: 'Unauthorized User',
          phone: '0123456789',
          role: 'nhan_vien_ban_hang',
          branch_id: testBranch._id.toString(),
          branch_name: 'Test Branch'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('Role-based Authorization', () => {
    it('should have valid tokens', () => {
      expect(adminToken).toBeDefined();
      expect(managerToken).toBeDefined();
      expect(salesToken).toBeDefined();
      expect(typeof adminToken).toBe('string');
      expect(typeof managerToken).toBe('string');
      expect(typeof salesToken).toBe('string');
    });

    it('should allow admin to access all routes', async () => {
      const response = await request(app)
        .get('/api/users/all-users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
    });

    it('should allow manager to access management routes', async () => {
      const response = await request(app)
        .get('/api/users/all-users')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(response.status).toBe(200);
    });

    it('should deny sales user access to management routes', async () => {
      const response = await request(app)
        .get('/api/users/all-users')
        .set('Authorization', `Bearer ${salesToken}`);

      expect(response.status).toBe(403);
    });

    it('should require authentication for protected routes', async () => {
      const response = await request(app)
        .get('/api/users/all-users');

      expect(response.status).toBe(401);
    });
  });

  describe('Branch-based Filtering', () => {
    it('should filter data by user branch', async () => {
      const response = await request(app)
        .get('/api/branches')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });
});
