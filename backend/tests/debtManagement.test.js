import request from 'supertest';
import app from '../test-app.js';
import Debt from '../models/Debt.js';
import SupplierDebt from '../models/SupplierDebt.js';
import Cashbook from '../models/Cashbook.js';
import User from '../models/User.js';
import Branch from '../models/Branch.js';
import ExportHistory from '../models/ExportHistory.js';
import bcrypt from 'bcryptjs';

describe('Debt Management API (STORY_07)', () => {
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

    // Create test export with debt
    testExport = await ExportHistory.create({
      imei: '123456789012345',
      product_name: 'iPhone 15 Pro',
      sku: 'IPH15PRO',
      quantity: 1,
      price_sell: 25000000,
      da_thanh_toan: 15000000, // 10M debt
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

  describe('Customer Debt Management', () => {
    describe('GET /api/cong-no/cong-no-list', () => {
      it('should get customer debt list', async () => {
        const response = await request(app)
          .get('/api/cong-no/cong-no-list')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
      });

      it('should filter customer debts by branch', async () => {
        const response = await request(app)
          .get('/api/cong-no/cong-no-list?branch=Test Branch')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        response.body.forEach(debt => {
          expect(debt.branch).toBe('Test Branch');
        });
      });

      it('should filter customer debts by customer name', async () => {
        const response = await request(app)
          .get('/api/cong-no/cong-no-list?customer_name=Test Customer')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        response.body.forEach(debt => {
          expect(debt.customer_name).toContain('Test Customer');
        });
      });

      it('should filter customer debts by phone', async () => {
        const response = await request(app)
          .get('/api/cong-no/cong-no-list?customer_phone=0123456789')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        response.body.forEach(debt => {
          expect(debt.customer_phone).toBe('0123456789');
        });
      });

      it('should calculate debt days correctly', async () => {
        const response = await request(app)
          .get('/api/cong-no/cong-no-list')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        response.body.forEach(debt => {
          expect(debt).toHaveProperty('debt_days');
          expect(typeof debt.debt_days).toBe('number');
          expect(debt.debt_days).toBeGreaterThanOrEqual(0);
        });
      });
    });

    describe('PUT /api/cong-no/cong-no-pay-customer', () => {
      it('should record customer debt payment with multi-payment', async () => {
        const paymentData = {
          customer_id: 'customer-123',
          customer_name: 'Test Customer',
          customer_phone: '0123456789',
          payments: [
            { source: 'tien_mat', amount: 5000000 },
            { source: 'the', amount: 3000000 }
          ],
          total_amount: 8000000,
          branch: 'Test Branch'
        };

        const response = await request(app)
          .put('/api/cong-no/cong-no-pay-customer')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(paymentData);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('message');

        // Check if cashbook entries were created
        const cashbookEntries = await Cashbook.find({ 
          related_type: 'tra_no',
          customer: 'Test Customer'
        });
        expect(cashbookEntries.length).toBe(2);

        // Check individual payment entries
        const tienMatEntry = cashbookEntries.find(entry => entry.source === 'tien_mat');
        const theEntry = cashbookEntries.find(entry => entry.source === 'the');

        expect(tienMatEntry).toBeDefined();
        expect(tienMatEntry.amount).toBe(5000000);
        expect(tienMatEntry.type).toBe('thu');

        expect(theEntry).toBeDefined();
        expect(theEntry.amount).toBe(3000000);
        expect(theEntry.type).toBe('thu');
      });

      it('should validate payment amounts match total', async () => {
        const paymentData = {
          customer_id: 'customer-123',
          customer_name: 'Test Customer',
          customer_phone: '0123456789',
          payments: [
            { source: 'tien_mat', amount: 5000000 },
            { source: 'the', amount: 2000000 }
            // Total: 7M, but total_amount = 8M
          ],
          total_amount: 8000000,
          branch: 'Test Branch'
        };

        const response = await request(app)
          .put('/api/cong-no/cong-no-pay-customer')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(paymentData);

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toContain('Tổng thanh toán không khớp');
      });

      it('should require authentication', async () => {
        const paymentData = {
          customer_id: 'customer-123',
          customer_name: 'Test Customer',
          customer_phone: '0123456789',
          payments: [
            { source: 'tien_mat', amount: 5000000 }
          ],
          total_amount: 5000000,
          branch: 'Test Branch'
        };

        const response = await request(app)
          .put('/api/cong-no/cong-no-pay-customer')
          .send(paymentData);

        expect(response.status).toBe(401);
      });
    });

    describe('PUT /api/cong-no/cong-no-add-customer', () => {
      it('should add new customer debt', async () => {
        const debtData = {
          customer_name: 'New Customer',
          customer_phone: '0987654321',
          debt_amount: 5000000,
          debt_reason: 'Purchase on credit',
          branch: 'Test Branch'
        };

        const response = await request(app)
          .put('/api/cong-no/cong-no-add-customer')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(debtData);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('message');
      });

      it('should validate required fields', async () => {
        const invalidData = {
          // missing customer_name, debt_amount, branch
          customer_phone: '0987654321'
        };

        const response = await request(app)
          .put('/api/cong-no/cong-no-add-customer')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(invalidData);

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('message');
      });
    });
  });

  describe('Supplier Debt Management', () => {
    describe('GET /api/cong-no/supplier-debt-list', () => {
      it('should get supplier debt list', async () => {
        const response = await request(app)
          .get('/api/cong-no/supplier-debt-list')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
      });

      it('should filter supplier debts by branch', async () => {
        const response = await request(app)
          .get('/api/cong-no/supplier-debt-list?branch=Test Branch')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        response.body.forEach(debt => {
          expect(debt.branch).toBe('Test Branch');
        });
      });

      it('should filter supplier debts by supplier name', async () => {
        const response = await request(app)
          .get('/api/cong-no/supplier-debt-list?supplier_name=Test Supplier')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        response.body.forEach(debt => {
          expect(debt.supplier_name).toContain('Test Supplier');
        });
      });

      it('should calculate debt days correctly', async () => {
        const response = await request(app)
          .get('/api/cong-no/supplier-debt-list')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        response.body.forEach(debt => {
          expect(debt).toHaveProperty('debt_days');
          expect(typeof debt.debt_days).toBe('number');
          expect(debt.debt_days).toBeGreaterThanOrEqual(0);
        });
      });
    });

    describe('PUT /api/cong-no/supplier-debt-pay', () => {
      it('should record supplier debt payment with multi-payment', async () => {
        const paymentData = {
          supplier_id: 'supplier-123',
          supplier_name: 'Test Supplier',
          supplier_phone: '0123456789',
          payments: [
            { source: 'tien_mat', amount: 10000000 },
            { source: 'the', amount: 5000000 }
          ],
          total_amount: 15000000,
          branch: 'Test Branch'
        };

        const response = await request(app)
          .put('/api/cong-no/supplier-debt-pay')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(paymentData);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('message');

        // Check if cashbook entries were created
        const cashbookEntries = await Cashbook.find({ 
          related_type: 'tra_no_ncc',
          supplier: 'Test Supplier'
        });
        expect(cashbookEntries.length).toBe(2);

        // Check individual payment entries
        const tienMatEntry = cashbookEntries.find(entry => entry.source === 'tien_mat');
        const theEntry = cashbookEntries.find(entry => entry.source === 'the');

        expect(tienMatEntry).toBeDefined();
        expect(tienMatEntry.amount).toBe(10000000);
        expect(tienMatEntry.type).toBe('chi');

        expect(theEntry).toBeDefined();
        expect(theEntry.amount).toBe(5000000);
        expect(theEntry.type).toBe('chi');
      });

      it('should validate payment amounts match total', async () => {
        const paymentData = {
          supplier_id: 'supplier-123',
          supplier_name: 'Test Supplier',
          supplier_phone: '0123456789',
          payments: [
            { source: 'tien_mat', amount: 10000000 }
            // Total: 10M, but total_amount = 15M
          ],
          total_amount: 15000000,
          branch: 'Test Branch'
        };

        const response = await request(app)
          .put('/api/cong-no/supplier-debt-pay')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(paymentData);

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toContain('Tổng thanh toán không khớp');
      });
    });

    describe('PUT /api/cong-no/supplier-debt-add', () => {
      it('should add new supplier debt', async () => {
        const debtData = {
          supplier_name: 'New Supplier',
          supplier_phone: '0987654321',
          debt_amount: 10000000,
          debt_reason: 'Purchase on credit',
          branch: 'Test Branch'
        };

        const response = await request(app)
          .put('/api/cong-no/supplier-debt-add')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(debtData);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('message');
      });

      it('should validate required fields', async () => {
        const invalidData = {
          // missing supplier_name, debt_amount, branch
          supplier_phone: '0987654321'
        };

        const response = await request(app)
          .put('/api/cong-no/supplier-debt-add')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(invalidData);

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('message');
      });
    });
  });

  describe('Debt Statistics', () => {
    it('should calculate total customer debt', async () => {
      const response = await request(app)
        .get('/api/cong-no/cong-no-list')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      
      const totalDebt = response.body.reduce((sum, debt) => sum + debt.debt_amount, 0);
      expect(totalDebt).toBeGreaterThanOrEqual(0);
    });

    it('should calculate total supplier debt', async () => {
      const response = await request(app)
        .get('/api/cong-no/supplier-debt-list')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      
      const totalDebt = response.body.reduce((sum, debt) => sum + debt.debt_amount, 0);
      expect(totalDebt).toBeGreaterThanOrEqual(0);
    });

    it('should identify largest customer debt', async () => {
      const response = await request(app)
        .get('/api/cong-no/cong-no-list')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      
      if (response.body.length > 0) {
        const largestDebt = Math.max(...response.body.map(debt => debt.debt_amount));
        expect(largestDebt).toBeGreaterThanOrEqual(0);
      }
    });

    it('should identify largest supplier debt', async () => {
      const response = await request(app)
        .get('/api/cong-no/supplier-debt-list')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      
      if (response.body.length > 0) {
        const largestDebt = Math.max(...response.body.map(debt => debt.debt_amount));
        expect(largestDebt).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Debt History', () => {
    it('should track debt payment history', async () => {
      const paymentData = {
        customer_id: 'customer-123',
        customer_name: 'Test Customer',
        customer_phone: '0123456789',
        payments: [
          { source: 'tien_mat', amount: 5000000 }
        ],
        total_amount: 5000000,
        branch: 'Test Branch'
      };

      const response = await request(app)
        .put('/api/cong-no/cong-no-pay-customer')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(paymentData);

      expect(response.status).toBe(200);

      // Check if debt history was updated
      const debt = await Debt.findOne({ customer_name: 'Test Customer' });
      expect(debt).toBeDefined();
      expect(debt.payment_history).toBeDefined();
      expect(Array.isArray(debt.payment_history)).toBe(true);
    });

    it('should track supplier debt payment history', async () => {
      const paymentData = {
        supplier_id: 'supplier-123',
        supplier_name: 'Test Supplier',
        supplier_phone: '0123456789',
        payments: [
          { source: 'tien_mat', amount: 10000000 }
        ],
        total_amount: 10000000,
        branch: 'Test Branch'
      };

      const response = await request(app)
        .put('/api/cong-no/supplier-debt-pay')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(paymentData);

      expect(response.status).toBe(200);

      // Check if supplier debt history was updated
      const supplierDebt = await SupplierDebt.findOne({ supplier_name: 'Test Supplier' });
      expect(supplierDebt).toBeDefined();
      expect(supplierDebt.payment_history).toBeDefined();
      expect(Array.isArray(supplierDebt.payment_history)).toBe(true);
    });
  });

  describe('Debt Days Calculation', () => {
    it('should calculate debt days correctly for customer', async () => {
      const response = await request(app)
        .get('/api/cong-no/cong-no-list')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      
      response.body.forEach(debt => {
        expect(debt).toHaveProperty('debt_days');
        expect(typeof debt.debt_days).toBe('number');
        expect(debt.debt_days).toBeGreaterThanOrEqual(0);
        
        // Debt days should be calculated from debt_date to now
        const debtDate = new Date(debt.debt_date);
        const now = new Date();
        const expectedDays = Math.floor((now - debtDate) / (1000 * 60 * 60 * 24));
        expect(debt.debt_days).toBe(expectedDays);
      });
    });

    it('should calculate debt days correctly for supplier', async () => {
      const response = await request(app)
        .get('/api/cong-no/supplier-debt-list')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      
      response.body.forEach(debt => {
        expect(debt).toHaveProperty('debt_days');
        expect(typeof debt.debt_days).toBe('number');
        expect(debt.debt_days).toBeGreaterThanOrEqual(0);
        
        // Debt days should be calculated from debt_date to now
        const debtDate = new Date(debt.debt_date);
        const now = new Date();
        const expectedDays = Math.floor((now - debtDate) / (1000 * 60 * 60 * 24));
        expect(debt.debt_days).toBe(expectedDays);
      });
    });
  });
});
