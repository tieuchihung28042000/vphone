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
const Debt = require('./models/Debt');
const SupplierDebt = require('./models/SupplierDebt');

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
      Cashbook.deleteMany({}),
      Debt.deleteMany({}),
      SupplierDebt.deleteMany({})
    ]);
    console.log('✅ Đã xóa dữ liệu cũ');

    // 1. Tạo Admin accounts
    console.log('👤 Tạo tài khoản Admin...');
    const adminData = [
      {
        username: 'admin',
        email: 'admin@test.vphone.vn',
        password: await bcrypt.hash('admin123', 10),
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

    // 3. Tạo Chi nhánh
    console.log('🏢 Tạo chi nhánh...');
    const branchData = [
      {
        name: 'VPhone Test Quận 1',
        address: '123 Nguyễn Huệ, Quận 1, TP.HCM',
        phone: '0901234567',
        manager: 'Nguyễn Văn A',
        email: 'q1@test.vphone.vn'
      },
      {
        name: 'VPhone Test Quận 3',
        address: '456 Võ Văn Tần, Quận 3, TP.HCM',
        phone: '0901234568',
        manager: 'Trần Thị B',
        email: 'q3@test.vphone.vn'
      },
      {
        name: 'VPhone Test Hà Nội',
        address: '789 Hoàng Kiếm, Hà Nội',
        phone: '0901234569',
        manager: 'Lê Văn C',
        email: 'hn@test.vphone.vn'
      }
    ];
    
    const branches = await Branch.insertMany(branchData);
    console.log(`✅ Đã tạo ${branches.length} chi nhánh`);

    // 4. Tạo Danh mục sản phẩm
    console.log('📱 Tạo danh mục sản phẩm...');
    const categoryData = [
      {
        name: 'iPhone 15 Series',
        description: 'iPhone 15, 15 Plus, 15 Pro, 15 Pro Max',
        isActive: true
      },
      {
        name: 'iPhone 14 Series',
        description: 'iPhone 14, 14 Plus, 14 Pro, 14 Pro Max',
        isActive: true
      },
      {
        name: 'iPhone 13 Series',
        description: 'iPhone 13, 13 Mini, 13 Pro, 13 Pro Max',
        isActive: true
      },
      {
        name: 'MacBook',
        description: 'MacBook Air, MacBook Pro các loại',
        isActive: true
      },
      {
        name: 'iPad',
        description: 'iPad, iPad Air, iPad Pro, iPad Mini',
        isActive: true
      },
      {
        name: 'Apple Watch',
        description: 'Apple Watch Series và SE',
        isActive: true
      },
      {
        name: 'Phụ kiện',
        description: 'Ốp lưng, cáp sạc, tai nghe',
        isActive: true
      }
    ];
    
    const categories = await Category.insertMany(categoryData);
    console.log(`✅ Đã tạo ${categories.length} danh mục`);

    // 5. Tạo Inventory (Kho hàng)
    console.log('📦 Tạo dữ liệu kho hàng...');
    const currentTime = Date.now();
    const inventoryData = [
      // iPhone 15 Pro Max
      {
        imei: `TEST${currentTime}001`,
        sku: 'IP15PM-256-NT',
        product_name: 'iPhone 15 Pro Max 256GB Natural Titanium',
        tenSanPham: 'iPhone 15 Pro Max 256GB Natural Titanium',
        price_import: 28000000,
        price_sell: 32000000,
        giaBan: 32000000,
        import_date: new Date(),
        supplier: 'Apple Authorized Distributor',
        branch: branches[0]._id,
        category: categories[0]._id,
        quantity: 1,
        status: 'available',
        note: 'Hàng chính hãng VN/A',
        da_thanh_toan_nhap: 28000000
      },
      {
        imei: `TEST${currentTime}002`,
        sku: 'IP15PM-512-BT',
        product_name: 'iPhone 15 Pro Max 512GB Blue Titanium',
        tenSanPham: 'iPhone 15 Pro Max 512GB Blue Titanium',
        price_import: 35000000,
        price_sell: 39000000,
        giaBan: 39000000,
        import_date: new Date(),
        supplier: 'Apple Authorized Distributor',
        branch: branches[0]._id,
        category: categories[0]._id,
        quantity: 1,
        status: 'sold',
        note: 'Đã bán cho khách VIP',
        da_thanh_toan_nhap: 35000000
      },
      // iPhone 15 Pro
      {
        imei: `TEST${currentTime}003`,
        sku: 'IP15P-128-BT',
        product_name: 'iPhone 15 Pro 128GB Blue Titanium',
        tenSanPham: 'iPhone 15 Pro 128GB Blue Titanium',
        price_import: 25000000,
        price_sell: 29000000,
        giaBan: 29000000,
        import_date: new Date(),
        supplier: 'Apple Authorized Distributor',
        branch: branches[1]._id,
        category: categories[0]._id,
        quantity: 1,
        status: 'available',
        note: 'Hàng mới về',
        da_thanh_toan_nhap: 25000000
      },
      {
        imei: `TEST${currentTime}004`,
        sku: 'IP15P-256-WT',
        product_name: 'iPhone 15 Pro 256GB White Titanium',
        tenSanPham: 'iPhone 15 Pro 256GB White Titanium',
        price_import: 27000000,
        price_sell: 31000000,
        giaBan: 31000000,
        import_date: new Date(),
        supplier: 'Apple Authorized Distributor',
        branch: branches[1]._id,
        category: categories[0]._id,
        quantity: 1,
        status: 'available',
        note: 'Màu hot',
        da_thanh_toan_nhap: 27000000
      },
      // iPhone 15
      {
        imei: `TEST${currentTime}005`,
        sku: 'IP15-128-PK',
        product_name: 'iPhone 15 128GB Pink',
        tenSanPham: 'iPhone 15 128GB Pink',
        price_import: 20000000,
        price_sell: 24000000,
        giaBan: 24000000,
        import_date: new Date(),
        supplier: 'Apple Authorized Distributor',
        branch: branches[2]._id,
        category: categories[0]._id,
        quantity: 1,
        status: 'available',
        note: 'Màu hồng hot với nữ',
        da_thanh_toan_nhap: 20000000
      },
      // MacBook
      {
        imei: `TEST${currentTime}006`,
        sku: 'MBA-M3-15-256',
        product_name: 'MacBook Air M3 15inch 256GB Space Gray',
        tenSanPham: 'MacBook Air M3 15inch 256GB Space Gray',
        price_import: 30000000,
        price_sell: 35000000,
        giaBan: 35000000,
        import_date: new Date(),
        supplier: 'Apple Authorized Distributor',
        branch: branches[0]._id,
        category: categories[3]._id,
        quantity: 1,
        status: 'sold',
        note: 'Bán cho doanh nghiệp',
        da_thanh_toan_nhap: 30000000
      },
      // iPad
      {
        imei: `TEST${currentTime}007`,
        sku: 'IPP-M2-129-256',
        product_name: 'iPad Pro 12.9 M2 256GB WiFi Space Gray',
        tenSanPham: 'iPad Pro 12.9 M2 256GB WiFi Space Gray',
        price_import: 22000000,
        price_sell: 26000000,
        giaBan: 26000000,
        import_date: new Date(),
        supplier: 'Apple Authorized Distributor',
        branch: branches[1]._id,
        category: categories[4]._id,
        quantity: 1,
        status: 'available',
        note: 'Phù hợp cho designer',
        da_thanh_toan_nhap: 22000000
      },
      // Apple Watch
      {
        imei: `TEST${currentTime}008`,
        sku: 'AWS9-45-GPS',
        product_name: 'Apple Watch Series 9 45mm GPS Midnight',
        tenSanPham: 'Apple Watch Series 9 45mm GPS Midnight',
        price_import: 8000000,
        price_sell: 10000000,
        giaBan: 10000000,
        import_date: new Date(),
        supplier: 'Apple Authorized Distributor',
        branch: branches[2]._id,
        category: categories[5]._id,
        quantity: 1,
        status: 'available',
        note: 'Đồng hồ thông minh hot nhất',
        da_thanh_toan_nhap: 8000000
      }
    ];
    
    const inventory = await Inventory.insertMany(inventoryData);
    console.log(`✅ Đã tạo ${inventory.length} sản phẩm trong kho`);

    // 6. Tạo Cashbook (Sổ quỹ)
    console.log('💰 Tạo dữ liệu sổ quỹ...');
    const cashbookData = [
      {
        date: new Date(),
        type: 'thu',
        amount: 39000000,
        description: 'Bán iPhone 15 Pro Max 512GB Blue Titanium',
        category: 'ban_hang',
        source: 'tien_mat',
        branch: branches[0]._id,
        reference: inventory[1]._id
      },
      {
        date: new Date(),
        type: 'chi',
        amount: 35000000,
        description: 'Nhập iPhone 15 Pro Max 512GB Blue Titanium',
        category: 'nhap_hang',
        source: 'tien_mat',
        branch: branches[0]._id,
        reference: inventory[1]._id
      },
      {
        date: new Date(),
        type: 'thu',
        amount: 35000000,
        description: 'Bán MacBook Air M3 15inch cho công ty',
        category: 'ban_hang',
        source: 'chuyen_khoan',
        branch: branches[0]._id,
        reference: inventory[5]._id
      },
      {
        date: new Date(),
        type: 'chi',
        amount: 30000000,
        description: 'Nhập MacBook Air M3 15inch',
        category: 'nhap_hang',
        source: 'chuyen_khoan',
        branch: branches[0]._id,
        reference: inventory[5]._id
      },
      {
        date: new Date(),
        type: 'chi',
        amount: 2000000,
        description: 'Chi phí vận chuyển hàng từ HN về HCM',
        category: 'van_chuyen',
        source: 'tien_mat',
        branch: branches[0]._id
      },
      {
        date: new Date(),
        type: 'chi',
        amount: 5000000,
        description: 'Lương nhân viên tháng này',
        category: 'luong',
        source: 'chuyen_khoan',
        branch: branches[0]._id
      }
    ];
    
    const cashbook = await Cashbook.insertMany(cashbookData);
    console.log(`✅ Đã tạo ${cashbook.length} giao dịch sổ quỹ`);

    // 7. Tạo Debt (Công nợ khách hàng)
    console.log('📋 Tạo dữ liệu công nợ khách hàng...');
    const debtData = [
      {
        customerName: 'Nguyễn Văn Khách',
        customerPhone: '0987654321',
        customerEmail: 'khach@gmail.com',
        totalAmount: 32000000,
        paidAmount: 20000000,
        remainingAmount: 12000000,
        description: 'Mua iPhone 15 Pro Max trả góp',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 ngày
        status: 'pending',
        branch: branches[0]._id,
        createdBy: users[0]._id
      },
      {
        customerName: 'Trần Thị Mua',
        customerPhone: '0987654322',
        customerEmail: 'mua@gmail.com',
        totalAmount: 26000000,
        paidAmount: 26000000,
        remainingAmount: 0,
        description: 'Mua iPad Pro đã thanh toán đủ',
        dueDate: new Date(),
        status: 'paid',
        branch: branches[1]._id,
        createdBy: users[1]._id
      }
    ];
    
    const debts = await Debt.insertMany(debtData);
    console.log(`✅ Đã tạo ${debts.length} công nợ khách hàng`);

    // 8. Tạo SupplierDebt (Công nợ nhà cung cấp)
    console.log('🏭 Tạo dữ liệu công nợ nhà cung cấp...');
    const supplierDebtData = [
      {
        supplierName: 'Apple Authorized Distributor',
        supplierPhone: '0901111111',
        supplierEmail: 'contact@appledist.vn',
        totalAmount: 150000000,
        paidAmount: 100000000,
        remainingAmount: 50000000,
        description: 'Nhập lô hàng iPhone 15 series',
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 ngày
        status: 'pending',
        branch: branches[0]._id,
        createdBy: admins[0]._id
      },
      {
        supplierName: 'Phụ Kiện Việt Nam',
        supplierPhone: '0902222222',
        supplierEmail: 'info@phukienvn.com',
        totalAmount: 5000000,
        paidAmount: 5000000,
        remainingAmount: 0,
        description: 'Nhập ốp lưng và cáp sạc',
        dueDate: new Date(),
        status: 'paid',
        branch: branches[1]._id,
        createdBy: admins[1]._id
      }
    ];
    
    const supplierDebts = await SupplierDebt.insertMany(supplierDebtData);
    console.log(`✅ Đã tạo ${supplierDebts.length} công nợ nhà cung cấp`);

    // Thống kê tổng kết
    console.log('\n🎉 IMPORT DỮ LIỆU TEST THÀNH CÔNG!');
    console.log('📊 Tổng kết dữ liệu đã import:');
    console.log(`   👤 Admin: ${admins.length} tài khoản`);
    console.log(`   👥 User: ${users.length} tài khoản`);
    console.log(`   🏢 Chi nhánh: ${branches.length} chi nhánh`);
    console.log(`   📱 Danh mục: ${categories.length} danh mục`);
    console.log(`   📦 Kho hàng: ${inventory.length} sản phẩm`);
    console.log(`   💰 Sổ quỹ: ${cashbook.length} giao dịch`);
    console.log(`   📋 Công nợ KH: ${debts.length} khoản`);
    console.log(`   🏭 Công nợ NCC: ${supplierDebts.length} khoản`);
    
    console.log('\n🔑 Thông tin đăng nhập:');
    console.log('   👑 Admin: admin / admin123');
    console.log('   👑 Super Admin: superadmin / super123');
    console.log('   👤 User: testuser / user123');
    console.log('   👤 Sale User: saleuser / sale123');
    
    console.log('\n🔗 Database Connection:');
    console.log('   mongodb://vphone_admin:***@103.109.187.224:27017/test?authSource=admin');

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
console.log('🚀 Bắt đầu import dữ liệu test environment');
console.log('📅 Thời gian:', new Date().toLocaleString('vi-VN'));
importTestData(); 