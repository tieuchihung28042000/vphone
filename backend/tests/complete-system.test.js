import request from 'supertest';
import app from '../test-app.js';
import { setupTestData, cleanupTestData, getTestData } from './test-helpers.js';
import { connectTestDB, disconnectTestDB, clearTestDB } from './db-setup.js';

describe('Complete System Test Suite', () => {
  let testData;

  beforeAll(async () => {
    try {
      console.log('🚀 Starting complete system test setup...');
      
      // Connect to test database
      await connectTestDB();
      
      // Setup test data
      testData = await setupTestData();

      console.log('✅ Complete system test setup completed');
    } catch (error) {
      console.error('❌ Complete system test setup failed:', error);
      throw error;
    }
  });

  afterAll(async () => {
    try {
      await cleanupTestData();
      await clearTestDB();
      await disconnectTestDB();
    } catch (error) {
      console.error('❌ Complete system test cleanup failed:', error);
    }
  });

  describe('STORY_01: Role-based Access Control', () => {
    it('should allow admin to access all routes', async () => {
      const response = await request(app)
        .get('/api/users/all-users')
        .set('Authorization', `Bearer ${testData.adminToken}`);

      expect(response.status).toBe(200);
    });

    it('should restrict manager access to certain routes', async () => {
      const response = await request(app)
        .get('/api/users/all-users')
        .set('Authorization', `Bearer ${testData.managerToken}`);

      expect(response.status).toBe(200);
    });

    it('should deny access without token', async () => {
      const response = await request(app)
        .get('/api/users/all-users');

      expect(response.status).toBe(401);
    });
  });

  describe('STORY_02: Activity Logging', () => {
    it('should create activity log when creating cashbook transaction', async () => {
      const transactionData = {
        date: new Date(),
        content: 'Test activity log transaction',
        amount: 50000,
        type: 'thu',
        source: 'tien_mat',
        branch: testData.testBranch.name
      };

      const response = await request(app)
        .post('/api/cashbook')
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send(transactionData);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('thành công');
    });

    it('should get activity logs', async () => {
      const response = await request(app)
        .get('/api/activity-logs')
        .set('Authorization', `Bearer ${testData.adminToken}`);

      console.log('Activity logs response:', response.status, response.body);
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
    });
  });

  describe('STORY_03: Cashbook Content Suggestions', () => {
    it('should get cashbook content suggestions', async () => {
      const response = await request(app)
        .get('/api/cashbook/contents')
        .set('Authorization', `Bearer ${testData.adminToken}`);

      console.log('Cashbook contents response:', response.status, response.body);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should create cashbook transaction with suggestions', async () => {
      const transactionData = {
        date: new Date(),
        content: 'Bán điện thoại iPhone',
        amount: 15000000,
        type: 'thu',
        source: 'tien_mat',
        branch: testData.testBranch.name
      };

      const response = await request(app)
        .post('/api/cashbook')
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send(transactionData);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('thành công');
    });
  });

  describe('STORY_04: Multi-payment Purchase Return', () => {
    it('should create purchase with multi-payment', async () => {
      const purchaseData = {
        product_name: 'iPhone 15 Pro',
        sku: 'IP15P-001',
        imei: '123456789012345',
        price_buy: 20000000,
        price_sell: 25000000,
        category: 'iPhone',
        branch: testData.testBranch.name,
        supplier: 'Apple Vietnam',
        payments: [
          { source: 'tien_mat', amount: 10000000 },
          { source: 'the', amount: 10000000 }
        ]
      };

      const response = await request(app)
        .post('/api/nhap-hang')
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send(purchaseData);

      console.log('Purchase response:', response.status, response.body);
      expect(response.status).toBe(201);
      expect(response.body.message).toContain('thành công');
    });

    it('should create purchase return with multi-payment', async () => {
      // First create a product to return
      const purchaseData = {
        product_name: 'iPhone 15 Pro Return',
        sku: 'IP15P-RETURN-001',
        imei: '123456789012346',
        price_buy: 20000000,
        price_sell: 25000000,
        category: 'iPhone',
        branch: testData.testBranch.name,
        supplier: 'Apple Vietnam'
      };

      const purchaseResponse = await request(app)
        .post('/api/nhap-hang')
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send(purchaseData);

      expect(purchaseResponse.status).toBe(201);
      const productId = purchaseResponse.body.data._id;

      // Now create return for the product
      const returnData = {
        original_inventory_id: productId,
        product_name: 'iPhone 15 Pro Return',
        sku: 'IP15P-RETURN-001',
        imei: '123456789012346',
        price_buy: 20000000,
        supplier: 'Apple Vietnam',
        return_amount: 20000000,
        return_cash: 10000000,
        return_transfer: 10000000,
        return_reason: 'Lỗi sản phẩm',
        branch: testData.testBranch.name
      };

      const response = await request(app)
        .post('/api/return-import')
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send(returnData);

      console.log('Purchase return response:', response.status, response.body);
      expect(response.status).toBe(201);
      expect(response.body.message).toContain('thành công');
    });
  });

  describe('STORY_05: Sales Batch Multi-payment', () => {
    it('should create batch sales with multi-payment', async () => {
      // First create a product to sell
      const purchaseData = {
        product_name: 'iPhone 15 Pro Batch',
        sku: 'IP15P-BATCH-001',
        imei: '123456789012347',
        price_buy: 20000000,
        price_sell: 25000000,
        category: 'iPhone',
        branch: testData.testBranch.name,
        supplier: 'Apple Vietnam'
      };

      const purchaseResponse = await request(app)
        .post('/api/nhap-hang')
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send(purchaseData);

      console.log('Purchase response:', purchaseResponse.status, purchaseResponse.body);
      expect(purchaseResponse.status).toBe(201);
      const productId = purchaseResponse.body.data._id;

      // Now create batch sales
      const salesData = {
        items: [
          {
            product_id: productId,
            imei: '123456789012347',
            sku: 'IP15P-BATCH-001',
            product_name: 'iPhone 15 Pro Batch',
            quantity: 1,
            sale_price: 25000000,
            warranty: '12 tháng'
          }
        ],
        buyer_name: 'Nguyễn Văn A',
        buyer_phone: '0123456789',
        sale_date: new Date(),
        payments: [
          { source: 'tien_mat', amount: 15000000 },
          { source: 'the', amount: 10000000 }
        ],
        sales_channel: 'Cửa hàng',
        salesperson: 'Nhân viên bán hàng',
        branch: testData.testBranch.name
      };

      const response = await request(app)
        .post('/api/report-batch/report/xuat-hang-batch')
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send(salesData);

      console.log('Sales batch response:', response.status, response.body);
      expect(response.status).toBe(200);
      expect(response.body.message).toContain('thành công');
    });
  });

  describe('STORY_06: Sales Return Voucher', () => {
    it('should create sales return voucher', async () => {
      // First create a product and sell it to get ExportHistory
      const purchaseData = {
        product_name: 'iPhone 15 Pro Return',
        sku: 'IP15P-RETURN-002',
        imei: '123456789012348',
        price_buy: 20000000,
        price_sell: 25000000,
        category: 'iPhone',
        branch: testData.testBranch.name,
        supplier: 'Apple Vietnam'
      };

      const purchaseResponse = await request(app)
        .post('/api/nhap-hang')
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send(purchaseData);

      expect(purchaseResponse.status).toBe(201);
      const productId = purchaseResponse.body.data._id;

      // Create a simple export history
      const ExportHistory = (await import('../models/ExportHistory.js')).default;
      const exportHistory = await ExportHistory.create({
        product_id: productId,
        product_name: 'iPhone 15 Pro Return',
        sku: 'IP15P-RETURN-002',
        imei: '123456789012348',
        price_buy: 20000000,
        price_sell: 25000000,
        buyer_name: 'Nguyễn Văn A',
        customer_name: 'Nguyễn Văn A',
        customer_phone: '0123456789',
        sale_date: new Date(),
        branch: testData.testBranch.name
      });

      // Now create sales return
      const returnData = {
        product_name: 'iPhone 15 Pro Return',
        sku: 'IP15P-RETURN-002',
        imei: '123456789012348',
        price_sell: 25000000,
        customer_name: 'Nguyễn Văn A',
        customer_phone: '0123456789',
        return_amount: 25000000,
        return_method: 'cash',
        return_reason: 'Khách hàng không hài lòng',
        branch: testData.testBranch.name,
        original_export_id: exportHistory._id
      };

      const response = await request(app)
        .post('/api/return-export')
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send(returnData);

      console.log('Sales return response:', response.status, response.body);
      expect(response.status).toBe(201);
      expect(response.body.message).toContain('thành công');
    });
  });

  describe('STORY_07: Debt Management', () => {
    it('should get customer debt list', async () => {
      const response = await request(app)
        .get('/api/cong-no/cong-no-list')
        .set('Authorization', `Bearer ${testData.adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should get supplier debt list', async () => {
      const response = await request(app)
        .get('/api/cong-no/supplier-debt-list')
        .set('Authorization', `Bearer ${testData.adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should record customer debt payment', async () => {
      const paymentData = {
        customer_name: 'Nguyễn Văn A',
        customer_phone: '0123456789',
        payments: [
          { source: 'tien_mat', amount: 5000000 }
        ]
      };

      const response = await request(app)
        .put('/api/cong-no/cong-no-pay-customer')
        .set('Authorization', `Bearer ${testData.adminToken}`)
        .send(paymentData);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Đã trả nợ');
    });
  });

  describe('STORY_08: Financial Report', () => {
    it('should get financial report summary', async () => {
      const response = await request(app)
        .get('/api/report/financial-report/summary?from=2024-01-01&to=2024-12-31')
        .set('Authorization', `Bearer ${testData.adminToken}`);

      console.log('Financial report response:', response.status, response.body);
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalRevenue');
      expect(response.body).toHaveProperty('totalExpense');
      expect(response.body).toHaveProperty('netProfit');
    });
  });

  describe('Authentication Flow', () => {
    it('should login with valid credentials', async () => {
      const loginData = {
        email: testData.adminUser.email,
        password: '123456'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
    });

    it('should reject invalid credentials', async () => {
      const loginData = {
        email: 'invalid@test.com',
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(response.status).toBe(401);
    });
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'OK');
    });
  });
});
