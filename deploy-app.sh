#!/bin/bash

echo "🚀 VPhone Deploy Script cho app.vphone.vn"
echo "=========================================="

# Hàm dọn dẹp hoàn toàn
cleanup_all() {
    echo "🧹 Dọn dẹp hoàn toàn hệ thống..."
    
    # Dừng tất cả containers
    echo "📦 Dừng tất cả Docker containers..."
    docker stop $(docker ps -aq) 2>/dev/null || true
    docker rm $(docker ps -aq) 2>/dev/null || true
    
    # Xóa tất cả images
    echo "🗑️ Xóa Docker images..."
    docker rmi $(docker images -q) 2>/dev/null || true
    
    # Xóa tất cả volumes
    echo "💾 Xóa Docker volumes..."
    docker volume rm $(docker volume ls -q) 2>/dev/null || true
    
    # Xóa tất cả networks
    echo "🌐 Xóa Docker networks..."
    docker network rm $(docker network ls -q) 2>/dev/null || true
    
    # Dọn dẹp system
    echo "🧽 Dọn dẹp Docker system..."
    docker system prune -af --volumes
    
    # Dừng PM2 nếu có
    echo "⚡ Dừng PM2..."
    pm2 stop all 2>/dev/null || true
    pm2 delete all 2>/dev/null || true
    pm2 kill 2>/dev/null || true
    
    # Dừng nginx system
    echo "🌍 Dừng nginx system..."
    sudo systemctl stop nginx 2>/dev/null || true
    
    echo "✅ Dọn dẹp hoàn tất!"
}

# Hàm chuẩn bị môi trường
prepare_environment() {
    echo "🔧 Chuẩn bị môi trường..."
    
    # Tạo thư mục cần thiết
    mkdir -p scripts
    mkdir -p mongodb-data/vphone-complete-backup
    
    # Cấp quyền cho scripts
    chmod +x scripts/restore-vphone-complete.sh
    
    # Tạo file .env nếu chưa có
    if [ ! -f .env ]; then
        echo "📝 Tạo file .env..."
        cat > .env << EOF
JWT_SECRET=vphone2024!secure#key\$app
EMAIL_USER=vphone24h3@gmail.com
EMAIL_PASS=ftxhkismjvdqzawp
EOF
    fi
    
    echo "✅ Chuẩn bị môi trường hoàn tất!"
}

# Hàm restore dữ liệu VPS
restore_vps_data() {
    echo "📦 Restore dữ liệu VPS..."
    ./scripts/restore-vps.sh
}

# Hàm build và deploy
deploy_app() {
    echo "🚀 Deploy ứng dụng..."
    
    # Build và start containers
    echo "📦 Build và start containers..."
    docker-compose up -d --build
    
    # Chờ containers khởi động
    echo "⏳ Chờ containers khởi động..."
    sleep 30
    
    # Kiểm tra trạng thái
    echo "🔍 Kiểm tra trạng thái containers..."
    docker-compose ps
    
    echo "✅ Deploy hoàn tất!"
}

# Hàm kiểm tra health
check_health() {
    echo "🏥 Kiểm tra sức khỏe hệ thống..."
    
    echo "📊 Trạng thái containers:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    
    echo ""
    echo "🧪 Health checks:"
    
    # Kiểm tra MongoDB
    if docker exec vphone-mongodb mongosh --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
        echo "✅ MongoDB: OK"
    else
        echo "❌ MongoDB: FAILED"
    fi
    
    # Kiểm tra Backend
    if curl -s http://localhost:4000/health >/dev/null 2>&1; then
        echo "✅ Backend: OK"
    else
        echo "❌ Backend: FAILED"
    fi
    
    # Kiểm tra Frontend
    if curl -s http://localhost:80 >/dev/null 2>&1; then
        echo "✅ Frontend: OK"
    else
        echo "❌ Frontend: FAILED"
    fi
    
    # Kiểm tra Nginx
    if curl -s http://localhost:8080 >/dev/null 2>&1; then
        echo "✅ Nginx: OK"
    else
        echo "❌ Nginx: FAILED"
    fi
    
    echo ""
    echo "🌍 Truy cập ứng dụng:"
    echo "- Local: http://localhost:8080"
    echo "- Production: http://app.vphone.vn"
}

# Hàm xem logs
show_logs() {
    echo "📋 Logs của hệ thống:"
    docker-compose logs --tail=20
}

# Hàm cài đặt nginx trên VPS
setup_nginx_vps() {
    echo "🌐 Cài đặt nginx trên VPS..."
    
    # Cài đặt nginx
    sudo apt update
    sudo apt install -y nginx
    
    # Tạo config cho app.vphone.vn
    sudo tee /etc/nginx/sites-available/app.vphone.vn > /dev/null << 'EOF'
server {
    listen 80;
    server_name app.vphone.vn;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
    
    # Kích hoạt site
    sudo rm -f /etc/nginx/sites-enabled/default
    sudo ln -sf /etc/nginx/sites-available/app.vphone.vn /etc/nginx/sites-enabled/
    
    # Test và restart nginx
    sudo nginx -t && sudo systemctl restart nginx
    sudo systemctl enable nginx
    
    echo "✅ Nginx VPS đã cài đặt!"
}

# Menu chính
show_menu() {
    echo ""
    echo "Chọn hành động:"
    echo "1. 🧹 Dọn dẹp hoàn toàn"
    echo "2. 🔧 Chuẩn bị môi trường"
    echo "3. 🚀 Deploy ứng dụng"
    echo "4. 📦 Restore dữ liệu VPS"
    echo "5. 🏥 Kiểm tra sức khỏe"
    echo "6. 📋 Xem logs"
    echo "7. 🌐 Cài đặt nginx VPS"
    echo "8. 🎯 Deploy hoàn chỉnh (1+2+3+4)"
    echo "9. ❌ Thoát"
    echo ""
    read -p "Nhập lựa chọn (1-9): " choice
}

# Main loop
if [ "$1" = "auto" ]; then
    # Chế độ tự động
    echo "🤖 Chế độ deploy tự động..."
    cleanup_all
    prepare_environment
    deploy_app
    restore_vps_data
    check_health
else
    # Chế độ interactive
    while true; do
        show_menu
        
        case $choice in
            1)
                cleanup_all
                ;;
            2)
                prepare_environment
                ;;
            3)
                deploy_app
                ;;
            4)
                restore_vps_data
                ;;
            5)
                check_health
                ;;
            6)
                show_logs
                ;;
            7)
                setup_nginx_vps
                ;;
            8)
                echo "🎯 Deploy hoàn chỉnh..."
                cleanup_all
                prepare_environment
                deploy_app
                restore_vps_data
                check_health
                ;;
            9)
                echo "👋 Thoát"
                exit 0
                ;;
            *)
                echo "❌ Lựa chọn không hợp lệ"
                ;;
        esac
        
        echo ""
        read -p "Nhấn Enter để tiếp tục..."
    done
fi 