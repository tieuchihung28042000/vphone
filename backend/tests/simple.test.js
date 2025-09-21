import request from 'supertest';
import app from '../test-jest.js';

describe('Simple Test', () => {
  it('should return test message', async () => {
    const response = await request(app)
      .get('/test')
      .expect(200);

    expect(response.body.message).toBe('Test successful');
  });

  it('should handle POST request', async () => {
    const response = await request(app)
      .post('/test')
      .send({ test: 'data' })
      .expect(200);

    expect(response.body.message).toBe('POST test successful');
    expect(response.body.data.test).toBe('data');
  });
});
