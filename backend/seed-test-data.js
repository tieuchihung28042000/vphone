const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Import models
const Admin = require('./models/Admin');
const User = require('./models/User');
const Branch = require('./models/Branch');
const Category = require('./models/Category');
const Inventory = require('./models/Inventory');
const Cashbook = require('./models/Cashbook');

const TEST_URI = 'mongodb://vphone_admin:vphone_secure_2024@103.109.187.224:27017/test?authSource=admin';

async function seedTestData() {
  try {
    console.log('🌱 Bắt đầu seed dữ liệu test...');
    
    await mongoose.connect(TEST_URI);
    console.log('✅ Kết nối database thành công');

    // Xóa dữ liệu cũ
    await Admin.deleteMany({});
    await User.deleteMany({});
    await Branch.deleteMany({});
    await Category.deleteMany({});
    await Inventory.deleteMany({});
    await Cashbook.deleteMany({});
    console.log('🗑️ Đã xóa dữ liệu cũ');

    // Tạo Admin
    const admin = new Admin({
      username: 'admin',
      email: 'admin@test.vphone.vn',
      password: await bcrypt.hash('admin123', 10),
      role: 'admin',
      isApproved: true
    });
    await admin.save();
    console.log('👤 Đã tạo admin: admin/admin123');

    // Tạo User
    const user = new User({
      username: 'testuser',
      email: 'user@test.vphone.vn',
      password: await bcrypt.hash('user123', 10),
      role: 'user',
      isApproved: true
    });
    await user.save();
    console.log('👤 Đã tạo user: testuser/user123');

    // Tạo Chi nhánh
    const branches = await Branch.insertMany([
      { name: 'Chi nhánh Test 1', address: '123 Test Street, HCM', phone: '0901234567' },
      { name: 'Chi nhánh Test 2', address: '456 Test Avenue, HN', phone: '0901234568' }
    ]);
    console.log('🏢 Đã tạo chi nhánh:', branches.length);

    // Tạo Danh mục
    const categories = await Category.insertMany([
      { name: 'iPhone 15 Pro Max', description: 'iPhone 15 Pro Max các dung lượng' },
      { name: 'iPhone 15 Pro', description: 'iPhone 15 Pro các dung lượng' },
      { name: 'iPhone 15', description: 'iPhone 15 các dung lượng' },
      { name: 'MacBook', description: 'MacBook các loại' }
    ]);
    console.log('📱 Đã tạo danh mục:', categories.length);

    // Tạo Inventory mẫu
    const products = [
      { name: 'iPhone 15 Pro Max 256GB Natural Titanium', price_import: 28000000, price_sell: 32000000 },
      { name: 'iPhone 15 Pro 128GB Blue Titanium', price_import: 25000000, price_sell: 29000000 },
      { name: 'iPhone 15 256GB Pink', price_import: 20000000, price_sell: 24000000 },
      { name: 'MacBook Air M3 15inch 256GB', price_import: 30000000, price_sell: 35000000 }
    ];

    const inventoryData = products.map((product, i) => ({
      imei: `TEST${Date.now()}${i.toString().padStart(3, '0')}`,
      sku: `SKU-TEST-${i + 1}`,
      product_name: product.name,
      tenSanPham: product.name,
      price_import: product.price_import,
      price_sell: product.price_sell,
      giaBan: product.price_sell,
      import_date: new Date(),
      supplier: 'Nhà cung cấp Test',
      branch: branches[i % 2]._id,
      category: categories[i % categories.length]._id,
      quantity: 1,
      status: i < 2 ? 'available' : 'sold',
      note: `Sản phẩm test số ${i + 1}`,
      da_thanh_toan_nhap: product.price_import
    }));

    await Inventory.insertMany(inventoryData);
    console.log('📦 Đã tạo inventory:', inventoryData.length);

    // Tạo Cashbook mẫu
    const cashbookData = [
      {
        date: new Date(),
        type: 'thu',
        amount: 32000000,
        description: 'Bán iPhone 15 Pro Max Test',
        category: 'ban_hang',
        source: 'tien_mat'
      },
      {
        date: new Date(),
        type: 'chi',
        amount: 28000000,
        description: 'Nhập iPhone 15 Pro Max Test',
        category: 'nhap_hang',
        source: 'tien_mat'
      }
    ];

    await Cashbook.insertMany(cashbookData);
    console.log('💰 Đã tạo cashbook:', cashbookData.length);

    console.log('\n🎉 SEED DỮ LIỆU THÀNH CÔNG!');
    console.log('📋 Thông tin đăng nhập:');
    console.log('   Admin: admin / admin123');
    console.log('   User:  testuser / user123');
    console.log('📊 Dữ liệu đã tạo:');
    console.log(`   - ${branches.length} chi nhánh`);
    console.log(`   - ${categories.length} danh mục`);
    console.log(`   - ${inventoryData.length} sản phẩm`);
    console.log(`   - ${cashbookData.length} giao dịch sổ quỹ`);

  } catch (error) {
    console.error('❌ Lỗi seed data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Đã ngắt kết nối database');
    process.exit(0);
  }
}

console.log('🚀 Script seed dữ liệu test');
console.log('📅 Thời gian:', new Date().toLocaleString());
seedTestData(); 