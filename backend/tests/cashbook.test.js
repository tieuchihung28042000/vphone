import request from 'supertest';
import app from '../test-app.js';
import Cashbook from '../models/Cashbook.js';
import User from '../models/User.js';
import Branch from '../models/Branch.js';
import bcrypt from 'bcryptjs';

describe('Cashbook API (STORY_03)', () => {
  let testBranch;
  let adminToken;
  let managerToken;

  beforeAll(async () => {
    try {
      console.log('Starting cashbook test setup...');
      const timestamp = Date.now();
      // Create test branch
      testBranch = await Branch.create({
        name: `Test Branch ${timestamp}`,
        address: 'Test Address',
        phone: '0123456789'
      });
      console.log('Test branch created:', testBranch.name);

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
      .send({ email: adminUser.email, password: '123456' });
    console.log('Admin login response:', adminLogin.status, adminLogin.body);
    adminToken = adminLogin.body.token;

    const managerLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: managerUser.email, password: '123456' });
    console.log('Manager login response:', managerLogin.status, managerLogin.body);
    managerToken = managerLogin.body.token;
    console.log('Cashbook test setup completed successfully');
    } catch (error) {
      console.error('Error in cashbook test setup:', error);
      throw error;
    }
  });

  describe('POST /api/cashbook', () => {
    it('should create a new cashbook transaction', async () => {
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
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('transaction');
      expect(response.body.transaction.amount).toBe(1000000);
      expect(response.body.transaction.content).toBe('Bán hàng iPhone');
    });

    it('should validate required fields', async () => {
      const invalidData = {
        type: 'thu',
        // missing amount, content, source, branch
      };

      const response = await request(app)
        .post('/api/cashbook')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidData);

      expect(response.status).toBe(400);
    });

    it('should validate source enum values', async () => {
      const invalidData = {
        type: 'thu',
        amount: 1000000,
        content: 'Test transaction',
        source: 'invalid_source',
        branch: 'Test Branch'
      };

      const response = await request(app)
        .post('/api/cashbook')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidData);

      expect(response.status).toBe(400);
    });

    it('should require authentication', async () => {
      const transactionData = {
        type: 'thu',
        amount: 1000000,
        content: 'Test transaction',
        source: 'tien_mat',
        branch: 'Test Branch'
      };

      const response = await request(app)
        .post('/api/cashbook')
        .send(transactionData);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/cashbook', () => {
    beforeEach(async () => {
      // Create test transactions
      await Cashbook.create([
        {
          type: 'thu',
          amount: 1000000,
          content: 'Bán hàng iPhone',
          source: 'tien_mat',
          branch: 'Test Branch',
          date: new Date(),
          user: 'Admin User'
        },
        {
          type: 'chi',
          amount: 500000,
          content: 'Mua phụ kiện',
          source: 'the',
          branch: 'Test Branch',
          date: new Date(),
          user: 'Admin User'
        }
      ]);
    });

    it('should get cashbook transactions with pagination', async () => {
      const response = await request(app)
        .get('/api/cashbook?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('items');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('limit');
      expect(Array.isArray(response.body.items)).toBe(true);
    });

    it('should filter transactions by date range', async () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const response = await request(app)
        .get(`/api/cashbook?from=${yesterday.toISOString()}&to=${today.toISOString()}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.items.length).toBeGreaterThan(0);
    });

    it('should filter transactions by type', async () => {
      const response = await request(app)
        .get('/api/cashbook?type=thu')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      response.body.items.forEach(item => {
        expect(item.type).toBe('thu');
      });
    });

    it('should filter transactions by source', async () => {
      const response = await request(app)
        .get('/api/cashbook?source=tien_mat')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      response.body.items.forEach(item => {
        expect(item.source).toBe('tien_mat');
      });
    });
  });

  describe('GET /api/cashbook/contents', () => {
    beforeEach(async () => {
      // Create transactions with different contents
      await Cashbook.create([
        {
          type: 'thu',
          amount: 1000000,
          content: 'Bán hàng iPhone',
          source: 'tien_mat',
          branch: 'Test Branch',
          date: new Date(),
          user: 'Admin User'
        },
        {
          type: 'thu',
          amount: 2000000,
          content: 'Bán hàng iPhone',
          source: 'tien_mat',
          branch: 'Test Branch',
          date: new Date(),
          user: 'Admin User'
        },
        {
          type: 'chi',
          amount: 500000,
          content: 'Mua phụ kiện',
          source: 'the',
          branch: 'Test Branch',
          date: new Date(),
          user: 'Admin User'
        }
      ]);
    });

    it('should get content suggestions with counts', async () => {
      const response = await request(app)
        .get('/api/cashbook/contents')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      const iphoneContent = response.body.find(item => item.content === 'Bán hàng iPhone');
      expect(iphoneContent).toBeDefined();
      expect(iphoneContent.count).toBe(2);
      
      const phukienContent = response.body.find(item => item.content === 'Mua phụ kiện');
      expect(phukienContent).toBeDefined();
      expect(phukienContent.count).toBe(1);
    });

    it('should limit results when limit parameter is provided', async () => {
      const response = await request(app)
        .get('/api/cashbook/contents?limit=1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBeLessThanOrEqual(1);
    });
  });

  describe('PUT /api/cashbook/:id', () => {
    let transactionId;

    beforeEach(async () => {
      const transaction = await Cashbook.create({
        type: 'thu',
        amount: 1000000,
        content: 'Bán hàng iPhone',
        source: 'tien_mat',
        branch: 'Test Branch',
        date: new Date(),
        user: 'Admin User'
      });
      transactionId = transaction._id;
    });

    it('should update a cashbook transaction', async () => {
      const updateData = {
        amount: 1500000,
        content: 'Bán hàng iPhone 15 Pro'
      };

      const response = await request(app)
        .put(`/api/cashbook/${transactionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('transaction');
      expect(response.body.transaction.amount).toBe(1500000);
      expect(response.body.transaction.content).toBe('Bán hàng iPhone 15 Pro');
    });

    it('should return 404 for non-existent transaction', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const updateData = { amount: 1500000 };

      const response = await request(app)
        .put(`/api/cashbook/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/cashbook/:id', () => {
    let transactionId;

    beforeEach(async () => {
      const transaction = await Cashbook.create({
        type: 'thu',
        amount: 1000000,
        content: 'Bán hàng iPhone',
        source: 'tien_mat',
        branch: 'Test Branch',
        date: new Date(),
        user: 'Admin User'
      });
      transactionId = transaction._id;
    });

    it('should delete a cashbook transaction', async () => {
      const response = await request(app)
        .delete(`/api/cashbook/${transactionId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');

      // Verify transaction is deleted
      const deletedTransaction = await Cashbook.findById(transactionId);
      expect(deletedTransaction).toBeNull();
    });

    it('should return 404 for non-existent transaction', async () => {
      const fakeId = '507f1f77bcf86cd799439011';

      const response = await request(app)
        .delete(`/api/cashbook/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/cashbook/balance', () => {
    beforeEach(async () => {
      // Create transactions with different sources
      await Cashbook.create([
        {
          type: 'thu',
          amount: 1000000,
          content: 'Bán hàng',
          source: 'tien_mat',
          branch: 'Test Branch',
          date: new Date(),
          user: 'Admin User'
        },
        {
          type: 'chi',
          amount: 300000,
          content: 'Mua hàng',
          source: 'tien_mat',
          branch: 'Test Branch',
          date: new Date(),
          user: 'Admin User'
        },
        {
          type: 'thu',
          amount: 500000,
          content: 'Bán hàng',
          source: 'the',
          branch: 'Test Branch',
          date: new Date(),
          user: 'Admin User'
        }
      ]);
    });

    it('should get balance by source for a branch', async () => {
      const response = await request(app)
        .get(`/api/cashbook/balance?branch=Test Branch`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      // Should have balance for tien_mat and the
      const tienMatBalance = response.body.find(item => item.source === 'tien_mat');
      const theBalance = response.body.find(item => item.source === 'the');
      
      expect(tienMatBalance).toBeDefined();
      expect(theBalance).toBeDefined();
      expect(tienMatBalance.balance).toBe(700000); // 1000000 - 300000
      expect(theBalance.balance).toBe(500000);
    });
  });
});
