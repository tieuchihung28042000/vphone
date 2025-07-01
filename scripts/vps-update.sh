#!/bin/bash

# VPS Update Script - Chạy trên VPS
# Sử dụng: ./scripts/vps-update.sh

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

# Project directory on VPS
PROJECT_DIR="/vphone"

echo "🔄 VPS Update Script"
echo "===================="
echo ""

# Check if directory exists
if [ ! -d "$PROJECT_DIR" ]; then
    print_error "Project directory not found: $PROJECT_DIR"
    exit 1
fi

# Go to project directory
print_status "Changing to project directory: $PROJECT_DIR"
cd "$PROJECT_DIR" || exit 1

# Show current status
print_status "Current branch: $(git branch --show-current)"
print_status "Current commit: $(git rev-parse --short HEAD)"
echo ""

# Reset hard to discard local changes and remove untracked files
print_status "Resetting local changes..."
git reset --hard

print_status "Removing untracked files..."
git clean -fd

# Pull latest changes
print_status "Pulling latest changes..."
if git pull; then
    print_success "Code updated successfully!"
else
    print_error "Git pull failed!"
    exit 1
fi

# Show new status
echo ""
print_status "New commit: $(git rev-parse --short HEAD)"
print_status "Latest commit message: $(git log -1 --pretty=format:'%s')"

# Reinstall backend dependencies
print_status "Installing backend dependencies..."
cd "$PROJECT_DIR/backend" || exit 1
if npm install --production; then
    print_success "Backend dependencies installed!"
else
    print_warning "Backend npm install failed"
fi

# Reinstall and rebuild frontend
print_status "Installing frontend dependencies..."
cd "$PROJECT_DIR/iphone-inventory" || exit 1
if npm install; then
    print_success "Frontend dependencies installed!"
else
    print_warning "Frontend npm install failed"
fi

print_status "Building frontend for production..."
if npm run build; then
    print_success "Frontend build completed!"
else
    print_error "Frontend build failed!"
    exit 1
fi

# Go back to project root
cd "$PROJECT_DIR" || exit 1

# Restart backend service
print_status "Restarting backend service..."
if pm2 restart vphone-backend; then
    print_success "Backend restarted!"
else
    print_warning "Backend restart failed - you may need to start it manually"
fi

# Wait a moment for backend to be ready
print_status "Waiting for backend to be ready..."
sleep 3

# Fix permissions for build directory
print_status "Fixing file permissions..."
BUILD_DIR="$PROJECT_DIR/iphone-inventory/dist"
if [ -d "$BUILD_DIR" ]; then
    chown -R www-data:www-data "$BUILD_DIR"
    chmod -R 755 "$BUILD_DIR"
    print_success "Permissions fixed!"
else
    print_warning "Build directory not found: $BUILD_DIR"
fi

# Reload nginx
print_status "Reloading nginx..."
if systemctl reload nginx; then
    print_success "Nginx reloaded!"
else
    print_warning "Nginx reload failed - trying to fix..."
    # Run the fix script if available
    if [ -f "$PROJECT_DIR/scripts/fix-nginx-403.sh" ]; then
        print_status "Running nginx fix script..."
        bash "$PROJECT_DIR/scripts/fix-nginx-403.sh"
    fi
fi

# Test if backend is responding
print_status "Testing backend API..."
if curl -sf http://localhost:3000/api/branches > /dev/null; then
    print_success "Backend API is responding!"
else
    print_warning "Backend API test failed"
fi

echo ""
print_success "VPS Update completed! ✅"
echo "=================================="
echo "📊 Summary:"
echo "  • Code updated from Git"
echo "  • Dependencies reinstalled"
echo "  • Frontend rebuilt"
echo "  • Backend restarted"
echo "  • Nginx reloaded"
echo "  • API tested"
echo "==================================" 