const { MongoClient } = require('mongodb');

async function createTestDatabase() {
  const adminUri = 'mongodb://vphone_admin:vphone_secure_2024@103.109.187.224:27017/admin?authSource=admin';
  const testUri = 'mongodb://vphone_admin:vphone_secure_2024@103.109.187.224:27017/test?authSource=admin';
  
  let adminClient = null;
  let testClient = null;

  try {
    console.log('🔄 Tạo database test...');

    // 1. Kết nối admin để cấp quyền
    adminClient = new MongoClient(adminUri);
    await adminClient.connect();
    console.log('✅ Kết nối admin thành công');

    const adminDb = adminClient.db('admin');
    
    // 2. Cấp quyền cho user
    try {
      await adminDb.command({
        grantRolesToUser: "vphone_admin",
        roles: [
          { role: "readWrite", db: "test" },
          { role: "dbAdmin", db: "test" }
        ]
      });
      console.log('✅ Đã cấp quyền cho database test');
    } catch (error) {
      console.log('⚠️ Quyền có thể đã tồn tại:', error.message);
    }

    // 3. Kết nối test database để tạo collection
    testClient = new MongoClient(testUri);
    await testClient.connect();
    console.log('✅ Kết nối test database thành công');

    const testDb = testClient.db('test');
    
    // 4. Tạo một collection để khởi tạo database
    await testDb.createCollection('init');
    await testDb.collection('init').insertOne({ created: new Date() });
    console.log('✅ Đã khởi tạo database test');

    // 5. Test query
    const collections = await testDb.listCollections().toArray();
    console.log('📊 Collections:', collections.map(c => c.name));

    console.log('\n🎉 TẠO DATABASE TEST THÀNH CÔNG!');

  } catch (error) {
    console.error('❌ Lỗi:', error);
  } finally {
    if (adminClient) await adminClient.close();
    if (testClient) await testClient.close();
    process.exit(0);
  }
}

createTestDatabase();