#!/bin/bash

echo "🚀 Deploy VPhone lên VPS"
echo "======================="

# Cấu hình
VPS_IP="your-vps-ip"
VPS_USER="root"
PROJECT_PATH="/opt/vphone"

# Kiểm tra thông tin VPS
if [ "$VPS_IP" = "your-vps-ip" ]; then
    echo "⚠️  Hãy cập nhật thông tin VPS trong script này:"
    echo "   - VPS_IP: địa chỉ IP VPS của bạn"
    echo "   - VPS_USER: username trên VPS (root/ubuntu/...)"
    echo "   - PROJECT_PATH: đường dẫn deploy trên VPS"
    exit 1
fi

echo "📦 Đóng gói project..."
tar -czf vphone-deploy.tar.gz \
    --exclude=node_modules \
    --exclude=.git \
    --exclude=mongodb_backup \
    --exclude=docker_migration \
    --exclude=*.log \
    --exclude=.DS_Store \
    .

echo "📤 Upload lên VPS..."
scp vphone-deploy.tar.gz $VPS_USER@$VPS_IP:/tmp/

echo "🔧 Cài đặt trên VPS..."
ssh $VPS_USER@$VPS_IP << 'EOF'
    # Cài đặt Docker nếu chưa có
    if ! command -v docker &> /dev/null; then
        echo "📦 Cài đặt Docker..."
        curl -fsSL https://get.docker.com -o get-docker.sh
        sh get-docker.sh
        rm get-docker.sh
    fi

    # Cài đặt Docker Compose nếu chưa có
    if ! command -v docker-compose &> /dev/null; then
        echo "📦 Cài đặt Docker Compose..."
        curl -L "https://github.com/docker/compose/releases/download/v2.21.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
    fi

    # Tạo thư mục project
    mkdir -p /opt/vphone
    cd /opt/vphone

    # Extract project
    tar -xzf /tmp/vphone-deploy.tar.gz -C /opt/vphone
    rm /tmp/vphone-deploy.tar.gz

    # Copy environment variables
    cp docker.env .env

    # Update API URL in .env
    sed -i "s/your-vps-ip/$(curl -s ifconfig.me)/g" .env

    # Stop existing containers
    docker-compose down

    # Build and start containers
    docker-compose up -d --build

    echo "✅ Deploy hoàn thành!"
    echo "🌐 Truy cập ứng dụng tại: http://$(curl -s ifconfig.me)"
    echo "📊 Backend API: http://$(curl -s ifconfig.me):4000"
EOF

# Dọn dẹp
rm vphone-deploy.tar.gz

echo ""
echo "🎉 Deploy VPS hoàn thành!"
echo "📋 Thông tin truy cập:"
echo "   🌐 Frontend: http://$VPS_IP"
echo "   📊 Backend: http://$VPS_IP:4000"
echo "   🗄️  MongoDB: $VPS_IP:27017"
echo ""
echo "🔧 Quản lý containers:"
echo "   ssh $VPS_USER@$VPS_IP"
echo "   cd $PROJECT_PATH"
echo "   docker-compose logs -f"
echo "   docker-compose restart" 