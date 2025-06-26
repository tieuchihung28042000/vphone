#!/bin/bash

# Script sửa lỗi 502 Bad Gateway
echo "🔧 Sửa lỗi 502 Bad Gateway"
echo "=========================="

# Bước 1: Kiểm tra containers
echo "1. Kiểm tra trạng thái containers:"
docker-compose -f docker-compose.test.yml ps
docker-compose -f docker-compose.app.yml ps

# Bước 2: Restart containers không chạy
echo -e "\n2. Restart tất cả containers:"
docker-compose -f docker-compose.test.yml restart
docker-compose -f docker-compose.app.yml restart

# Chờ containers khởi động
echo -e "\n⏳ Chờ 30 giây để containers khởi động..."
sleep 30

# Bước 3: Kiểm tra ports
echo -e "\n3. Kiểm tra ports sau khi restart:"
sudo netstat -tulpn | grep -E "(4001|4002|8081|8083)" || echo "Một số port chưa sẵn sàng"

# Bước 4: Cập nhật nginx config
echo -e "\n4. Cập nhật nginx config:"
sudo cp nginx-production.conf /etc/nginx/sites-available/vphone

# Bước 5: Test và reload nginx
echo -e "\n5. Test và reload nginx:"
sudo nginx -t
if [ $? -eq 0 ]; then
    sudo systemctl reload nginx
    echo "✅ Nginx đã được reload"
else
    echo "❌ Nginx config có lỗi"
    exit 1
fi

# Bước 6: Test kết nối
echo -e "\n6. Test kết nối:"
sleep 5
curl -I http://127.0.0.1:8081 2>/dev/null && echo "✅ Test frontend OK" || echo "❌ Test frontend failed"
curl -I http://127.0.0.1:4001/health 2>/dev/null && echo "✅ Test backend OK" || echo "❌ Test backend failed"

echo -e "\n7. Kiểm tra cuối cùng:"
curl -I http://test.vphone.vn/health 2>/dev/null && echo "✅ test.vphone.vn OK" || echo "❌ test.vphone.vn failed"
curl -I http://app.vphone.vn/health 2>/dev/null && echo "✅ app.vphone.vn OK" || echo "❌ app.vphone.vn failed"

echo -e "\n🎉 Hoàn tất! Thử truy cập lại website." 