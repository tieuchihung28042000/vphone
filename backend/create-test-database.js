const mongoose = require('mongoose');

// Connection strings
const ADMIN_URI = 'mongodb://vphone_admin:vphone_secure_2024@103.109.187.224:27017/admin?authSource=admin';
const TEST_URI = 'mongodb://vphone_admin:vphone_secure_2024@103.109.187.224:27017/test?authSource=admin';

async function createTestDatabase() {
  let adminConnection = null;
  let testConnection = null;

  try {
    console.log('🔄 Bắt đầu tạo database test...');

    // 1. Kết nối với database admin để cấp quyền
    console.log('📡 Kết nối với admin database...');
    adminConnection = await mongoose.createConnection(ADMIN_URI);
    console.log('✅ Kết nối admin database thành công');

    // 2. Cấp quyền readWrite cho database test
    console.log('🔐 Cấp quyền cho user vphone_admin...');
    const adminDb = adminConnection.db;
    
    try {
      await adminDb.command({
        grantRolesToUser: "vphone_admin",
        roles: [
          { role: "readWrite", db: "test" },
          { role: "dbAdmin", db: "test" }
        ]
      });
      console.log('✅ Đã cấp quyền readWrite và dbAdmin cho database test');
    } catch (error) {
      if (error.message.includes('Role already exists')) {
        console.log('⚠️ Quyền đã tồn tại, bỏ qua...');
      } else {
        console.log('⚠️ Lỗi cấp quyền:', error.message);
      }
    }

    // 3. Kết nối với database test để tạo collections
    console.log('📡 Kết nối với test database...');
    testConnection = await mongoose.createConnection(TEST_URI);
    console.log('✅ Kết nối test database thành công');

    // 4. Tạo các collections cơ bản
    const testDb = testConnection.db;
    
    const collections = [
      'admins',
      'users', 
      'branches',
      'categories',
      'inventories',
      'exporthistories',
      'cashbooks',
      'debts',
      'supplierDebts',
      'congNoLogs'
    ];

    console.log('📋 Tạo collections...');
    for (const collectionName of collections) {
      try {
        await testDb.createCollection(collectionName);
        console.log(`✅ Tạo collection '${collectionName}' thành công`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`⚠️ Collection '${collectionName}' đã tồn tại`);
        } else {
          console.log(`❌ Lỗi tạo collection '${collectionName}':`, error.message);
        }
      }
    }

    // 5. Tạo indexes cơ bản
    console.log('🔍 Tạo indexes...');
    
    // Index cho admins
    await testDb.collection('admins').createIndex({ username: 1 }, { unique: true });
    await testDb.collection('admins').createIndex({ email: 1 }, { unique: true });
    
    // Index cho users
    await testDb.collection('users').createIndex({ username: 1 }, { unique: true });
    await testDb.collection('users').createIndex({ email: 1 }, { unique: true });
    
    // Index cho inventories
    await testDb.collection('inventories').createIndex({ imei: 1 }, { unique: true });
    await testDb.collection('inventories').createIndex({ sku: 1 });
    await testDb.collection('inventories').createIndex({ status: 1 });
    
    console.log('✅ Tạo indexes thành công');

    // 6. Test kết nối
    console.log('🧪 Test kết nối database test...');
    const collections_list = await testDb.listCollections().toArray();
    console.log('📊 Danh sách collections trong database test:');
    collections_list.forEach(col => {
      console.log(`   - ${col.name}`);
    });

    console.log('\n🎉 TẠO DATABASE TEST THÀNH CÔNG!');
    console.log('📋 Thông tin database:');
    console.log('   Database: test');
    console.log('   User: vphone_admin');
    console.log('   Quyền: readWrite, dbAdmin');
    console.log(`   Collections: ${collections_list.length} collections`);
    console.log('\n🔗 Connection string:');
    console.log('   mongodb://vphone_admin:vphone_secure_2024@103.109.187.224:27017/test?authSource=admin');

  } catch (error) {
    console.error('❌ Lỗi tạo database test:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    // Đóng kết nối
    if (adminConnection) {
      await adminConnection.close();
      console.log('🔌 Đã đóng kết nối admin database');
    }
    if (testConnection) {
      await testConnection.close();
      console.log('🔌 Đã đóng kết nối test database');
    }
    
    console.log('✅ Hoàn tất!');
    process.exit(0);
  }
}

// Chạy script
console.log('🚀 Script tạo database test');
console.log('📅 Thời gian:', new Date().toLocaleString());
createTestDatabase(); 