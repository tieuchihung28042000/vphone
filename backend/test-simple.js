import request from 'supertest';
import app from './test-app.js';
import User from './models/User.js';
import Branch from './models/Branch.js';

async function testSimple() {
  try {
    // Create test branch
    const testBranch = await Branch.create({
      name: `Test Branch ${Date.now()}`,
      address: 'Test Address',
      phone: '0123456789'
    });

    // Create test user
    const adminUser = await User.create({
      email: `admin${Date.now()}@test.com`,
      password: '$2b$10$test.hash',
      role: 'admin',
      full_name: 'Admin User',
      phone: '0123456789',
      approved: true,
      branch_id: testBranch._id,
      branch_name: `Test Branch ${Date.now()}`
    });

    console.log('Created user:', adminUser.email);

    // Test login
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: adminUser.email, password: '123456' });

    console.log('Login response status:', loginResponse.status);
    console.log('Login response body:', loginResponse.body);

    if (loginResponse.status === 200 && loginResponse.body.token) {
      console.log('Token created successfully');
      
      // Test protected route
      const protectedResponse = await request(app)
        .get('/api/cashbook')
        .set('Authorization', `Bearer ${loginResponse.body.token}`);
      
      console.log('Protected route status:', protectedResponse.status);
      console.log('Protected route body:', protectedResponse.body);
    } else {
      console.log('Login failed');
    }

  } catch (error) {
    console.error('Test error:', error);
  }
}

testSimple();
