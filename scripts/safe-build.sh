#!/bin/bash

# Safe Build Script with timeout and memory management
# Sử dụng: ./scripts/safe-build.sh

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

echo "🔨 Safe Frontend Build"
echo "======================"
echo ""

PROJECT_DIR="/vphone"
FRONTEND_DIR="$PROJECT_DIR/iphone-inventory"

# Check if directory exists
if [ ! -d "$FRONTEND_DIR" ]; then
    print_error "Frontend directory not found: $FRONTEND_DIR"
    exit 1
fi

cd "$FRONTEND_DIR" || exit 1

# Check system resources
print_status "Checking system resources..."
FREE_RAM=$(free -m | awk 'NR==2{printf "%.1f", $7/1024}')
echo "Available RAM: ${FREE_RAM}GB"

if (( $(echo "$FREE_RAM < 1.0" | bc -l) )); then
    print_warning "Low RAM detected. Using conservative build settings."
    MEMORY_LIMIT=1024
else
    MEMORY_LIMIT=4096
fi

# Kill any existing build processes
print_status "Killing any existing build processes..."
pkill -f "vite build" 2>/dev/null || true
pkill -f "npm run build" 2>/dev/null || true

# Clean up
print_status "Cleaning up previous build artifacts..."
rm -rf dist .vite

# Check if node_modules is corrupted
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.package-lock.json" ]; then
    print_warning "Node modules missing or corrupted. Reinstalling..."
    rm -rf node_modules package-lock.json
    npm cache clean --force
    npm install
fi

# Build with timeout and memory limit
print_status "Building frontend with memory limit: ${MEMORY_LIMIT}MB..."

# Use timeout to prevent hanging
timeout 300 bash -c "
    NODE_OPTIONS='--max-old-space-size=$MEMORY_LIMIT' \
    VITE_BUILD_CHUNK_SIZE_LIMIT=500 \
    npm run build
"

BUILD_EXIT_CODE=$?

if [ $BUILD_EXIT_CODE -eq 0 ]; then
    print_success "Build completed successfully!"
    
    # Check if dist directory was created
    if [ -d "dist" ] && [ -f "dist/index.html" ]; then
        print_success "Build artifacts verified!"
        
        # Fix permissions
        print_status "Fixing permissions..."
        chown -R www-data:www-data dist 2>/dev/null || {
            print_warning "Could not fix permissions (need sudo)"
            echo "Run: sudo chown -R www-data:www-data $FRONTEND_DIR/dist"
        }
        
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
    echo "Try these solutions:"
    echo "1. Increase VPS RAM"
    echo "2. Build locally and copy dist folder"
    echo "3. Use smaller chunk size: VITE_BUILD_CHUNK_SIZE_LIMIT=200 npm run build"
    exit 1
    
else
    print_error "Build failed with exit code: $BUILD_EXIT_CODE"
    
    # Show last few lines of potential error
    echo ""
    echo "Recent npm log:"
    tail -10 ~/.npm/_logs/*.log 2>/dev/null || echo "No npm logs found"
    
    exit 1
fi

print_success "Safe build completed! ✅" 