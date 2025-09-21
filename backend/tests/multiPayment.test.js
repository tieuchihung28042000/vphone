import request from 'supertest';
import app from '../test-app.js';
import Cashbook from '../models/Cashbook.js';
import User from '../models/User.js';
import Branch from '../models/Branch.js';
import Inventory from '../models/Inventory.js';
import bcrypt from 'bcryptjs';

describe('Multi-payment API (STORY_04, 05)', () => {
  let testBranch;
  let adminUser;
  let adminToken;
  let testInventory;

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

    // Create test inventory
    testInventory = await Inventory.create({
      imei: '123456789012345',
      product_name: 'iPhone 15 Pro',
      sku: 'IPH15PRO',
      price_import: 20000000,
      quantity: 5,
      branch: 'Test Branch',
      category: 'iPhone',
      supplier: 'Apple Store',
      import_date: new Date()
    });

    // Get token
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: adminUser.email, password: '123456' });
    adminToken = adminLogin.body.token;
  });

  describe('Multi-payment Purchase (STORY_04)', () => {
    it('should create purchase with multi-payment', async () => {
      const purchaseData = {
        imei: '987654321098765',
        product_name: 'iPhone 15 Pro Max',
        sku: 'IPH15PROMAX',
        price_import: 25000000,
        quantity: 2,
        branch: 'Test Branch',
        category: 'iPhone',
        supplier: 'Apple Store',
        payments: [
          { source: 'tien_mat', amount: 15000000 },
          { source: 'the', amount: 10000000 }
        ]
      };

      const response = await request(app)
        .post('/api/nhap-hang')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(purchaseData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message');

      // Check if cashbook entries were created
      const cashbookEntries = await Cashbook.find({ 
        related_type: 'nhap_hang',
        related_id: response.body.inventory._id
      });
      expect(cashbookEntries.length).toBe(2);

      // Check individual payment entries
      const tienMatEntry = cashbookEntries.find(entry => entry.source === 'tien_mat');
      const theEntry = cashbookEntries.find(entry => entry.source === 'the');

      expect(tienMatEntry).toBeDefined();
      expect(tienMatEntry.amount).toBe(15000000);
      expect(tienMatEntry.type).toBe('chi');

      expect(theEntry).toBeDefined();
      expect(theEntry.amount).toBe(10000000);
      expect(theEntry.type).toBe('chi');
    });

    it('should validate payment amounts match total', async () => {
      const purchaseData = {
        imei: '111111111111111',
        product_name: 'iPhone 15',
        sku: 'IPH15',
        price_import: 20000000,
        quantity: 1,
        branch: 'Test Branch',
        category: 'iPhone',
        supplier: 'Apple Store',
        payments: [
          { source: 'tien_mat', amount: 10000000 },
          { source: 'the', amount: 5000000 }
          // Total: 15M, but price_import * quantity = 20M
        ]
      };

      const response = await request(app)
        .post('/api/nhap-hang')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(purchaseData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Tổng thanh toán không khớp');
    });

    it('should handle single payment source', async () => {
      const purchaseData = {
        imei: '222222222222222',
        product_name: 'iPhone 15',
        sku: 'IPH15SINGLE',
        price_import: 20000000,
        quantity: 1,
        branch: 'Test Branch',
        category: 'iPhone',
        supplier: 'Apple Store',
        payments: [
          { source: 'tien_mat', amount: 20000000 }
        ]
      };

      const response = await request(app)
        .post('/api/nhap-hang')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(purchaseData);

      expect(response.status).toBe(201);

      // Check if single cashbook entry was created
      const cashbookEntries = await Cashbook.find({ 
        related_type: 'nhap_hang',
        related_id: response.body.inventory._id
      });
      expect(cashbookEntries.length).toBe(1);
      expect(cashbookEntries[0].amount).toBe(20000000);
    });
  });

  describe('Multi-payment Sales (STORY_05)', () => {
    it('should create sales with multi-payment', async () => {
      const salesData = {
        item_id: testInventory._id,
        imei: testInventory.imei,
        product_name: testInventory.product_name,
        sku: testInventory.sku,
        quantity: 1,
        sale_price: 25000000,
        da_thanh_toan: 20000000,
        sale_date: new Date().toISOString(),
        buyer_name: 'Test Customer',
        buyer_phone: '0123456789',
        branch: 'Test Branch',
        source: 'tien_mat',
        payments: [
          { source: 'tien_mat', amount: 15000000 },
          { source: 'the', amount: 5000000 }
        ]
      };

      const response = await request(app)
        .post('/api/xuat-hang')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(salesData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message');

      // Check if cashbook entries were created
      const cashbookEntries = await Cashbook.find({ 
        related_type: 'ban_hang',
        related_id: response.body.export._id
      });
      expect(cashbookEntries.length).toBe(2);

      // Check individual payment entries
      const tienMatEntry = cashbookEntries.find(entry => entry.source === 'tien_mat');
      const theEntry = cashbookEntries.find(entry => entry.source === 'the');

      expect(tienMatEntry).toBeDefined();
      expect(tienMatEntry.amount).toBe(15000000);
      expect(tienMatEntry.type).toBe('thu');

      expect(theEntry).toBeDefined();
      expect(theEntry.amount).toBe(5000000);
      expect(theEntry.type).toBe('thu');
    });

    it('should create debt entry for unpaid amount', async () => {
      const salesData = {
        item_id: testInventory._id,
        imei: testInventory.imei,
        product_name: testInventory.product_name,
        sku: testInventory.sku,
        quantity: 1,
        sale_price: 25000000,
        da_thanh_toan: 15000000, // Less than sale_price
        sale_date: new Date().toISOString(),
        buyer_name: 'Test Customer',
        buyer_phone: '0123456789',
        branch: 'Test Branch',
        source: 'tien_mat'
      };

      const response = await request(app)
        .post('/api/xuat-hang')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(salesData);

      expect(response.status).toBe(201);

      // Check if debt entry was created
      const debtEntry = await Cashbook.findOne({ 
        related_type: 'ban_hang',
        related_id: response.body.export._id,
        source: 'cong_no'
      });
      expect(debtEntry).toBeDefined();
      expect(debtEntry.amount).toBe(10000000); // 25M - 15M
      expect(debtEntry.type).toBe('thu');
    });
  });

  describe('Multi-payment Debt Collection', () => {
    it('should handle multi-payment debt collection', async () => {
      const debtData = {
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
        .send(debtData);

      expect(response.status).toBe(200);

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
  });

  describe('Multi-payment Return Import', () => {
    it('should create return import with multi-payment', async () => {
      const returnData = {
        inventory_id: testInventory._id,
        return_amount: 20000000,
        return_reason: 'Defective product',
        branch: 'Test Branch',
        payments: [
          { source: 'tien_mat', amount: 10000000 },
          { source: 'the', amount: 10000000 }
        ]
      };

      const response = await request(app)
        .post('/api/return-import')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(returnData);

      expect(response.status).toBe(201);

      // Check if cashbook entries were created
      const cashbookEntries = await Cashbook.find({ 
        related_type: 'tra_hang_nhap',
        related_id: response.body.return._id
      });
      expect(cashbookEntries.length).toBe(2);

      // Check individual payment entries
      const tienMatEntry = cashbookEntries.find(entry => entry.source === 'tien_mat');
      const theEntry = cashbookEntries.find(entry => entry.source === 'the');

      expect(tienMatEntry).toBeDefined();
      expect(tienMatEntry.amount).toBe(10000000);
      expect(tienMatEntry.type).toBe('thu');

      expect(theEntry).toBeDefined();
      expect(theEntry.amount).toBe(10000000);
      expect(theEntry.type).toBe('thu');
    });
  });

  describe('Multi-payment Return Export', () => {
    it('should create return export with multi-payment', async () => {
      const returnData = {
        export_id: 'export-123',
        return_amount: 15000000,
        return_reason: 'Customer return',
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

      // Check if cashbook entries were created
      const cashbookEntries = await Cashbook.find({ 
        related_type: 'tra_hang_ban',
        related_id: response.body.return._id
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
  });

  describe('Payment Validation', () => {
    it('should validate payment source enum values', async () => {
      const purchaseData = {
        imei: '333333333333333',
        product_name: 'iPhone 15',
        sku: 'IPH15INVALID',
        price_import: 20000000,
        quantity: 1,
        branch: 'Test Branch',
        category: 'iPhone',
        supplier: 'Apple Store',
        payments: [
          { source: 'invalid_source', amount: 20000000 }
        ]
      };

      const response = await request(app)
        .post('/api/nhap-hang')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(purchaseData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
    });

    it('should validate payment amounts are positive', async () => {
      const purchaseData = {
        imei: '444444444444444',
        product_name: 'iPhone 15',
        sku: 'IPH15NEGATIVE',
        price_import: 20000000,
        quantity: 1,
        branch: 'Test Branch',
        category: 'iPhone',
        supplier: 'Apple Store',
        payments: [
          { source: 'tien_mat', amount: -10000000 }
        ]
      };

      const response = await request(app)
        .post('/api/nhap-hang')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(purchaseData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
    });
  });
});
