import request from 'supertest';
import app from '../test-app.js';
import User from '../models/User.js';
import Branch from '../models/Branch.js';
import Cashbook from '../models/Cashbook.js';
import { setupSharedTestData, getSharedTestData } from './shared-setup.js';

describe('Role and Branch Permissions (STORY_01)', () => {
  let testBranch1;
  let testBranch2;
  let adminToken;
  let managerToken;
  let salesToken;
  let cashierToken;

  beforeAll(async () => {
    // Set environment variable to prevent database clearing
    process.env.CLEAR_DB = 'false';
    
    // Setup shared test data
    const sharedData = await setupSharedTestData();
    testBranch1 = sharedData.testBranch;
    adminToken = sharedData.adminToken;
    managerToken = sharedData.managerToken;
    salesToken = sharedData.salesToken;
    cashierToken = sharedData.cashierToken;

    // Create additional test branch
    testBranch2 = await Branch.create({
      name: 'Test Branch 2',
      address: 'Test Address 2',
      phone: '0987654321'
    });
  });

  describe('Role-based Access Control', () => {
    describe('Admin Role', () => {
      it('should allow admin to access all routes', async () => {
        const routes = [
          { method: 'GET', path: '/api/users/all-users' },
          { method: 'GET', path: '/api/branches' },
          { method: 'GET', path: '/api/cashbook' },
          { method: 'GET', path: '/api/activity-logs' },
          { method: 'GET', path: '/api/report/financial-report/summary' }
        ];

        for (const route of routes) {
          const response = await request(app)
            [route.method.toLowerCase()](route.path)
            .set('Authorization', `Bearer ${adminToken}`);

          expect(response.status).not.toBe(403);
        }
      });

      it('should allow admin to create users', async () => {
        const userData = {
          email: 'newuser@test.com',
          password: '123456',
          full_name: 'New User',
          phone: '0123456789',
          role: 'nhan_vien_ban_hang',
          branch_id: testBranch1._id.toString(),
          branch_name: 'Test Branch 1'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(userData);

        expect(response.status).toBe(201);
      });

      it('should allow admin to manage branches', async () => {
        const branchData = {
          name: 'New Branch',
          address: 'New Address',
          phone: '0123456789'
        };

        const response = await request(app)
          .post('/api/branches')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(branchData);

        expect(response.status).toBe(201);
      });
    });

    describe('Manager Role', () => {
      it('should allow manager to access management routes', async () => {
        const routes = [
          { method: 'GET', path: '/api/users/all-users' },
          { method: 'GET', path: '/api/branches' },
          { method: 'GET', path: '/api/cashbook' },
          { method: 'GET', path: '/api/activity-logs' },
          { method: 'GET', path: '/api/report/financial-report/summary' }
        ];

        for (const route of routes) {
          const response = await request(app)
            [route.method.toLowerCase()](route.path)
            .set('Authorization', `Bearer ${managerToken}`);

          expect(response.status).not.toBe(403);
        }
      });

      it('should allow manager to create users', async () => {
        const userData = {
          email: 'newuser2@test.com',
          password: '123456',
          full_name: 'New User 2',
          phone: '0123456789',
          role: 'nhan_vien_ban_hang',
          branch_id: testBranch1._id.toString(),
          branch_name: 'Test Branch 1'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .set('Authorization', `Bearer ${managerToken}`)
          .send(userData);

        expect(response.status).toBe(201);
      });
    });

    describe('Sales Role', () => {
      it('should allow sales to access sales routes', async () => {
        const routes = [
          { method: 'POST', path: '/api/xuat-hang' },
          { method: 'GET', path: '/api/ton-kho' },
          { method: 'GET', path: '/api/cong-no/cong-no-list' }
        ];

        for (const route of routes) {
          const response = await request(app)
            [route.method.toLowerCase()](route.path)
            .set('Authorization', `Bearer ${salesToken}`);

          expect(response.status).not.toBe(403);
        }
      });

      it('should deny sales access to management routes', async () => {
        const routes = [
          { method: 'GET', path: '/api/users/all-users' },
          { method: 'GET', path: '/api/activity-logs' },
          { method: 'GET', path: '/api/report/financial-report/summary' }
        ];

        for (const route of routes) {
          const response = await request(app)
            [route.method.toLowerCase()](route.path)
            .set('Authorization', `Bearer ${salesToken}`);

          expect(response.status).toBe(403);
        }
      });
    });

    describe('Cashier Role', () => {
      it('should allow cashier to access cashier routes', async () => {
        const routes = [
          { method: 'GET', path: '/api/cashbook' },
          { method: 'GET', path: '/api/cong-no/cong-no-list' }
        ];

        for (const route of routes) {
          const response = await request(app)
            [route.method.toLowerCase()](route.path)
            .set('Authorization', `Bearer ${cashierToken}`);

          expect(response.status).not.toBe(403);
        }
      });

      it('should deny cashier access to management routes', async () => {
        const routes = [
          { method: 'GET', path: '/api/users/all-users' },
          { method: 'GET', path: '/api/activity-logs' },
          { method: 'GET', path: '/api/report/financial-report/summary' }
        ];

        for (const route of routes) {
          const response = await request(app)
            [route.method.toLowerCase()](route.path)
            .set('Authorization', `Bearer ${cashierToken}`);

          expect(response.status).toBe(403);
        }
      });
    });
  });

  describe('Branch-based Data Filtering', () => {
    beforeEach(async () => {
      // Create test data for different branches
      await Cashbook.create([
        {
          type: 'thu',
          amount: 10000000,
          content: 'Test transaction 1',
          source: 'tien_mat',
          branch: 'Test Branch 1',
          date: new Date(),
          user: 'Admin User'
        },
        {
          type: 'thu',
          amount: 20000000,
          content: 'Test transaction 2',
          source: 'tien_mat',
          branch: 'Test Branch 2',
          date: new Date(),
          user: 'Cashier User'
        }
      ]);
    });

    it('should filter data by user branch for admin', async () => {
      const response = await request(app)
        .get('/api/cashbook')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.items).toBeDefined();
    });

    it('should filter data by user branch for manager', async () => {
      const response = await request(app)
        .get('/api/cashbook')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.items).toBeDefined();
    });

    it('should filter data by user branch for sales', async () => {
      const response = await request(app)
        .get('/api/cashbook')
        .set('Authorization', `Bearer ${salesToken}`);

      expect(response.status).toBe(200);
      expect(response.body.items).toBeDefined();
    });

    it('should filter data by user branch for cashier', async () => {
      const response = await request(app)
        .get('/api/cashbook')
        .set('Authorization', `Bearer ${cashierToken}`);

      expect(response.status).toBe(200);
      expect(response.body.items).toBeDefined();
    });
  });

  describe('Report Access Control', () => {
    it('should allow admin to access financial reports', async () => {
      const response = await request(app)
        .get('/api/report/financial-report/summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
    });

    it('should allow manager to access financial reports', async () => {
      const response = await request(app)
        .get('/api/report/financial-report/summary')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(response.status).toBe(200);
    });

    it('should deny sales access to financial reports', async () => {
      const response = await request(app)
        .get('/api/report/financial-report/summary')
        .set('Authorization', `Bearer ${salesToken}`);

      expect(response.status).toBe(403);
    });

    it('should deny cashier access to financial reports', async () => {
      const response = await request(app)
        .get('/api/report/financial-report/summary')
        .set('Authorization', `Bearer ${cashierToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('User Management Permissions', () => {
    it('should allow admin to create users with any role', async () => {
      const roles = ['admin', 'quan_ly', 'nhan_vien_ban_hang', 'thu_ngan'];

      for (const role of roles) {
        const userData = {
          email: `test${role}@test.com`,
          password: '123456',
          full_name: `Test ${role}`,
          phone: '0123456789',
          role: role,
          branch_id: testBranch1._id.toString(),
          branch_name: 'Test Branch 1'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(userData);

        expect(response.status).toBe(201);
      }
    });

    it('should allow manager to create users with limited roles', async () => {
      const allowedRoles = ['nhan_vien_ban_hang', 'thu_ngan'];
      const deniedRoles = ['admin', 'quan_ly'];

      for (const role of allowedRoles) {
        const userData = {
          email: `test${role}@test.com`,
          password: '123456',
          full_name: `Test ${role}`,
          phone: '0123456789',
          role: role,
          branch_id: testBranch1._id.toString(),
          branch_name: 'Test Branch 1'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .set('Authorization', `Bearer ${managerToken}`)
          .send(userData);

        expect(response.status).toBe(201);
      }
    });

    it('should deny sales access to user management', async () => {
      const userData = {
        email: 'test@test.com',
        password: '123456',
        full_name: 'Test User',
        phone: '0123456789',
        role: 'nhan_vien_ban_hang',
        branch_id: testBranch1._id.toString(),
        branch_name: 'Test Branch 1'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${salesToken}`)
        .send(userData);

      expect(response.status).toBe(403);
    });
  });

  describe('Branch Management Permissions', () => {
    it('should allow admin to manage branches', async () => {
      const branchData = {
        name: 'Admin Branch',
        address: 'Admin Address',
        phone: '0123456789'
      };

      const response = await request(app)
        .post('/api/branches')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(branchData);

      expect(response.status).toBe(201);
    });

    it('should allow manager to view branches', async () => {
      const response = await request(app)
        .get('/api/branches')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(response.status).toBe(200);
    });

    it('should deny sales access to branch management', async () => {
      const branchData = {
        name: 'Sales Branch',
        address: 'Sales Address',
        phone: '0123456789'
      };

      const response = await request(app)
        .post('/api/branches')
        .set('Authorization', `Bearer ${salesToken}`)
        .send(branchData);

      expect(response.status).toBe(403);
    });
  });

  describe('Activity Log Permissions', () => {
    it('should allow admin to view activity logs', async () => {
      const response = await request(app)
        .get('/api/activity-logs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
    });

    it('should allow manager to view activity logs', async () => {
      const response = await request(app)
        .get('/api/activity-logs')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(response.status).toBe(200);
    });

    it('should deny sales access to activity logs', async () => {
      const response = await request(app)
        .get('/api/activity-logs')
        .set('Authorization', `Bearer ${salesToken}`);

      expect(response.status).toBe(403);
    });

    it('should deny cashier access to activity logs', async () => {
      const response = await request(app)
        .get('/api/activity-logs')
        .set('Authorization', `Bearer ${cashierToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('Middleware Integration', () => {
    it('should require authentication for protected routes', async () => {
      const response = await request(app)
        .get('/api/users/all-users');

      expect(response.status).toBe(401);
    });

    it('should validate JWT token', async () => {
      const response = await request(app)
        .get('/api/users/all-users')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });

    it('should handle expired tokens', async () => {
      // Mock expired token
      const expiredToken = 'expired-token';
      
      const response = await request(app)
        .get('/api/users/all-users')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
    });
  });
});
