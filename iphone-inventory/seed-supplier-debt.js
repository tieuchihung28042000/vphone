const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Inventory = require('./models/Inventory');

const seedSupplierDebt = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/vphone');
    console.log('✅ Connected to MongoDB');

    // Create test supplier debt data
    const supplierDebtData = [
      {
        imei: "354321098765432",
        sku: "IP14PM-256-PUR", 
        product_name: "iPhone 14 Pro Max 256GB Purple",
        price_import: 28000000,
        import_date: new Date('2024-01-15'),
        supplier: "Thế Giới Di Động",
        branch: "Dĩ An",
        note: "Nhập hàng đợt 1",
        quantity: 1,
        category: "iPhone",
        status: "in_stock",
        // Supplier debt fields
        supplier_debt: 5000000, // Còn nợ 5 triệu
        supplier_da_tra: 23000000, // Đã trả 23 triệu
        supplier_debt_history: [
          {
            type: "add",
            amount: 28000000,
            date: new Date('2024-01-15'),
            note: "Nhập hàng iPhone 14 Pro Max"
          },
          {
            type: "pay", 
            amount: 15000000,
            date: new Date('2024-01-20'),
            note: "Trả nợ đợt 1"
          },
          {
            type: "pay",
            amount: 8000000, 
            date: new Date('2024-01-25'),
            note: "Trả nợ đợt 2"
          }
        ]
      },
      {
        imei: "456789123456789",
        sku: "IP13-128-BLU",
        product_name: "iPhone 13 128GB Blue", 
        price_import: 20000000,
        import_date: new Date('2024-01-10'),
        supplier: "FPT Shop",
        branch: "Quận 9", 
        note: "Nhập hàng iPhone 13",
        quantity: 1,
        category: "iPhone",
        status: "in_stock",
        // Supplier debt fields
        supplier_debt: 20000000, // Chưa trả gì
        supplier_da_tra: 0,
        supplier_debt_history: [
          {
            type: "add",
            amount: 20000000,
            date: new Date('2024-01-10'),
            note: "Nhập hàng iPhone 13 - chưa thanh toán"
          }
        ]
      },
      {
        sku: "CASE-IP14-SIL",
        product_name: "Ốp lưng iPhone 14 Silicon",
        price_import: 50000,
        import_date: new Date('2024-01-20'),
        supplier: "Phụ Kiện Sài Gòn",
        branch: "Dĩ An",
        note: "Nhập phụ kiện",
        quantity: 20,
        category: "Phụ kiện", 
        status: "in_stock",
        // Supplier debt fields
        supplier_debt: 800000, // Còn nợ 800k
        supplier_da_tra: 200000, // Đã trả 200k
        supplier_debt_history: [
          {
            type: "add", 
            amount: 1000000,
            date: new Date('2024-01-20'),
            note: "Nhập 20 ốp lưng iPhone 14"
          },
          {
            type: "pay",
            amount: 200000,
            date: new Date('2024-01-22'),
            note: "Trả nợ một phần"
          }
        ]
      }
    ];

    // Delete existing test data
    await Inventory.deleteMany({ 
      supplier: { $in: ["Thế Giới Di Động", "FPT Shop", "Phụ Kiện Sài Gòn"] }
    });
    
    console.log('🗑️ Deleted existing test data');

    // Insert new test data
    const created = await Inventory.insertMany(supplierDebtData);
    console.log(`✅ Created ${created.length} supplier debt test records`);

    console.log('\n📊 Test Data Summary:');
    console.log('- Thế Giới Di Động: iPhone 14 Pro Max (còn nợ 5 triệu)');
    console.log('- FPT Shop: iPhone 13 (chưa trả gì, nợ 20 triệu)'); 
    console.log('- Phụ Kiện Sài Gòn: Ốp lưng (còn nợ 800k)');
    console.log('\n🎯 Bây giờ có thể test tính năng "Mình nợ nhà cung cấp"!');

  } catch (error) {
    console.error('❌ Error seeding supplier debt data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
};

// Run the seed
seedSupplierDebt(); 