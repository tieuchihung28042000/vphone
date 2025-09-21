// Database setup for tests
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from root .env
dotenv.config({ path: path.join(process.cwd(), '..', '.env') });

// Set MONGODB_URI if not already set
if (!process.env.MONGODB_URI) {
  const mongoPort = process.env.MONGODB_PORT || '27017';
  process.env.MONGODB_URI = `mongodb://${process.env.MONGO_ROOT_USERNAME}:${process.env.MONGO_ROOT_PASSWORD}@localhost:${mongoPort}/${process.env.MONGO_DB_NAME}?authSource=admin`;
}

let isConnected = false;

export const connectTestDB = async () => {
  if (isConnected) {
    return;
  }

  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI not found in environment variables');
    }

    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    isConnected = true;
    console.log('✅ Test database connected');
  } catch (error) {
    console.error('❌ Test database connection failed:', error.message);
    throw error;
  }
};

export const disconnectTestDB = async () => {
  if (isConnected) {
    await mongoose.connection.close();
    isConnected = false;
    console.log('✅ Test database disconnected');
  }
};

export const clearTestDB = async () => {
  if (!isConnected) {
    return;
  }

  try {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
      await collection.dropIndexes();
    }
    console.log('✅ Test database cleared');
  } catch (error) {
    console.error('❌ Error clearing test database:', error.message);
  }
};
