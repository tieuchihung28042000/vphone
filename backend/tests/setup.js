// Test setup for backend
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from root .env
dotenv.config({ path: path.join(process.cwd(), '.env') });

// Set MONGODB_URI if not already set
if (!process.env.MONGODB_URI) {
  const mongoPort = process.env.MONGODB_PORT || '27017';
  process.env.MONGODB_URI = `mongodb://${process.env.MONGO_ROOT_USERNAME}:${process.env.MONGO_ROOT_PASSWORD}@localhost:${mongoPort}/${process.env.MONGO_DB_NAME}?authSource=admin`;
}

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Setup test database
beforeAll(async () => {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI not found in environment variables');
  }
  await mongoose.connect(mongoUri);
});

// Clean up after each test
afterEach(async () => {
  // Only clear collections if we're not in a test suite that needs persistent data
  if (process.env.CLEAR_DB !== 'false') {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
      await collection.dropIndexes();
    }
  }
});

// Clean up after each test suite
afterAll(async () => {
  // Only clear database if not in auth test suite
  if (process.env.CLEAR_DB !== 'false') {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
      await collection.dropIndexes();
    }
  }
});

// Close database connection after all tests
afterAll(async () => {
  await mongoose.connection.close();
});
