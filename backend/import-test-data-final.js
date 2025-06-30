const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Connection string
const MONGODB_URI = 'mongodb://vphone_admin:vphone_secure_2024@103.109.187.224:27017/test?authSource=admin';

// Import models
const Admin = require('./models/Admin');
const User = require('./models/User');
const Branch = require('./models/Branch');
const Category = require('./models/Category');
const Inventory = require('./models/Inventory');
const Cashbook = require('./models/Cashbook');

async function importTestData() {
  try {
    console.log('🚀 Bắt đầu import dữ liệu test...');
    console.log('🔗 Kết nối:', MONGODB_URI.replace(/:[^:@]*@/, ':***@'));
    
    // Kết nối database
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Kết nối database test thành công');

    // Xóa dữ liệu cũ
    console.log('🗑️ Xóa dữ liệu cũ...');
    await Promise.all([
      Admin.deleteMany({}),
      User.deleteMany({}),
      Branch.deleteMany({}),
      Category.deleteMany({}),
      Inventory.deleteMany({}),
      Cashbook.deleteMany({})
    ]);
    console.log('✅ Đã xóa dữ liệu cũ');

    // 1. Tạo Admin accounts
    console.log('👤 Tạo tài khoản Admin...');
    const adminData = [
      {
        username: 'admin',
        email: 'admin@test.vphone.vn',
        password: await bcrypt.hash('123456', 10),
        role: 'admin',
        isApproved: true
      },
      {
        username: 'superadmin',
        email: 'superadmin@test.vphone.vn',
        password: await bcrypt.hash('super123', 10),
        role: 'admin',
        isApproved: true
      }
    ];
    
    const admins = await Admin.insertMany(adminData);
    console.log(`✅ Đã tạo ${admins.length} tài khoản admin`);

    // 2. Tạo User accounts
    console.log('👥 Tạo tài khoản User...');
    const userData = [
      {
        username: 'testuser',
        email: 'user@test.vphone.vn',
        password: await bcrypt.hash('user123', 10),
        role: 'user',
        isApproved: true
      },
      {
        username: 'saleuser',
        email: 'sale@test.vphone.vn',
        password: await bcrypt.hash('sale123', 10),
        role: 'user',
        isApproved: true
      }
    ];
    
    const users = await User.insertMany(userData);
    console.log(`✅ Đã tạo ${users.length} tài khoản user`);

    // 3. Tạo Chi nhánh - CHỈ CÓ NAME
    console.log('🏢 Tạo chi nhánh...');
    const branchData = [
      { name: 'VPhone Test Quận 1' },
      { name: 'VPhone Test Quận 3' },
      { name: 'VPhone Test Hà Nội' }
    ];
    
    const branches = await Branch.insertMany(branchData);
    console.log(`✅ Đã tạo ${branches.length} chi nhánh`);

    // 4. Tạo Danh mục sản phẩm - CHỈ CÓ NAME
    console.log('📱 Tạo danh mục sản phẩm...');
    const categoryData = [
      { name: 'iPhone 15 Series' },
      { name: 'iPhone 14 Series' },
      { name: 'MacBook' },
      { name: 'iPad' },
      { name: 'Apple Watch' },
      { name: 'Phụ kiện' }
    ];
    
    const categories = await Category.insertMany(categoryData);
    console.log(`✅ Đã tạo ${categories.length} danh mục`);

    // 5. Tạo Inventory (Kho hàng)
    console.log('📦 Tạo dữ liệu kho hàng...');
    const currentTime = Date.now();
    const inventoryData = [
      // iPhone 15 Pro Max - TRONG KHO
      {
        imei: `TEST${currentTime}001`,
        sku: 'IP15PM-256-NT',
        product_name: 'iPhone 15 Pro Max 256GB Natural Titanium',
        tenSanPham: 'iPhone 15 Pro Max 256GB Natural Titanium',
        price_import: 28000000,
        price_sell: 32000000,
        import_date: new Date(),
        supplier: 'Apple Authorized Distributor',
        branch: branches[0].name, // SỬA: Dùng name thay vì _id
        category: categories[0].name,
        quantity: 1,
        status: 'in_stock',
        note: 'Hàng chính hãng VN/A',
        da_thanh_toan_nhap: 28000000
      },
      // iPhone 15 Pro Max - ĐÃ BÁN
      {
        imei: `TEST${currentTime}002`,
        sku: 'IP15PM-512-BT',
        product_name: 'iPhone 15 Pro Max 512GB Blue Titanium',
        tenSanPham: 'iPhone 15 Pro Max 512GB Blue Titanium',
        price_import: 35000000,
        price_sell: 39000000,
        import_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        sold_date: new Date(),
        supplier: 'Apple Authorized Distributor',
        branch: branches[0].name,
        category: categories[0].name,
        quantity: 1,
        status: 'sold',
        customer_name: 'Nguyễn Văn A',
        customer_phone: '0987654321',
        note: 'Đã bán cho khách VIP',
        da_thanh_toan_nhap: 35000000
      },
      // iPhone 15 Pro - TRONG KHO
      {
        imei: `TEST${currentTime}003`,
        sku: 'IP15P-128-BT',
        product_name: 'iPhone 15 Pro 128GB Blue Titanium',
        tenSanPham: 'iPhone 15 Pro 128GB Blue Titanium',
        price_import: 25000000,
        price_sell: 29000000,
        import_date: new Date(),
        supplier: 'Apple Authorized Distributor',
        branch: branches[1].name,
        category: categories[0].name,
        quantity: 1,
        status: 'in_stock',
        note: 'Hàng mới về',
        da_thanh_toan_nhap: 25000000
      },
      // iPhone 15 - TRONG KHO
      {
        imei: `TEST${currentTime}004`,
        sku: 'IP15-128-PK',
        product_name: 'iPhone 15 128GB Pink',
        tenSanPham: 'iPhone 15 128GB Pink',
        price_import: 20000000,
        price_sell: 24000000,
        import_date: new Date(),
        supplier: 'Apple Authorized Distributor',
        branch: branches[2].name,
        category: categories[0].name,
        quantity: 1,
        status: 'in_stock',
        note: 'Màu hồng hot với nữ',
        da_thanh_toan_nhap: 20000000
      },
      // MacBook - ĐÃ BÁN
      {
        imei: `TEST${currentTime}005`,
        sku: 'MBA-M3-15-256',
        product_name: 'MacBook Air M3 15inch 256GB Space Gray',
        tenSanPham: 'MacBook Air M3 15inch 256GB Space Gray',
        price_import: 30000000,
        price_sell: 35000000,
        import_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        sold_date: new Date(),
        supplier: 'Apple Authorized Distributor',
        branch: branches[0].name,
        category: categories[2].name,
        quantity: 1,
        status: 'sold',
        customer_name: 'Công ty ABC',
        customer_phone: '0901111111',
        note: 'Bán cho doanh nghiệp',
        da_thanh_toan_nhap: 30000000
      },
      // iPad - TRONG KHO
      {
        imei: `TEST${currentTime}006`,
        sku: 'IPP-M2-129-256',
        product_name: 'iPad Pro 12.9 M2 256GB WiFi Space Gray',
        tenSanPham: 'iPad Pro 12.9 M2 256GB WiFi Space Gray',
        price_import: 22000000,
        price_sell: 26000000,
        import_date: new Date(),
        supplier: 'Apple Authorized Distributor',
        branch: branches[1].name,
        category: categories[3].name,
        quantity: 1,
        status: 'in_stock',
        note: 'Phù hợp cho designer',
        da_thanh_toan_nhap: 22000000
      }
    ];
    
    const inventory = await Inventory.insertMany(inventoryData);
    console.log(`✅ Đã tạo ${inventory.length} sản phẩm trong kho`);

    // 6. Tạo Cashbook (Sổ quỹ) - SỬA THEO ĐÚNG SCHEMA
    console.log('💰 Tạo dữ liệu sổ quỹ...');
    const cashbookData = [
      {
        type: 'thu',
        amount: 39000000,
        content: 'Bán iPhone 15 Pro Max 512GB Blue Titanium', // SỬA: description -> content
        category: 'ban_hang',
        source: 'tien_mat',
        branch: branches[0].name, // SỬA: Thêm branch required
        related_type: 'ban_hang',
        customer: 'Nguyễn Văn A',
        date: new Date()
      },
      {
        type: 'chi',
        amount: 35000000,
        content: 'Nhập iPhone 15 Pro Max 512GB Blue Titanium',
        category: 'nhap_hang',
        source: 'tien_mat',
        branch: branches[0].name,
        related_type: 'nhap_hang',
        supplier: 'Apple Authorized Distributor',
        date: new Date()
      },
      {
        type: 'thu',
        amount: 35000000,
        content: 'Bán MacBook Air M3 15inch cho công ty',
        category: 'ban_hang',
        source: 'chuyen_khoan',
        branch: branches[0].name,
        related_type: 'ban_hang',
        customer: 'Công ty ABC',
        date: new Date()
      },
      {
        type: 'chi',
        amount: 30000000,
        content: 'Nhập MacBook Air M3 15inch',
        category: 'nhap_hang',
        source: 'chuyen_khoan',
        branch: branches[0].name,
        related_type: 'nhap_hang',
        supplier: 'Apple Authorized Distributor',
        date: new Date()
      },
      {
        type: 'chi',
        amount: 2000000,
        content: 'Chi phí vận chuyển hàng từ HN về HCM',
        category: 'van_chuyen',
        source: 'tien_mat',
        branch: branches[0].name,
        related_type: 'manual',
        date: new Date()
      }
    ];
    
    const cashbook = await Cashbook.insertMany(cashbookData);
    console.log(`✅ Đã tạo ${cashbook.length} giao dịch sổ quỹ`);

    // Thống kê tổng kết
    console.log('\n🎉 IMPORT DỮ LIỆU TEST THÀNH CÔNG!');
    console.log('📊 Tổng kết dữ liệu đã import:');
    console.log(`   👤 Admin: ${admins.length} tài khoản`);
    console.log(`   👥 User: ${users.length} tài khoản`);
    console.log(`   🏢 Chi nhánh: ${branches.length} chi nhánh`);
    console.log(`   📱 Danh mục: ${categories.length} danh mục`);
    console.log(`   📦 Kho hàng: ${inventory.length} sản phẩm`);
    console.log(`       - Còn hàng: ${inventory.filter(i => i.status === 'in_stock').length}`);
    console.log(`       - Đã bán: ${inventory.filter(i => i.status === 'sold').length}`);
    console.log(`   💰 Sổ quỹ: ${cashbook.length} giao dịch`);
    console.log(`       - Thu: ${cashbook.filter(c => c.type === 'thu').length} giao dịch`);
    console.log(`       - Chi: ${cashbook.filter(c => c.type === 'chi').length} giao dịch`);
    
    console.log('\n🔑 Thông tin đăng nhập:');
    console.log('   👑 Admin: admin / admin123');
    console.log('   👑 Super Admin: superadmin / super123');
    console.log('   👤 User: testuser / user123');
    console.log('   👤 Sale User: saleuser / sale123');
    
    console.log('\n🔗 Database Connection:');
    console.log('   mongodb://vphone_admin:***@103.109.187.224:27017/test?authSource=admin');
    
    console.log('\n📋 Chi tiết sản phẩm:');
    inventory.forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.product_name} - ${item.status === 'in_stock' ? '✅ Còn hàng' : '❌ Đã bán'}`);
    });

  } catch (error) {
    console.error('❌ Lỗi import dữ liệu:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Đã ngắt kết nối database');
    process.exit(0);
  }
}

// Chạy import
console.log('🚀 Bắt đầu import dữ liệu test environment (FINAL VERSION)');
console.log('📅 Thời gian:', new Date().toLocaleString('vi-VN'));
importTestData(); 