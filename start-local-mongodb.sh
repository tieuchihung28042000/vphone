#!/bin/bash

echo "🚀 Khởi động hệ thống VPhone với Local MongoDB"

# Khởi động MongoDB local (nếu chưa chạy)
echo "📦 Khởi động MongoDB Local..."
brew services start mongodb/brew/mongodb-community

# Đợi MongoDB khởi động
sleep 2

# Kiểm tra kết nối
echo "🔍 Kiểm tra kết nối MongoDB..."
MONGO_COUNT=$(mongosh "mongodb://localhost:27017/test" --quiet --eval "db.inventories.countDocuments()")

if [ "$MONGO_COUNT" -gt 0 ]; then
    echo "✅ MongoDB đã sẵn sàng!"
    echo "📊 Inventories: $MONGO_COUNT sản phẩm"
else
    echo "❌ Lỗi kết nối MongoDB hoặc không có dữ liệu"
fi

echo ""
echo "🎯 Thông tin kết nối:"
echo "   📍 MongoDB URL: mongodb://localhost:27017/test"
echo "   📊 Inventories: $MONGO_COUNT sản phẩm"
echo ""
echo "⚠️  Hãy đảm bảo file backend/.env đã được cập nhật:"
echo "   MONGODB_URI=mongodb://localhost:27017/vphone"
echo ""
echo "🚀 Sẵn sàng khởi động backend server với:"
echo "   cd backend && npm start"
echo ""
echo "🌐 Và frontend với:"
echo "   cd iphone-inventory && npm run dev" 