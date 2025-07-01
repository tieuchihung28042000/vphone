#!/bin/bash

# Quick Diagnosis Script for 403 Error
# Sử dụng: ./scripts/diagnose-403.sh

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[CHECK]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo "🔍 Diagnosing 403 Forbidden Error"
echo "================================="
echo ""

PROJECT_DIR="/vphone"

# 1. Check project directory
print_status "Checking project directory..."
if [ -d "$PROJECT_DIR" ]; then
    print_success "Project directory exists: $PROJECT_DIR"
else
    print_error "Project directory not found: $PROJECT_DIR"
    exit 1
fi

# 2. Check build directory
BUILD_DIR="$PROJECT_DIR/iphone-inventory/dist"
print_status "Checking build directory..."
if [ -d "$BUILD_DIR" ]; then
    print_success "Build directory exists: $BUILD_DIR"
    
    # Check permissions
    OWNER=$(ls -ld "$BUILD_DIR" | awk '{print $3":"$4}')
    PERMS=$(ls -ld "$BUILD_DIR" | awk '{print $1}')
    echo "  Owner: $OWNER"
    echo "  Permissions: $PERMS"
    
    if [[ "$OWNER" == "www-data:www-data" ]]; then
        print_success "Correct ownership"
    else
        print_warning "Incorrect ownership - should be www-data:www-data"
    fi
else
    print_error "Build directory not found: $BUILD_DIR"
fi

# 3. Check nginx configuration
print_status "Checking nginx configuration..."
NGINX_SITE="/etc/nginx/sites-available/vphone"
if [ -f "$NGINX_SITE" ]; then
    print_success "Nginx site config exists"
    
    # Check if enabled
    if [ -L "/etc/nginx/sites-enabled/vphone" ]; then
        print_success "Site is enabled"
    else
        print_warning "Site is not enabled"
    fi
    
    # Test nginx config
    if nginx -t 2>/dev/null; then
        print_success "Nginx configuration is valid"
    else
        print_error "Nginx configuration has errors"
    fi
else
    print_error "Nginx site configuration not found"
fi

# 4. Check nginx status
print_status "Checking nginx status..."
if systemctl is-active --quiet nginx; then
    print_success "Nginx is running"
else
    print_error "Nginx is not running"
fi

# 5. Check backend service
print_status "Checking backend service..."
if pm2 list 2>/dev/null | grep -q "vphone-backend"; then
    STATUS=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="vphone-backend") | .pm2_env.status')
    if [[ "$STATUS" == "online" ]]; then
        print_success "Backend service is running"
    else
        print_warning "Backend service status: $STATUS"
    fi
else
    print_error "Backend service not found"
fi

# 6. Check ports
print_status "Checking ports..."
if netstat -tlnp 2>/dev/null | grep -q ":80 "; then
    print_success "Port 80 is listening"
else
    print_warning "Port 80 is not listening"
fi

if netstat -tlnp 2>/dev/null | grep -q ":3000 "; then
    print_success "Port 3000 (backend) is listening"
else
    print_warning "Port 3000 (backend) is not listening"
fi

# 7. Check index.html
print_status "Checking index.html..."
INDEX_FILE="$BUILD_DIR/index.html"
if [ -f "$INDEX_FILE" ]; then
    print_success "index.html exists"
    FILE_SIZE=$(stat -c%s "$INDEX_FILE")
    echo "  File size: $FILE_SIZE bytes"
    
    if [ "$FILE_SIZE" -gt 1000 ]; then
        print_success "index.html seems valid"
    else
        print_warning "index.html seems too small"
    fi
else
    print_error "index.html not found"
fi

# 8. Test HTTP requests
print_status "Testing HTTP requests..."
if curl -sf http://localhost/ > /dev/null 2>&1; then
    print_success "Frontend is accessible"
else
    print_error "Frontend is not accessible"
fi

if curl -sf http://localhost/api/branches > /dev/null 2>&1; then
    print_success "Backend API is accessible"
else
    print_error "Backend API is not accessible"
fi

echo ""
echo "🔧 Recommended actions:"
echo "======================"

# Recommendations
if [ ! -d "$BUILD_DIR" ]; then
    echo "1. Build the frontend: cd /vphone/iphone-inventory && npm run build"
fi

if [[ "$(ls -ld "$BUILD_DIR" 2>/dev/null | awk '{print $3":"$4}')" != "www-data:www-data" ]]; then
    echo "2. Fix permissions: sudo chown -R www-data:www-data $BUILD_DIR"
fi

if [ ! -f "$NGINX_SITE" ] || [ ! -L "/etc/nginx/sites-enabled/vphone" ]; then
    echo "3. Run the fix script: sudo ./scripts/fix-nginx-403.sh"
fi

if ! systemctl is-active --quiet nginx; then
    echo "4. Start nginx: sudo systemctl start nginx"
fi

if ! pm2 list 2>/dev/null | grep -q "vphone-backend"; then
    echo "5. Start backend: cd /vphone/backend && pm2 start server.js --name vphone-backend"
fi

echo ""
echo "💡 Quick fix command:"
echo "sudo ./scripts/fix-nginx-403.sh" 