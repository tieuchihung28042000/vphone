require('dotenv').config();

const mongoose = require('mongoose');
const Inventory = require('./models/Inventory');
const Category = require('./models/Category');
const Branch = require('./models/Branch');

// Mock data cho mỹ phẩm
const cosmeticsData = {
  categories: [
    { name: 'Son môi', description: 'Các loại son môi, son tint, son dưỡng' },
    { name: 'Kem dưỡng da', description: 'Kem dưỡng ẩm, kem chống nắng, serum' },
    { name: 'Phấn trang điểm', description: 'Phấn phủ, phấn má, phấn mắt' },
    { name: 'Nước hoa', description: 'Nước hoa nam, nữ, unisex' },
    { name: 'Chăm sóc tóc', description: 'Dầu gội, dầu xả, mặt nạ tóc' }
  ],
  
  branches: [
    { name: 'Quận 1', address: '123 Nguyễn Huệ, Quận 1, TP.HCM' },
    { name: 'Quận 7', address: '456 Nguyễn Thị Thập, Quận 7, TP.HCM' },
    { name: 'Thủ Đức', address: '789 Võ Văn Ngân, Thủ Đức, TP.HCM' }
  ],

  products: [
    // Son môi
    { name: 'Son Dior Rouge 999', sku: 'DIOR-999', category: 'Son môi', price: 1200000, supplier: 'Dior VN' },
    { name: 'Son YSL Rouge Pur Couture', sku: 'YSL-12', category: 'Son môi', price: 1100000, supplier: 'YSL VN' },
    { name: 'Son MAC Ruby Woo', sku: 'MAC-RW', category: 'Son môi', price: 650000, supplier: 'MAC VN' },
    { name: 'Son Chanel Rouge Coco', sku: 'CHANEL-31', category: 'Son môi', price: 1300000, supplier: 'Chanel VN' },
    { name: 'Son Tom Ford Cherry Lush', sku: 'TF-CL', category: 'Son môi', price: 1800000, supplier: 'Tom Ford VN' },
    
    // Kem dưỡng da
    { name: 'Kem dưỡng La Mer', sku: 'LM-CREAM', category: 'Kem dưỡng da', price: 4500000, supplier: 'La Mer VN' },
    { name: 'Serum Vitamin C Skinceuticals', sku: 'SC-VTC', category: 'Kem dưỡng da', price: 3200000, supplier: 'Skinceuticals VN' },
    { name: 'Kem chống nắng Shiseido', sku: 'SH-SUN', category: 'Kem dưỡng da', price: 850000, supplier: 'Shiseido VN' },
    { name: 'Kem dưỡng Olay Regenerist', sku: 'OL-REG', category: 'Kem dưỡng da', price: 450000, supplier: 'Olay VN' },
    { name: 'Serum Hyaluronic Acid', sku: 'HA-SER', category: 'Kem dưỡng da', price: 680000, supplier: 'The Ordinary VN' },
    
    // Phấn trang điểm
    { name: 'Phấn phủ Giorgio Armani', sku: 'GA-PWD', category: 'Phấn trang điểm', price: 1400000, supplier: 'Giorgio Armani VN' },
    { name: 'Phấn má Nars Orgasm', sku: 'NARS-ORG', category: 'Phấn trang điểm', price: 980000, supplier: 'Nars VN' },
    { name: 'Phấn mắt Urban Decay', sku: 'UD-EYE', category: 'Phấn trang điểm', price: 1200000, supplier: 'Urban Decay VN' },
    { name: 'Kem nền Estee Lauder', sku: 'EL-FDN', category: 'Phấn trang điểm', price: 1600000, supplier: 'Estee Lauder VN' },
    
    // Nước hoa
    { name: 'Nước hoa Chanel No.5', sku: 'CH-NO5', category: 'Nước hoa', price: 3500000, supplier: 'Chanel VN' },
    { name: 'Nước hoa Dior Sauvage', sku: 'DIOR-SAU', category: 'Nước hoa', price: 2800000, supplier: 'Dior VN' },
    { name: 'Nước hoa Tom Ford Black Orchid', sku: 'TF-BO', category: 'Nước hoa', price: 4200000, supplier: 'Tom Ford VN' },
    { name: 'Nước hoa Versace Bright Crystal', sku: 'VER-BC', category: 'Nước hoa', price: 1800000, supplier: 'Versace VN' },
    
    // Chăm sóc tóc
    { name: 'Dầu gội Kerastase', sku: 'KER-SHP', category: 'Chăm sóc tóc', price: 650000, supplier: 'Kerastase VN' },
    { name: 'Dầu xả Olaplex', sku: 'OLA-CON', category: 'Chăm sóc tóc', price: 890000, supplier: 'Olaplex VN' },
    { name: 'Mặt nạ tóc Moroccanoil', sku: 'MOR-MSK', category: 'Chăm sóc tóc', price: 1200000, supplier: 'Moroccanoil VN' }
  ]
};

