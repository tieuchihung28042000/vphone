const mongoose = require('mongoose');
const ExportHistory = require('./models/ExportHistory');
const Inventory = require('./models/Inventory');

async function debugData() {
  try {
    await mongoose.connect('mongodb://vphone_admin:vphone_secure_2024@localhost:27017/vphone?authSource=admin');
    console.log('✅ Connected to MongoDB');
    
    const targetId = '685d2863ec6beda1b7bca64c';
    
    // Kiểm tra trong Inventory 
    const inventoryRecord = await Inventory.findById(targetId);
    console.log('📋 Inventory record found:', inventoryRecord ? 'YES' : 'NO');
    if (inventoryRecord) {
      console.log('  Status:', inventoryRecord.status);
      console.log('  IMEI:', inventoryRecord.imei);
      console.log('  Price_sell:', inventoryRecord.price_sell);
      console.log('  GiaBan:', inventoryRecord.giaBan);
    }
    
    // Kiểm tra trong ExportHistory
    const exportRecord = await ExportHistory.findById(targetId);
    console.log('📋 ExportHistory record found:', exportRecord ? 'YES' : 'NO');
    
    // Count records
    const inventoryCount = await Inventory.countDocuments({ status: 'sold' });
    const exportCount = await ExportHistory.countDocuments();
    console.log(`📊 Inventory sold: ${inventoryCount}, ExportHistory: ${exportCount}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

debugData(); 