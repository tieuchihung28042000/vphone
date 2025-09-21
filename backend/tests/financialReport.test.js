import request from 'supertest';
import app from '../test-app.js';
import Cashbook from '../models/Cashbook.js';
import ExportHistory from '../models/ExportHistory.js';
import ReturnExport from '../models/ReturnExport.js';
import User from '../models/User.js';
import Branch from '../models/Branch.js';
import bcrypt from 'bcryptjs';

describe('Financial Report API (STORY_08)', () => {
  let testBranch;
  let adminToken;
  let managerToken;

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

    // Create manager user
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

    // Get tokens
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: `admin${timestamp}@test.com`, password: '123456' });
    adminToken = adminLogin.body.token;

    const managerLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: `manager${timestamp}@test.com`, password: '123456' });
    managerToken = managerLogin.body.token;
  });

  describe('GET /api/report/financial-report/summary', () => {
    beforeEach(async () => {
      // Create test data for financial report
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Create sales data
      await ExportHistory.create([
        {
          imei: '123456789012345',
          product_name: 'iPhone 15 Pro',
          sku: 'IPH15PRO',
          quantity: 1,
          price_sell: 25000000,
          da_thanh_toan: 20000000,
          sold_date: today,
          customer_name: 'Customer 1',
          customer_phone: '0123456789',
          branch: 'Test Branch',
          sales_channel: 'Store',
          salesperson: 'Admin User'
        },
        {
          imei: '123456789012346',
          product_name: 'iPhone 15 Pro Max',
          sku: 'IPH15PROMAX',
          quantity: 1,
          price_sell: 30000000,
          da_thanh_toan: 30000000,
          sold_date: yesterday,
          customer_name: 'Customer 2',
          customer_phone: '0987654321',
          branch: 'Test Branch',
          sales_channel: 'Online',
          salesperson: 'Manager User'
        }
      ]);

      // Create return data
      await ReturnExport.create([
        {
          export_id: 'export-1',
          return_amount: 5000000,
          return_reason: 'Customer return',
          branch: 'Test Branch',
          return_date: today,
          user: 'Admin User'
        }
      ]);

      // Create cashbook data
      await Cashbook.create([
        {
          type: 'thu',
          amount: 20000000,
          content: 'Bán hàng iPhone',
          source: 'tien_mat',
          branch: 'Test Branch',
          date: today,
          user: 'Admin User'
        },
        {
          type: 'thu',
          amount: 30000000,
          content: 'Bán hàng iPhone Pro Max',
          source: 'the',
          branch: 'Test Branch',
          date: yesterday,
          user: 'Manager User'
        },
        {
          type: 'chi',
          amount: 10000000,
          content: 'Mua phụ kiện',
          source: 'tien_mat',
          branch: 'Test Branch',
          date: today,
          user: 'Admin User'
        },
        {
          type: 'chi',
          amount: 5000000,
          content: 'Trả hàng bán',
          source: 'tien_mat',
          branch: 'Test Branch',
          date: today,
          user: 'Admin User'
        }
      ]);
    });

    it('should get financial report summary with all 7 indicators', async () => {
      const response = await request(app)
        .get('/api/report/financial-report/summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalRevenue');
      expect(response.body).toHaveProperty('totalReturnRevenue');
      expect(response.body).toHaveProperty('netRevenue');
      expect(response.body).toHaveProperty('totalExpense');
      expect(response.body).toHaveProperty('operatingProfit');
      expect(response.body).toHaveProperty('otherIncome');
      expect(response.body).toHaveProperty('netProfit');
    });

    it('should calculate total revenue correctly', async () => {
      const response = await request(app)
        .get('/api/report/financial-report/summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.totalRevenue).toBe(55000000); // 25M + 30M
    });

    it('should calculate return revenue correctly', async () => {
      const response = await request(app)
        .get('/api/report/financial-report/summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.totalReturnRevenue).toBe(5000000); // From ReturnExport
    });

    it('should calculate net revenue correctly', async () => {
      const response = await request(app)
        .get('/api/report/financial-report/summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.netRevenue).toBe(50000000); // 55M - 5M
    });

    it('should calculate total expense correctly', async () => {
      const response = await request(app)
        .get('/api/report/financial-report/summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.totalExpense).toBe(15000000); // 10M + 5M
    });

    it('should calculate operating profit correctly', async () => {
      const response = await request(app)
        .get('/api/report/financial-report/summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.operatingProfit).toBe(35000000); // 50M - 15M
    });

    it('should calculate other income correctly', async () => {
      const response = await request(app)
        .get('/api/report/financial-report/summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.otherIncome).toBe(0); // No other income in test data
    });

    it('should calculate net profit correctly', async () => {
      const response = await request(app)
        .get('/api/report/financial-report/summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.netProfit).toBe(35000000); // 35M + 0M
    });

    it('should filter by date range', async () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const response = await request(app)
        .get(`/api/report/financial-report/summary?from=${yesterday.toISOString()}&to=${today.toISOString()}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalRevenue');
      expect(response.body).toHaveProperty('netProfit');
    });

    it('should filter by branch', async () => {
      const response = await request(app)
        .get('/api/report/financial-report/summary?branch=Test Branch')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalRevenue');
      expect(response.body).toHaveProperty('netProfit');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/report/financial-report/summary');

      expect(response.status).toBe(401);
    });

    it('should allow admin access', async () => {
      const response = await request(app)
        .get('/api/report/financial-report/summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
    });

    it('should allow manager access', async () => {
      const response = await request(app)
        .get('/api/report/financial-report/summary')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(response.status).toBe(200);
    });

    it('should deny access to non-admin/manager users', async () => {
      // Create sales user
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
        .get('/api/report/financial-report/summary')
        .set('Authorization', `Bearer ${salesToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('Financial Report Data Validation', () => {
    it('should return valid financial data structure', async () => {
      const response = await request(app)
        .get('/api/report/financial-report/summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      
      const data = response.body;
      expect(typeof data.totalRevenue).toBe('number');
      expect(typeof data.totalReturnRevenue).toBe('number');
      expect(typeof data.netRevenue).toBe('number');
      expect(typeof data.totalExpense).toBe('number');
      expect(typeof data.operatingProfit).toBe('number');
      expect(typeof data.otherIncome).toBe('number');
      expect(typeof data.netProfit).toBe('number');
      
      // All values should be non-negative
      expect(data.totalRevenue).toBeGreaterThanOrEqual(0);
      expect(data.totalReturnRevenue).toBeGreaterThanOrEqual(0);
      expect(data.netRevenue).toBeGreaterThanOrEqual(0);
      expect(data.totalExpense).toBeGreaterThanOrEqual(0);
      expect(data.operatingProfit).toBeGreaterThanOrEqual(0);
      expect(data.otherIncome).toBeGreaterThanOrEqual(0);
      expect(data.netProfit).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty data gracefully', async () => {
      // Clear all test data
      await Cashbook.deleteMany({});
      await ExportHistory.deleteMany({});
      await ReturnExport.deleteMany({});

      const response = await request(app)
        .get('/api/report/financial-report/summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      
      const data = response.body;
      expect(data.totalRevenue).toBe(0);
      expect(data.totalReturnRevenue).toBe(0);
      expect(data.netRevenue).toBe(0);
      expect(data.totalExpense).toBe(0);
      expect(data.operatingProfit).toBe(0);
      expect(data.otherIncome).toBe(0);
      expect(data.netProfit).toBe(0);
    });
  });

  describe('Financial Report Performance', () => {
    it('should respond within reasonable time', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/report/financial-report/summary')
        .set('Authorization', `Bearer ${adminToken}`);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(5000); // Should respond within 5 seconds
    });
  });

  describe('Financial Report Edge Cases', () => {
    it('should handle invalid date range', async () => {
      const response = await request(app)
        .get('/api/report/financial-report/summary?from=invalid-date&to=invalid-date')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
    });

    it('should handle future date range', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const response = await request(app)
        .get(`/api/report/financial-report/summary?from=${futureDate.toISOString()}&to=${futureDate.toISOString()}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      
      // Should return zero values for future dates
      const data = response.body;
      expect(data.totalRevenue).toBe(0);
      expect(data.netProfit).toBe(0);
    });

    it('should handle very large date range', async () => {
      const startDate = new Date('2020-01-01');
      const endDate = new Date('2030-12-31');

      const response = await request(app)
        .get(`/api/report/financial-report/summary?from=${startDate.toISOString()}&to=${endDate.toISOString()}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalRevenue');
    });
  });
});
