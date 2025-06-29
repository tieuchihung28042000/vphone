const mongoose = require('mongoose');
const ExportHistory = require('./models/ExportHistory');

const LOCAL_URI = 'mongodb://vphone_admin:vphone_secure_2024@103.109.187.224:27017/vphone?authSource=admin';

async function debugSorting() {
  try {
    console.log('🔍 Debug sắp xếp dữ liệu xuất hàng...\n');
    
    await mongoose.connect(LOCAL_URI);
    console.log('✅ Đã kết nối database');
    
    // Lấy 10 bản ghi mới nhất từ ExportHistory
    const recentExports = await ExportHistory.find({})
      .sort({ 
        createdAt: -1,     // Ưu tiên theo thời gian tạo (mới nhất trước)
        sold_date: -1,     // Sau đó theo ngày bán
        updatedAt: -1,     // Cuối cùng theo thời gian cập nhật
        _id: -1            // Đảm bảo sắp xếp ổn định
      })
      .limit(10);
    
    console.log('📋 10 bản ghi mới nhất từ ExportHistory:');
    recentExports.forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.product_name || 'N/A'}`);
      console.log(`      - IMEI: ${item.imei || 'N/A'}`);
      console.log(`      - Giá bán: ${item.price_sell || item.giaBan || 'N/A'}`);
      console.log(`      - Ngày bán: ${item.sold_date?.toISOString().slice(0, 10) || 'N/A'}`);
      console.log(`      - Thời gian tạo: ${item.createdAt?.toISOString() || 'N/A'}`);
      console.log(`      - Thời gian cập nhật: ${item.updatedAt?.toISOString() || 'N/A'}`);
      console.log(`      - ID: ${item._id}`);
      console.log('');
    });
    
    // Kiểm tra bản ghi mới nhất
    const latestRecord = await ExportHistory.findOne().sort({ createdAt: -1 });
    console.log('🔍 BẢN GHI MỚI NHẤT:');
    console.log(`   - Tên: ${latestRecord?.product_name || 'N/A'}`);
    console.log(`   - IMEI: ${latestRecord?.imei || 'N/A'}`);
    console.log(`   - Thời gian tạo: ${latestRecord?.createdAt?.toISOString() || 'N/A'}`);
    console.log(`   - ID: ${latestRecord?._id || 'N/A'}`);
    
    // Kiểm tra xem có bản ghi nào có createdAt null không
    const nullCreatedAt = await ExportHistory.countDocuments({ createdAt: null });
    console.log(`\n⚠️  Bản ghi có createdAt null: ${nullCreatedAt}`);
    
    if (nullCreatedAt > 0) {
      console.log('🔍 Các bản ghi có createdAt null:');
      const nullRecords = await ExportHistory.find({ createdAt: null }).limit(5);
      nullRecords.forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.product_name || 'N/A'} - ID: ${item._id}`);
      });
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Hoàn tất debug sắp xếp!');
    
  } catch (error) {
    console.error('❌ Lỗi debug sắp xếp:', error);
  } finally {
    process.exit(0);
  }
}

if (require.main === module) {
  debugSorting();
}

module.exports = { debugSorting }; 