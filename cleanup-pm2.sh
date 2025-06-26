#!/bin/bash

# Script dọn dẹp PM2 và các service cũ trước khi deploy Docker
echo "🧹 Bắt đầu dọn dẹp hệ thống cũ..."

# Dừng tất cả PM2 processes
echo "⏹️  Dừng tất cả PM2 processes..."
pm2 stop all

# Xóa tất cả PM2 processes
echo "🗑️  Xóa tất cả PM2 processes..."
pm2 delete all

# Dừng PM2 daemon
echo "⏹️  Dừng PM2 daemon..."
pm2 kill

# Kiểm tra các port đang được sử dụng và dừng
echo "🔍 Kiểm tra và dừng các port cũ..."

# Port 4000 (backend cũ)
if lsof -i :4000 >/dev/null 2>&1; then
    echo "Tìm thấy process trên port 4000, đang dừng..."
    sudo kill -9 $(lsof -t -i:4000) 2>/dev/null || true
fi

# Port 5173/5174/5175 (frontend dev)
for port in 5173 5174 5175; do
    if lsof -i :$port >/dev/null 2>&1; then
        echo "Tìm thấy process trên port $port, đang dừng..."
        sudo kill -9 $(lsof -t -i:$port) 2>/dev/null || true
    fi
done

# Port 3000 (có thể là React dev)
if lsof -i :3000 >/dev/null 2>&1; then
    echo "Tìm thấy process trên port 3000, đang dừng..."
    sudo kill -9 $(lsof -t -i:3000) 2>/dev/null || true
fi

# Port 80 (nginx)
if lsof -i :80 >/dev/null 2>&1; then
    echo "Tìm thấy process trên port 80, đang dừng..."
    sudo kill -9 $(lsof -t -i:80) 2>/dev/null || true
fi

# Dừng nginx nếu đang chạy
if pgrep nginx > /dev/null; then
    echo "⏹️  Dừng nginx..."
    sudo systemctl stop nginx 2>/dev/null || sudo nginx -s stop 2>/dev/null || true
fi

# Dừng MongoDB local nếu đang chạy (để tránh conflict với Docker MongoDB)
if pgrep mongod > /dev/null; then
    echo "⏹️  Dừng MongoDB local..."
    sudo systemctl stop mongod 2>/dev/null || brew services stop mongodb-community 2>/dev/null || true
fi

# Dọn dẹp các Docker containers/images cũ nếu có
echo "🐳 Dọn dẹp Docker cũ..."
docker stop $(docker ps -aq) 2>/dev/null || true
docker rm $(docker ps -aq) 2>/dev/null || true
docker system prune -f 2>/dev/null || true

# Kiểm tra lại các port
echo "📊 Kiểm tra các port sau khi dọn dẹp:"
echo "Port 4000:" $(lsof -i :4000 >/dev/null 2>&1 && echo "🔴 Đang sử dụng" || echo "✅ Trống")
echo "Port 3000:" $(lsof -i :3000 >/dev/null 2>&1 && echo "🔴 Đang sử dụng" || echo "✅ Trống")
echo "Port 80:" $(lsof -i :80 >/dev/null 2>&1 && echo "🔴 Đang sử dụng" || echo "✅ Trống")
echo "Port 27017:" $(lsof -i :27017 >/dev/null 2>&1 && echo "🔴 Đang sử dụng" || echo "✅ Trống")

echo "✅ Dọn dẹp hoàn tất!"
echo "🚀 Bây giờ bạn có thể chạy deploy Docker an toàn:"
echo "   ./deploy-test.sh"
echo "   ./deploy-app.sh" 