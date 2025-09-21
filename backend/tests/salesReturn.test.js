import request from 'supertest';
import app from '../test-app.js';
import ReturnExport from '../models/ReturnExport.js';
import Cashbook from '../models/Cashbook.js';
import User from '../models/User.js';
import Branch from '../models/Branch.js';
import ExportHistory from '../models/ExportHistory.js';
import bcrypt from 'bcryptjs';

describe('Sales Return API (STORY_06)', () => {
  let testBranch;
  let adminToken;
  let testExport;

  beforeAll(async () => {
    const timestamp = Date.now();
    // Create test branch
    testBranch = await Branch.create({
      name: `Test Branch ${timestamp}`,
      address: 'Test Address',
      phone: '0123456789'
    });

    // Create admin user
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

    // Create test export
    testExport = await ExportHistory.create({
      imei: '123456789012345',
      product_name: 'iPhone 15 Pro',
      sku: 'IPH15PRO',
      quantity: 1,
      price_sell: 25000000,
      da_thanh_toan: 20000000,
      sold_date: new Date(),
      customer_name: 'Test Customer',
      customer_phone: '0123456789',
      branch: 'Test Branch',
      sales_channel: 'Store',
      salesperson: 'Admin User'
    });

    // Get token
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: `admin${timestamp}@test.com`, password: '123456' });
    adminToken = adminLogin.body.token;
  });

  describe('POST /api/return-export', () => {
    it('should create sales return with multi-payment', async () => {
      const returnData = {
        original_export_id: testExport._id,
        return_amount: 15000000,
        return_method: 'cash',
        return_reason: 'Customer return - defective product',
        branch: 'Test Branch',
        payments: [
          { source: 'tien_mat', amount: 8000000 },
          { source: 'the', amount: 7000000 }
        ]
      };

      const response = await request(app)
        .post('/api/return-export')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(returnData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('returnExport');
      expect(response.body.returnExport.return_amount).toBe(15000000);
      expect(response.body.returnExport.return_reason).toBe('Customer return - defective product');

      // Check if cashbook entries were created
      const cashbookEntries = await Cashbook.find({ 
        related_type: 'tra_hang_ban',
        related_id: response.body.returnExport._id
      });
      expect(cashbookEntries.length).toBe(2);

      // Check individual payment entries
      const tienMatEntry = cashbookEntries.find(entry => entry.source === 'tien_mat');
      const theEntry = cashbookEntries.find(entry => entry.source === 'the');

      expect(tienMatEntry).toBeDefined();
      expect(tienMatEntry.amount).toBe(8000000);
      expect(tienMatEntry.type).toBe('chi');

      expect(theEntry).toBeDefined();
      expect(theEntry.amount).toBe(7000000);
      expect(theEntry.type).toBe('chi');
    });

    it('should create sales return with single payment', async () => {
      const returnData = {
        original_export_id: testExport._id,
        return_amount: 10000000,
        return_reason: 'Customer return - not satisfied',
        branch: 'Test Branch',
        payments: [
          { source: 'tien_mat', amount: 10000000 }
        ]
      };

      const response = await request(app)
        .post('/api/return-export')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(returnData);

      expect(response.status).toBe(201);

      // Check if single cashbook entry was created
      const cashbookEntries = await Cashbook.find({ 
        related_type: 'tra_hang_ban',
        related_id: response.body.returnExport._id
      });
      expect(cashbookEntries.length).toBe(1);
      expect(cashbookEntries[0].amount).toBe(10000000);
      expect(cashbookEntries[0].source).toBe('tien_mat');
    });

    it('should validate required fields', async () => {
      const invalidData = {
        // missing export_id, return_amount, branch
        return_reason: 'Test return'
      };

      const response = await request(app)
        .post('/api/return-export')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
    });

    it('should validate payment amounts match return amount', async () => {
      const returnData = {
        original_export_id: testExport._id,
        return_amount: 20000000,
        return_reason: 'Customer return',
        branch: 'Test Branch',
        payments: [
          { source: 'tien_mat', amount: 10000000 },
          { source: 'the', amount: 5000000 }
          // Total: 15M, but return_amount = 20M
        ]
      };

      const response = await request(app)
        .post('/api/return-export')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(returnData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Tổng thanh toán không khớp');
    });

    it('should validate return amount is positive', async () => {
      const returnData = {
        original_export_id: testExport._id,
        return_amount: -10000000,
        return_reason: 'Customer return',
        branch: 'Test Branch',
        payments: [
          { source: 'tien_mat', amount: 10000000 }
        ]
      };

      const response = await request(app)
        .post('/api/return-export')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(returnData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
    });

    it('should require authentication', async () => {
      const returnData = {
        original_export_id: testExport._id,
        return_amount: 10000000,
        return_reason: 'Customer return',
        branch: 'Test Branch',
        payments: [
          { source: 'tien_mat', amount: 10000000 }
        ]
      };

      const response = await request(app)
        .post('/api/return-export')
        .send(returnData);

      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent export', async () => {
      const fakeExportId = '507f1f77bcf86cd799439011';
      const returnData = {
        original_export_id: fakeExportId,
        return_amount: 10000000,
        return_reason: 'Customer return',
        branch: 'Test Branch',
        payments: [
          { source: 'tien_mat', amount: 10000000 }
        ]
      };

      const response = await request(app)
        .post('/api/return-export')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(returnData);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('GET /api/return-export', () => {
    beforeEach(async () => {
      // Create test return exports
      await ReturnExport.create([
        {
          original_export_id: testExport._id,
          return_amount: 15000000,
          return_reason: 'Customer return - defective',
          branch: 'Test Branch',
          return_date: new Date(),
          user: 'Admin User'
        },
        {
          original_export_id: testExport._id,
          return_amount: 10000000,
          return_reason: 'Customer return - not satisfied',
          branch: 'Test Branch',
          return_date: new Date(),
          user: 'Admin User'
        }
      ]);
    });

    it('should get return exports with pagination', async () => {
      const response = await request(app)
        .get('/api/return-export?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('items');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('limit');
      expect(Array.isArray(response.body.items)).toBe(true);
      expect(response.body.items.length).toBeGreaterThan(0);
    });

    it('should filter return exports by branch', async () => {
      const response = await request(app)
        .get('/api/return-export?branch=Test Branch')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      response.body.items.forEach(item => {
        expect(item.branch).toBe('Test Branch');
      });
    });

    it('should filter return exports by date range', async () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const response = await request(app)
        .get(`/api/return-export?from=${yesterday.toISOString()}&to=${today.toISOString()}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.items.length).toBeGreaterThan(0);
    });

    it('should search return exports by reason', async () => {
      const response = await request(app)
        .get('/api/return-export?search=defective')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      response.body.items.forEach(item => {
        expect(item.return_reason).toContain('defective');
      });
    });
  });

  describe('DELETE /api/return-export/:id', () => {
    let returnExportId;

    beforeEach(async () => {
      const returnExport = await ReturnExport.create({
        original_export_id: testExport._id,
        return_amount: 10000000,
        return_reason: 'Test return',
        branch: 'Test Branch',
        return_date: new Date(),
        user: 'Admin User'
      });
      returnExportId = returnExport._id;
    });

    it('should delete return export', async () => {
      const response = await request(app)
        .delete(`/api/return-export/${returnExportId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');

      // Verify return export is deleted
      const deletedReturn = await ReturnExport.findById(returnExportId);
      expect(deletedReturn).toBeNull();
    });

    it('should return 404 for non-existent return export', async () => {
      const fakeId = '507f1f77bcf86cd799439011';

      const response = await request(app)
        .delete(`/api/return-export/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .delete(`/api/return-export/${returnExportId}`);

      expect(response.status).toBe(401);
    });
  });

  describe('Return Export Data Structure', () => {
    it('should have correct data structure', async () => {
      const returnData = {
        original_export_id: testExport._id,
        return_amount: 10000000,
        return_reason: 'Test return',
        branch: 'Test Branch',
        payments: [
          { source: 'tien_mat', amount: 10000000 }
        ]
      };

      const response = await request(app)
        .post('/api/return-export')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(returnData);

      expect(response.status).toBe(201);
      
      const returnExport = response.body.return;
      expect(returnExport).toHaveProperty('_id');
      expect(returnExport).toHaveProperty('export_id');
      expect(returnExport).toHaveProperty('return_amount');
      expect(returnExport).toHaveProperty('return_reason');
      expect(returnExport).toHaveProperty('branch');
      expect(returnExport).toHaveProperty('return_date');
      expect(returnExport).toHaveProperty('user');
      expect(returnExport).toHaveProperty('createdAt');
    });
  });

  describe('Activity Log Integration', () => {
    it('should create activity log when return export is created', async () => {
      const returnData = {
        original_export_id: testExport._id,
        return_amount: 10000000,
        return_reason: 'Test return',
        branch: 'Test Branch',
        payments: [
          { source: 'tien_mat', amount: 10000000 }
        ]
      };

      const response = await request(app)
        .post('/api/return-export')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(returnData);

      expect(response.status).toBe(201);

      // Check if activity log was created
      const ActivityLog = (await import('../models/ActivityLog.js')).default;
      const activityLogs = await ActivityLog.find({ 
        module: 'return_export',
        action: 'create',
        ref_id: response.body.return._id
      });
      expect(activityLogs.length).toBeGreaterThan(0);
    });

    it('should create activity log when return export is deleted', async () => {
      const returnExport = await ReturnExport.create({
        original_export_id: testExport._id,
        return_amount: 10000000,
        return_reason: 'Test return',
        branch: 'Test Branch',
        return_date: new Date(),
        user: 'Admin User'
      });

      const response = await request(app)
        .delete(`/api/return-export/${returnExport._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);

      // Check if activity log was created
      const ActivityLog = (await import('../models/ActivityLog.js')).default;
      const activityLogs = await ActivityLog.find({ 
        module: 'return_export',
        action: 'delete',
        ref_id: returnExport._id
      });
      expect(activityLogs.length).toBeGreaterThan(0);
    });
  });
});