async function cleanAndCreateCosmeticsData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Kết nối MongoDB thành công');

    // 1. XÓA DỮ LIỆU CŨ (chỉ xóa dữ liệu không liên quan đến vphone24h1@gmail.com)
    console.log('🗑️ Đang xóa dữ liệu cũ...');
    
    // Xóa tất cả inventory (sản phẩm)
    const deletedInventory = await Inventory.deleteMany({});
    console.log(`✅ Đã xóa ${deletedInventory.deletedCount} sản phẩm`);

    // Xóa tất cả categories
    const deletedCategories = await Category.deleteMany({});
    console.log(`✅ Đã xóa ${deletedCategories.deletedCount} danh mục`);

    // Xóa tất cả branches
    const deletedBranches = await Branch.deleteMany({});
    console.log(`✅ Đã xóa ${deletedBranches.deletedCount} chi nhánh`);

    // 2. TẠO CATEGORIES MỚI
    console.log('📁 Đang tạo danh mục mỹ phẩm...');
    const categories = await Category.insertMany(cosmeticsData.categories);
    console.log(`✅ Đã tạo ${categories.length} danh mục`);

    // 3. TẠO BRANCHES MỚI
    console.log('🏢 Đang tạo chi nhánh...');
    const branches = await Branch.insertMany(cosmeticsData.branches);
    console.log(`✅ Đã tạo ${branches.length} chi nhánh`);

    // 4. TẠO SẢN PHẨM MỸ PHẨM
    console.log('💄 Đang tạo sản phẩm mỹ phẩm...');
    
    const inventoryItems = [];
    const currentDate = new Date();
    
    // Tạo nhiều sản phẩm với số lượng khác nhau
    cosmeticsData.products.forEach((product, index) => {
      const branch = branches[index % branches.length];
      const category = categories.find(c => c.name === product.category);
      
      // Tạo 3-8 sản phẩm cho mỗi loại
      const quantity = Math.floor(Math.random() * 6) + 3;
      
      for (let i = 0; i < quantity; i++) {
        // Tạo barcode/serial number giả
        const serialNumber = `${product.sku}-${String(i + 1).padStart(3, '0')}`;
        
        // Ngày nhập ngẫu nhiên trong 3 tháng qua
        const importDate = new Date(currentDate);
        importDate.setDate(importDate.getDate() - Math.floor(Math.random() * 90));
        
        // Một số sản phẩm đã bán (20% chance)
        const isSold = Math.random() < 0.2;
        let soldDate = null;
        let salePrice = null;
        let buyerInfo = null;
        
        if (isSold) {
          soldDate = new Date(importDate);
          soldDate.setDate(soldDate.getDate() + Math.floor(Math.random() * 30));
          salePrice = Math.floor(product.price * (1.2 + Math.random() * 0.3)); // Markup 20-50%
          
          const buyers = [
            { name: 'Nguyễn Thị Hoa', phone: '0901234567' },
            { name: 'Trần Văn Nam', phone: '0912345678' },
            { name: 'Lê Thị Mai', phone: '0923456789' },
            { name: 'Phạm Văn Đức', phone: '0934567890' },
            { name: 'Hoàng Thị Lan', phone: '0945678901' }
          ];
          buyerInfo = buyers[Math.floor(Math.random() * buyers.length)];
        }
        
        inventoryItems.push({
          imei: serialNumber, // Dùng làm mã sản phẩm
          product_name: product.name,
          tenSanPham: product.name,
          sku: product.sku,
          price_import: product.price,
          import_date: importDate,
          supplier: product.supplier,
          branch: branch.name,
          category: category.name,
          quantity: 1,
          status: isSold ? 'sold' : 'in_stock',
          sold_date: soldDate,
          price_sell: salePrice,
          buyer_name: buyerInfo?.name,
          buyer_phone: buyerInfo?.phone,
          note: isSold ? 'Bán lẻ' : 'Nhập kho',
          source: 'tien_mat'
        });
      }
    });

    const createdItems = await Inventory.insertMany(inventoryItems);
    console.log(`✅ Đã tạo ${createdItems.length} sản phẩm mỹ phẩm`);

    // 5. THỐNG KÊ KẾT QUẢ
    const totalProducts = await Inventory.countDocuments();
    const soldProducts = await Inventory.countDocuments({ status: 'sold' });
    const inStockProducts = await Inventory.countDocuments({ status: 'in_stock' });
    const totalValue = await Inventory.aggregate([
      { $group: { _id: null, total: { $sum: '$price_import' } } }
    ]);
    const totalRevenue = await Inventory.aggregate([
      { $match: { status: 'sold' } },
      { $group: { _id: null, total: { $sum: '$price_sell' } } }
    ]);

    console.log('\n🎉 HOÀN THÀNH TẠO DỮ LIỆU MỸ PHẨM!');
    console.log('================================');
    console.log(`📦 Tổng sản phẩm: ${totalProducts}`);
    console.log(`✅ Đã bán: ${soldProducts}`);
    console.log(`📋 Tồn kho: ${inStockProducts}`);
    console.log(`💰 Giá trị nhập: ${(totalValue[0]?.total || 0).toLocaleString('vi-VN')} VND`);
    console.log(`💵 Doanh thu: ${(totalRevenue[0]?.total || 0).toLocaleString('vi-VN')} VND`);
    console.log(`🏢 Chi nhánh: ${branches.length}`);
    console.log(`📁 Danh mục: ${categories.length}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    process.exit(1);
  }
}

cleanAndCreateCosmeticsData(); 