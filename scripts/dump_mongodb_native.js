const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// MongoDB connection từ docker-compose.yml của vphone
const MONGODB_URI = 'mongodb://nguyenkieuanh:123456@localhost:27017/nguyenkieuanh?authSource=nguyenkieuanh';
const DB_NAME = 'nguyenkieuanh';

// Tạo thư mục backup
const backupDir = path.join(__dirname, '..', 'backups');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupPath = path.join(backupDir, `mongodb_native_backup_${timestamp}`);

if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

console.log('🔄 Bắt đầu dump MongoDB native...');
console.log(`📁 Backup sẽ được lưu tại: ${backupPath}`);

try {
  // Sử dụng mongodump với URI
  const command = `mongodump --uri="${MONGODB_URI}" --out="${backupPath}"`;
  console.log(`📝 Chạy lệnh: ${command.replace(/:[^:@]*@/, ':****@')}`);
  
  execSync(command, { 
    stdio: 'inherit',
    env: { ...process.env }
  });
  
  console.log(`✅ Dump thành công! Backup tại: ${backupPath}`);
  console.log(`📊 Kiểm tra kích thước:`);
  execSync(`du -sh "${backupPath}"`, { stdio: 'inherit' });
} catch (error) {
  console.error('❌ Lỗi khi dump:', error.message);
  process.exit(1);
}
