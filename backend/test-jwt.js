import jwt from 'jsonwebtoken';

async function testJWT() {
  try {
    console.log('Testing JWT...');

    // Test JWT creation
    const payload = { id: '507f1f77bcf86cd799439011', email: 'test@example.com' };
    const token = jwt.sign(payload, 'vphone_secret_key', { expiresIn: '1h' });
    console.log('Created token:', token.substring(0, 50) + '...');

    // Test JWT verification
    const decoded = jwt.verify(token, 'vphone_secret_key');
    console.log('Decoded token:', decoded);

    console.log('JWT test completed successfully');

  } catch (error) {
    console.error('JWT test error:', error);
  }
}

testJWT();
