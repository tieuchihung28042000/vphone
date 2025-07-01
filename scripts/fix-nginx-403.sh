#!/bin/bash

# Fix Nginx 403 Forbidden Error Script
# Sử dụng: sudo ./scripts/fix-nginx-403.sh

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo "🔧 Fixing Nginx 403 Forbidden Error"
echo "===================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "Please run as root: sudo ./scripts/fix-nginx-403.sh"
    exit 1
fi

PROJECT_DIR="/vphone"

# 1. Check if project directory exists
print_status "Checking project directory..."
if [ ! -d "$PROJECT_DIR" ]; then
    print_error "Project directory not found: $PROJECT_DIR"
    exit 1
fi

# 2. Check build directory
BUILD_DIR="$PROJECT_DIR/iphone-inventory/dist"
print_status "Checking build directory: $BUILD_DIR"
if [ ! -d "$BUILD_DIR" ]; then
    print_warning "Build directory not found. Building frontend..."
    cd "$PROJECT_DIR/iphone-inventory" || exit 1
    npm run build
    if [ ! -d "$BUILD_DIR" ]; then
        print_error "Build failed or dist directory not created"
        exit 1
    fi
fi

# 3. Fix file permissions
print_status "Fixing file permissions..."
chown -R www-data:www-data "$BUILD_DIR"
chmod -R 755 "$BUILD_DIR"
print_success "Permissions fixed!"

# 4. Create nginx site configuration
NGINX_SITE="/etc/nginx/sites-available/vphone"
print_status "Creating nginx site configuration..."

cat > "$NGINX_SITE" << 'EOF'
server {
    listen 80;
    server_name app.vphone.vn localhost;
    root /vphone/iphone-inventory/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Handle client routing, return all requests to index.html
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }

    # API proxy to backend
    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # CORS headers
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods 'GET, POST, PUT, DELETE, OPTIONS';
        add_header Access-Control-Allow-Headers 'DNT,X-CustomHeader,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Authorization';
        
        if ($request_method = 'OPTIONS') {
            return 204;
        }
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # Deny access to sensitive files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    location ~ /\.git {
        deny all;
        access_log off;
        log_not_found off;
    }
}
EOF

print_success "Nginx configuration created!"

# 5. Enable the site
print_status "Enabling nginx site..."
ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/vphone

# 6. Remove default nginx site if exists
if [ -f "/etc/nginx/sites-enabled/default" ]; then
    print_status "Removing default nginx site..."
    rm -f /etc/nginx/sites-enabled/default
fi

# 7. Test nginx configuration
print_status "Testing nginx configuration..."
if nginx -t; then
    print_success "Nginx configuration is valid!"
else
    print_error "Nginx configuration has errors!"
    exit 1
fi

# 8. Check backend service
print_status "Checking backend service..."
if pm2 list | grep -q "vphone-backend"; then
    print_status "Restarting backend service..."
    pm2 restart vphone-backend
else
    print_warning "Backend service not found. Starting it..."
    cd "$PROJECT_DIR/backend" || exit 1
    pm2 start server.js --name vphone-backend
fi

# 9. Reload nginx
print_status "Reloading nginx..."
systemctl reload nginx

# 10. Check nginx status
print_status "Checking nginx status..."
if systemctl is-active --quiet nginx; then
    print_success "Nginx is running!"
else
    print_warning "Nginx is not running. Starting it..."
    systemctl start nginx
fi

# 11. Test the application
print_status "Testing application..."
sleep 2

if curl -sf http://localhost/ > /dev/null; then
    print_success "Frontend is accessible!"
else
    print_warning "Frontend test failed"
fi

if curl -sf http://localhost/api/branches > /dev/null; then
    print_success "Backend API is accessible!"
else
    print_warning "Backend API test failed"
fi

echo ""
print_success "Nginx 403 Fix completed! ✅"
echo "=================================="
echo "📊 What was fixed:"
echo "  • File permissions corrected"
echo "  • Nginx configuration updated"
echo "  • Site enabled properly"
echo "  • Backend service checked"
echo "  • Services restarted"
echo ""
echo "🌐 Your app should now be accessible at:"
echo "  • http://app.vphone.vn"
echo "  • http://localhost"
echo "==================================" 