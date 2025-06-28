const mongoose = require('mongoose');
const Branch = require('./models/Branch');

const branches = [
  { name: 'Dĩ An' },
  { name: 'Quận 9' }
];

async function seedBranches() {
  try {
    // Kết nối MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/vphone', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('✅ Kết nối MongoDB thành công');

    // Kiểm tra và tạo chi nhánh nếu chưa có
    for (const branchData of branches) {
      const existingBranch = await Branch.findOne({ name: branchData.name });
      
      if (!existingBranch) {
        const branch = new Branch(branchData);
        await branch.save();
        console.log(`✅ Đã tạo chi nhánh: ${branchData.name}`);
      } else {
        console.log(`ℹ️  Chi nhánh đã tồn tại: ${branchData.name}`);
      }
    }

    console.log('🎉 Hoàn thành seed chi nhánh!');
    
  } catch (error) {
    console.error('❌ Lỗi seed chi nhánh:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📪 Đóng kết nối MongoDB');
  }
}

// Chạy script
seedBranches(); 