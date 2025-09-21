import request from 'supertest';
import app from '../test-app.js';
import ActivityLog from '../models/ActivityLog.js';
import User from '../models/User.js';
import Branch from '../models/Branch.js';
import Cashbook from '../models/Cashbook.js';

describe('Activity Log API (STORY_02)', () => {
  let testBranch;
  let adminToken;
  let managerToken;

  beforeAll(async () => {
    // Create test branch
    testBranch = await Branch.create({
      name: 'Test Branch',
      address: 'Test Address',
      phone: '0123456789'
    });

    // Create admin user
    const adminUser = await User.create({
      email: 'admin@test.com',
      password: '$2b$10$test.hash',
      role: 'admin',
      full_name: 'Admin User',
      phone: '0123456789',
      approved: true,
      branch_id: testBranch._id,
      branch_name: 'Test Branch'
    });

    // Create manager user
    const managerUser = await User.create({
      email: 'manager@test.com',
      password: '$2b$10$test.hash',
      role: 'quan_ly',
      full_name: 'Manager User',
      phone: '0123456789',
      approved: true,
      branch_id: testBranch._id,
      branch_name: 'Test Branch'
    });

    // Get tokens
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: '123456' });
    adminToken = adminLogin.body.token;

    const managerLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'manager@test.com', password: '123456' });
    managerToken = managerLogin.body.token;
  });

  describe('Activity Log Creation', () => {
    it('should create activity log when cashbook transaction is created', async () => {
      const transactionData = {
        type: 'thu',
        amount: 1000000,
        content: 'Bán hàng iPhone',
        source: 'tien_mat',
        branch: 'Test Branch',
        date: new Date().toISOString(),
        user: 'Admin User'
      };

      const response = await request(app)
        .post('/api/cashbook')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(transactionData);

      expect(response.status).toBe(201);

      // Check if activity log was created
      const activityLogs = await ActivityLog.find({ module: 'cashbook' });
      expect(activityLogs.length).toBeGreaterThan(0);
      
      const latestLog = activityLogs[activityLogs.length - 1];
      expect(latestLog.action).toBe('create');
      expect(latestLog.module).toBe('cashbook');
      expect(latestLog.username).toBe('Admin User');
    });

    it('should create activity log when cashbook transaction is updated', async () => {
      // First create a transaction
      const transaction = await Cashbook.create({
        type: 'thu',
        amount: 1000000,
        content: 'Bán hàng iPhone',
        source: 'tien_mat',
        branch: 'Test Branch',
        date: new Date(),
        user: 'Admin User'
      });

      // Update the transaction
      const updateData = {
        amount: 1500000,
        content: 'Bán hàng iPhone 15 Pro'
      };

      const response = await request(app)
        .put(`/api/cashbook/${transaction._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);

      expect(response.status).toBe(200);

      // Check if activity log was created
      const activityLogs = await ActivityLog.find({ 
        module: 'cashbook', 
        action: 'update',
        ref_id: transaction._id.toString()
      });
      expect(activityLogs.length).toBeGreaterThan(0);
    });

    it('should create activity log when cashbook transaction is deleted', async () => {
      // First create a transaction
      const transaction = await Cashbook.create({
        type: 'thu',
        amount: 1000000,
        content: 'Bán hàng iPhone',
        source: 'tien_mat',
        branch: 'Test Branch',
        date: new Date(),
        user: 'Admin User'
      });

      // Delete the transaction
      const response = await request(app)
        .delete(`/api/cashbook/${transaction._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);

      // Check if activity log was created
      const activityLogs = await ActivityLog.find({ 
        module: 'cashbook', 
        action: 'delete',
        ref_id: transaction._id.toString()
      });
      expect(activityLogs.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/activity-logs', () => {
    beforeEach(async () => {
      // Create test activity logs
      await ActivityLog.create([
        {
          username: 'admin@test.com',
          role: 'admin',
          module: 'cashbook',
          action: 'create',
          ref_id: 'transaction-1',
          branch: 'Test Branch',
          details: 'Created cashbook transaction'
        },
        {
          username: 'manager@test.com',
          role: 'quan_ly',
          module: 'return_import',
          action: 'create',
          ref_id: 'return-1',
          branch: 'Test Branch',
          details: 'Created return import'
        },
        {
          username: 'admin@test.com',
          role: 'admin',
          module: 'return_export',
          action: 'delete',
          ref_id: 'return-2',
          branch: 'Test Branch',
          details: 'Deleted return export'
        }
      ]);
    });

    it('should get activity logs with pagination', async () => {
      const response = await request(app)
        .get('/api/activity-logs?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('items');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('limit');
      expect(Array.isArray(response.body.items)).toBe(true);
      expect(response.body.items.length).toBeGreaterThan(0);
    });

    it('should filter activity logs by module', async () => {
      const response = await request(app)
        .get('/api/activity-logs?module=cashbook')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      response.body.items.forEach(item => {
        expect(item.module).toBe('cashbook');
      });
    });

    it('should filter activity logs by action', async () => {
      const response = await request(app)
        .get('/api/activity-logs?action=create')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      response.body.items.forEach(item => {
        expect(item.action).toBe('create');
      });
    });

    it('should filter activity logs by user', async () => {
      const response = await request(app)
        .get('/api/activity-logs?user=admin@test.com')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      response.body.items.forEach(item => {
        expect(item.username).toBe('admin@test.com');
      });
    });

    it('should filter activity logs by branch', async () => {
      const response = await request(app)
        .get('/api/activity-logs?branch=Test Branch')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      response.body.items.forEach(item => {
        expect(item.branch).toBe('Test Branch');
      });
    });

    it('should filter activity logs by date range', async () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const response = await request(app)
        .get(`/api/activity-logs?from=${yesterday.toISOString()}&to=${today.toISOString()}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.items.length).toBeGreaterThan(0);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/activity-logs');

      expect(response.status).toBe(401);
    });

    it('should only allow admin and manager access', async () => {
      // Create a sales user
      const salesUser = await User.create({
        email: 'sales@test.com',
        password: '$2b$10$test.hash',
        role: 'nhan_vien_ban_hang',
        full_name: 'Sales User',
        phone: '0123456789',
        approved: true,
        branch_id: testBranch._id,
        branch_name: 'Test Branch'
      });

      const salesLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: 'sales@test.com', password: '123456' });
      const salesToken = salesLogin.body.token;

      const response = await request(app)
        .get('/api/activity-logs')
        .set('Authorization', `Bearer ${salesToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('Activity Log Data Structure', () => {
    it('should have correct data structure', async () => {
      const response = await request(app)
        .get('/api/activity-logs?limit=1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.items.length).toBeGreaterThan(0);

      const log = response.body.items[0];
      expect(log).toHaveProperty('_id');
      expect(log).toHaveProperty('username');
      expect(log).toHaveProperty('role');
      expect(log).toHaveProperty('module');
      expect(log).toHaveProperty('action');
      expect(log).toHaveProperty('ref_id');
      expect(log).toHaveProperty('branch');
      expect(log).toHaveProperty('createdAt');
    });
  });

  describe('Activity Log Statistics', () => {
    it('should return correct pagination info', async () => {
      const response = await request(app)
        .get('/api/activity-logs?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('page', 1);
      expect(response.body).toHaveProperty('limit', 2);
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('totalPages');
      expect(response.body.items.length).toBeLessThanOrEqual(2);
    });
  });
});
