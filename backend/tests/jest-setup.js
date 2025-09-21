// Jest setup for backend tests
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from root .env
dotenv.config({ path: path.join(process.cwd(), '..', '.env') });

// Set MONGODB_URI if not already set
if (!process.env.MONGODB_URI) {
  const mongoPort = process.env.MONGODB_PORT || '27017';
  process.env.MONGODB_URI = `mongodb://${process.env.MONGO_ROOT_USERNAME}:${process.env.MONGO_ROOT_PASSWORD}@localhost:${mongoPort}/${process.env.MONGO_DB_NAME}?authSource=admin`;
}

// Set test environment variables
process.env.NODE_ENV = 'test';

// Mock console methods to reduce noise in tests (but allow console.log for debugging)
global.console = {
  ...console,
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Global test timeout
jest.setTimeout(30000);
