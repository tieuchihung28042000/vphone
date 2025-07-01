#!/bin/bash

# VPS Update Script with Safe Build - Chạy trên VPS
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

echo "🔄 VPS Update Script with Safe Build"
echo "===================================="
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

# Frontend Safe Build Process
echo ""
echo "🔨 Safe Frontend Build"
echo "======================"

FRONTEND_DIR="$PROJECT_DIR/iphone-inventory"
cd "$FRONTEND_DIR" || exit 1

# Check system resources
print_status "Checking system resources..."
FREE_RAM=$(free -m | awk 'NR==2{printf "%.1f", $7/1024}')
echo "Available RAM: ${FREE_RAM}GB"

# Determine memory limit based on available RAM
if command -v bc >/dev/null 2>&1; then
    if (( $(echo "$FREE_RAM < 1.0" | bc -l) )); then
        print_warning "Low RAM detected. Using conservative build settings."
        MEMORY_LIMIT=512
    else
        MEMORY_LIMIT=1024
    fi
else
    # Fallback if bc is not available
    if [ "${FREE_RAM%.*}" -lt 1 ]; then
        print_warning "Low RAM detected. Using conservative build settings."
        MEMORY_LIMIT=512
    else
        MEMORY_LIMIT=1024
    fi
fi

# Kill any existing build processes
print_status "Killing any existing build processes..."
pkill -f "vite build" 2>/dev/null || true
pkill -f "npm run build" 2>/dev/null || true

# Clean up previous build artifacts
print_status "Cleaning up previous build artifacts..."
rm -rf dist .vite

# Install frontend dependencies
print_status "Installing frontend dependencies..."
if npm install; then
    print_success "Frontend dependencies installed!"
else
    print_error "Frontend npm install failed!"
    exit 1
fi

# Build with timeout and memory limit
print_status "Building frontend with memory limit: ${MEMORY_LIMIT}MB..."

# Use timeout to prevent hanging (5 minutes)
timeout 300 bash -c "
    NODE_OPTIONS='--max-old-space-size=$MEMORY_LIMIT' \
    VITE_BUILD_CHUNK_SIZE_LIMIT=500 \
    npm run build
" 2>&1

BUILD_EXIT_CODE=$?

if [ $BUILD_EXIT_CODE -eq 0 ]; then
    print_success "Build completed successfully!"
    
    # Check if dist directory was created
    if [ -d "dist" ] && [ -f "dist/index.html" ]; then
        print_success "Build artifacts verified!"
        
        # Show build size
        BUILD_SIZE=$(du -sh dist | cut -f1)
        echo "Build size: $BUILD_SIZE"
        
    else
        print_error "Build completed but dist directory is invalid"
        exit 1
    fi
    
elif [ $BUILD_EXIT_CODE -eq 124 ]; then
    print_error "Build timed out after 5 minutes"
    print_warning "This usually indicates insufficient resources or hanging process"
    echo ""
    echo "💡 Try these solutions:"
    echo "1. Increase VPS RAM or add swap memory"
    echo "2. Build locally and copy dist folder"
    echo "3. Use smaller chunk size"
    exit 1
    
else
    print_error "Build failed with exit code: $BUILD_EXIT_CODE"
    
    # Show last few lines of potential error
    echo ""
    echo "Recent npm log:"
    tail -10 ~/.npm/_logs/*.log 2>/dev/null || echo "No npm logs found"
    
    exit 1
fi

# Go back to project root
cd "$PROJECT_DIR" || exit 1

# Fix permissions for build directory
print_status "Fixing file permissions..."
BUILD_DIR="$PROJECT_DIR/iphone-inventory/dist"
if [ -d "$BUILD_DIR" ]; then
    chown -R www-data:www-data "$BUILD_DIR" 2>/dev/null || {
        print_warning "Could not fix permissions (need sudo)"
        echo "Run: sudo chown -R www-data:www-data $BUILD_DIR"
    }
    chmod -R 755 "$BUILD_DIR" 2>/dev/null || true
    print_success "Permissions fixed!"
else
    print_warning "Build directory not found: $BUILD_DIR"
fi

# Restart backend service
print_status "Restarting backend service..."
if pm2 restart vphone-backend 2>/dev/null; then
    print_success "Backend restarted!"
else
    print_warning "Backend restart failed - trying to start..."
    cd "$PROJECT_DIR/backend" || exit 1
    if pm2 start server.js --name vphone-backend; then
        print_success "Backend started!"
    else
        print_warning "Backend start failed - you may need to check manually"
    fi
fi

# Wait a moment for backend to be ready
print_status "Waiting for backend to be ready..."
sleep 3

# Reload nginx
print_status "Reloading nginx..."
if systemctl reload nginx 2>/dev/null; then
    print_success "Nginx reloaded!"
else
    print_warning "Nginx reload failed - trying to fix..."
    # Run the fix script if available
    if [ -f "$PROJECT_DIR/scripts/fix-nginx-403.sh" ]; then
        print_status "Running nginx fix script..."
        bash "$PROJECT_DIR/scripts/fix-nginx-403.sh"
    else
        print_warning "Nginx fix script not found"
    fi
fi

# Test services
echo ""
print_status "Testing services..."

# Test backend API
if curl -sf http://localhost:3000/api/branches > /dev/null 2>&1; then
    print_success "Backend API is responding!"
else
    print_warning "Backend API test failed"
fi

# Test frontend
if curl -sf http://localhost/ > /dev/null 2>&1; then
    print_success "Frontend is accessible!"
else
    print_warning "Frontend test failed"
fi

echo ""
print_success "VPS Update with Safe Build completed! ✅"
echo "================================================="
echo "📊 Summary:"
echo "  • Code updated from Git"
echo "  • Backend dependencies reinstalled"
echo "  • Frontend built safely with memory management"
echo "  • Permissions fixed"
echo "  • Backend service restarted"
echo "  • Nginx reloaded"
echo "  • Services tested"
echo ""
echo "🌐 Your app should be accessible at:"
echo "  • http://app.vphone.vn"
echo "  • http://localhost"
echo "=================================================" 