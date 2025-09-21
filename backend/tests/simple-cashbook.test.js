import request from 'supertest';
import app from '../test-app.js';
import Cashbook from '../models/Cashbook.js';
import { setupTestData, cleanupTestData, getTestData } from './test-helpers.js';
import { connectTestDB, disconnectTestDB, clearTestDB } from './db-setup.js';

describe('Simple Cashbook API Test', () => {
  let adminToken;
  let managerToken;

  beforeAll(async () => {
    try {
      console.log('Starting simple cashbook test setup...');
      
      // Connect to test database
      await connectTestDB();
      
      // Setup test data
      const testData = await setupTestData();
      adminToken = testData.adminToken;
      managerToken = testData.managerToken;

      console.log('Simple cashbook test setup completed');
    } catch (error) {
      console.error('Simple cashbook test setup failed:', error);
      throw error;
    }
  });

  afterAll(async () => {
    try {
      await cleanupTestData();
      await clearTestDB();
      await disconnectTestDB();
    } catch (error) {
      console.error('Simple cashbook test cleanup failed:', error);
    }
  });

  describe('POST /api/cashbook', () => {
    it('should create a new cashbook transaction', async () => {
      const testData = getTestData();
      const transactionData = {
        date: new Date(),
        content: 'Test transaction',
        amount: 100000,
        type: 'thu',
        source: 'tien_mat',
        branch: testData.testBranch.name
      };

      const response = await request(app)
        .post('/api/cashbook')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(transactionData);

      console.log('Response status:', response.status);
      console.log('Response body:', response.body);
      
      expect(response.status).toBe(200);
      expect(response.body.message).toContain('thành công');
      expect(response.body.cashbook).toBeDefined();
    });

    it('should require authentication', async () => {
      const transactionData = {
        date: new Date(),
        content: 'Test transaction',
        amount: 100000,
        type: 'income',
        source: 'tien_mat'
      };

      const response = await request(app)
        .post('/api/cashbook')
        .send(transactionData);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/cashbook', () => {
    it('should get cashbook transactions', async () => {
      const response = await request(app)
        .get('/api/cashbook')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('items');
      expect(response.body).toHaveProperty('total');
    });
  });
});
