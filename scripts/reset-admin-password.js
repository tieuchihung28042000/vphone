const bcrypt = require('bcryptjs');
const { MongoClient } = require('mongodb');

async function resetAdminPassword() {
    const uri = 'mongodb://vphone_admin:vphone_secure_2024@localhost:27017/vphone?authSource=admin';
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('✅ Kết nối MongoDB thành công');

        const db = client.db('vphone');
        const adminsCollection = db.collection('admins');

        // Hash mật khẩu mới
        const newPassword = '123456';
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        console.log('🔑 Đang cập nhật mật khẩu cho admin@vphone.com...');

        // Cập nhật mật khẩu
        const result = await adminsCollection.updateOne(
            { email: 'admin@vphone.com' },
            { $set: { password: hashedPassword } }
        );

        if (result.matchedCount > 0) {
            console.log('✅ Đã cập nhật mật khẩu thành công!');
            console.log('📧 Email: admin@vphone.com');
            console.log('🔐 Mật khẩu mới: 123456');
            
            // Kiểm tra lại
            const admin = await adminsCollection.findOne({email: 'admin@vphone.com'});
            console.log('\n🔍 Kiểm tra tài khoản:');
            console.log('Email:', admin.email);
            console.log('Role:', admin.role);
            console.log('Password hash:', admin.password.substring(0, 20) + '...');
        } else {
            console.log('❌ Không tìm thấy tài khoản admin@vphone.com');
        }

    } catch (error) {
        console.error('❌ Lỗi:', error.message);
    } finally {
        await client.close();
    }
}

resetAdminPassword(); 