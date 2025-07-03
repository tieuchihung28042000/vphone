#!/bin/bash

# Script setup Nginx native
# Sử dụng: ./scripts/setup-nginx.sh [domain]
# Ví dụ: ./scripts/setup-nginx.sh nguyenkieuanh.com

set -e

# Lấy domain từ tham số hoặc dùng mặc định
DOMAIN=${1:-localhost}

echo "🚀 Setup Nginx native với domain: $DOMAIN"

# Kiểm tra hệ điều hành và cài đặt Nginx
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    echo "📱 Cài đặt Nginx trên macOS..."
    if ! command -v nginx &> /dev/null; then
        if ! command -v brew &> /dev/null; then
            echo "❌ Cần Homebrew để cài đặt Nginx"
            echo "Chạy: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
            exit 1
        fi
        brew install nginx
    fi
    
    NGINX_CONF_DIR="/usr/local/etc/nginx"
    NGINX_SITES_DIR="$NGINX_CONF_DIR/servers"
    
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    echo "🐧 Cài đặt Nginx trên Linux..."
    if ! command -v nginx &> /dev/null; then
        sudo apt-get update
        sudo apt-get install -y nginx
    fi
    
    NGINX_CONF_DIR="/etc/nginx"
    NGINX_SITES_DIR="$NGINX_CONF_DIR/sites-available"
    
else
    echo "❌ Hệ điều hành không được hỗ trợ"
    exit 1
fi

# Tạo file cấu hình Nginx với domain
echo "⚙️  Tạo cấu hình Nginx cho domain: $DOMAIN"
cat > /tmp/vphone.conf << EOF
upstream backend {
    server localhost:4000;
}

upstream frontend {
    server localhost:3000;
}

# Rate limiting
limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone \$binary_remote_addr zone=login:10m rate=5r/m;

# HTTP server
server {
    listen 80;
    server_name $DOMAIN;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Logs
    access_log /var/log/nginx/vphone_access.log;
    error_log /var/log/nginx/vphone_error.log;

    # API routes - proxy to backend
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Special rate limiting for login endpoint
    location /api/auth/login {
        limit_req zone=login burst=5 nodelay;
        
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Frontend - proxy to React app
    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "nginx healthy\\n";
        add_header Content-Type text/plain;
    }
}
EOF

# Copy cấu hình Nginx
if [[ "$OSTYPE" == "darwin"* ]]; then
    sudo mkdir -p "$NGINX_SITES_DIR"
    sudo cp /tmp/vphone.conf "$NGINX_SITES_DIR/vphone.conf"
else
    sudo cp /tmp/vphone.conf "$NGINX_SITES_DIR/vphone"
    sudo ln -sf "$NGINX_SITES_DIR/vphone" /etc/nginx/sites-enabled/vphone
    # Xóa default site
    sudo rm -f /etc/nginx/sites-enabled/default
fi

# Cập nhật docker-compose.yml với domain
echo "🐳 Cập nhật docker-compose.yml với domain: $DOMAIN"
if [ -f docker-compose.yml ]; then
    # Cập nhật MONGODB_URI trong docker-compose.yml
    sed -i.bak "s|MONGODB_URI:.*|MONGODB_URI: mongodb://admin:12345@host.docker.internal:27017/vphone_production?authSource=admin|g" docker-compose.yml
    
    # Cập nhật VITE_API_URL với domain
    if [ "$DOMAIN" != "localhost" ]; then
        sed -i.bak "s|VITE_API_URL:.*|VITE_API_URL: https://$DOMAIN|g" docker-compose.yml
    else
        sed -i.bak "s|VITE_API_URL:.*|VITE_API_URL: http://localhost|g" docker-compose.yml
    fi
    
    echo "✅ docker-compose.yml đã được cập nhật"
fi

# Kiểm tra cấu hình Nginx
echo "🔍 Kiểm tra cấu hình Nginx..."
if sudo nginx -t; then
    echo "✅ Cấu hình Nginx hợp lệ"
else
    echo "❌ Cấu hình Nginx không hợp lệ"
    exit 1
fi

# Khởi động Nginx
echo "▶️  Khởi động Nginx..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    if pgrep -f nginx > /dev/null; then
        sudo nginx -s reload
    else
        sudo nginx
    fi
else
    sudo systemctl start nginx
    sudo systemctl enable nginx
fi

# Kiểm tra Nginx
sleep 2
if curl -s http://localhost/health > /dev/null; then
    echo "✅ Nginx đã sẵn sàng!"
    echo "📊 Thông tin cấu hình:"
    echo "   - Domain: $DOMAIN"
    echo "   - Port: 80"
    echo "   - Backend: localhost:4000"
    echo "   - Frontend: localhost:3000"
    echo "   - Config: $NGINX_SITES_DIR/vphone"
    echo "   - Access log: /var/log/nginx/vphone_access.log"
    echo "   - Error log: /var/log/nginx/vphone_error.log"
else
    echo "⚠️  Nginx đang chạy nhưng chưa thể truy cập (backend/frontend chưa khởi động)"
fi 