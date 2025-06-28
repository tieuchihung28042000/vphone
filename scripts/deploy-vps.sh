#!/bin/bash

# VPhone Safe Deploy Script
# Sử dụng: ./scripts/deploy-vps.sh

set -e

echo "🚀 STARTING VPHONE SAFE DEPLOY..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/var/www/vphone"
BACKUP_DIR="/backup/$(date +%Y%m%d_%H%M%S)"
BACKEND_SERVICE="vphone-backend"

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

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Verify prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    if ! command_exists pm2; then
        print_error "PM2 not found. Please install PM2 first."
        exit 1
    fi
    
    if ! command_exists nginx; then
        print_error "Nginx not found. Please install Nginx first."
        exit 1
    fi
    
    if ! command_exists mongodump; then
        print_error "MongoDB tools not found. Please install MongoDB tools first."
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

# Create backup
create_backup() {
    print_status "Creating backup at $BACKUP_DIR..."
    
    mkdir -p "$BACKUP_DIR"
    
    # Backup MongoDB
    print_status "Backing up MongoDB..."
    mongodump --db vphone --out "$BACKUP_DIR/" --quiet
    
    # Backup project files
    print_status "Backing up project files..."
    cp -r "$PROJECT_DIR" "$BACKUP_DIR/vphone_old"
    
    # Backup config files
    if [ -f "/etc/nginx/sites-available/vphone" ]; then
        cp /etc/nginx/sites-available/vphone "$BACKUP_DIR/"
    fi
    
    if [ -f "/root/.env" ]; then
        cp /root/.env "$BACKUP_DIR/"
    fi
    
    print_success "Backup completed at $BACKUP_DIR"
}

# Check current services status
check_services() {
    print_status "Checking current services status..."
    
    # Check PM2
    if pm2 status | grep -q "$BACKEND_SERVICE"; then
        print_success "PM2 service $BACKEND_SERVICE is running"
    else
        print_warning "PM2 service $BACKEND_SERVICE not found"
    fi
    
    # Check Nginx
    if systemctl is-active --quiet nginx; then
        print_success "Nginx is running"
    else
        print_warning "Nginx is not running"
    fi
    
    # Check ports
    if netstat -tulpn | grep -q ":3000"; then
        print_success "Port 3000 is in use (backend)"
    else
        print_warning "Port 3000 is not in use"
    fi
}

# Update code from git
update_code() {
    print_status "Updating code from Git..."
    
    cd "$PROJECT_DIR"
    
    # Backup environment files
    print_status "Backing up environment files..."
    if [ -f "iphone-inventory/.env.production" ]; then
        cp iphone-inventory/.env.production iphone-inventory/.env.production.backup
    fi
    
    if [ -f "backend/.env" ]; then
        cp backend/.env backend/.env.backup
    fi
    
    # Stash local changes
    git stash --quiet || true
    
    # Pull latest changes
    print_status "Pulling latest changes..."
    git pull origin main
    
    # Restore environment files
    print_status "Restoring environment files..."
    if [ -f "iphone-inventory/.env.production.backup" ]; then
        cp iphone-inventory/.env.production.backup iphone-inventory/.env.production
    fi
    
    if [ -f "backend/.env.backup" ]; then
        cp backend/.env.backup backend/.env
    fi
    
    print_success "Code updated successfully"
}

# Update dependencies
update_dependencies() {
    print_status "Updating dependencies..."
    
    # Backend dependencies
    print_status "Installing backend dependencies..."
    cd "$PROJECT_DIR/backend"
    npm install --production --silent
    
    # Frontend dependencies
    print_status "Installing frontend dependencies..."
    cd "$PROJECT_DIR/iphone-inventory"
    npm install --silent
    
    print_success "Dependencies updated successfully"
}

# Build frontend
build_frontend() {
    print_status "Building frontend..."
    
    cd "$PROJECT_DIR/iphone-inventory"
    
    # Clean previous build
    rm -rf dist/
    
    # Build production
    npm run build
    
    # Verify build
    if [ -d "dist" ] && [ "$(ls -A dist)" ]; then
        print_success "Frontend build completed successfully"
    else
        print_error "Frontend build failed"
        exit 1
    fi
}

# Restart services
restart_services() {
    print_status "Restarting services..."
    
    # Restart backend
    print_status "Restarting backend service..."
    pm2 restart "$BACKEND_SERVICE" || {
        print_warning "PM2 restart failed, trying to start service..."
        pm2 start "$PROJECT_DIR/backend/server.js" --name "$BACKEND_SERVICE"
    }
    
    # Wait for backend to be ready
    print_status "Waiting for backend to be ready..."
    sleep 5
    
    # Test backend
    if curl -sf http://localhost:3000/api/branches > /dev/null; then
        print_success "Backend is responding"
    else
        print_warning "Backend health check failed, but continuing..."
    fi
    
    # Reload Nginx
    print_status "Reloading Nginx..."
    systemctl reload nginx
    
    print_success "Services restarted successfully"
}

# Test deployment
test_deployment() {
    print_status "Testing deployment..."
    
    # Test backend API
    print_status "Testing backend API..."
    if curl -sf http://localhost:3000/api/branches > /dev/null; then
        print_success "Backend API test passed"
    else
        print_error "Backend API test failed"
        return 1
    fi
    
    # Test MongoDB connection
    print_status "Testing MongoDB connection..."
    if mongosh vphone --eval "db.branches.countDocuments()" --quiet > /dev/null; then
        print_success "MongoDB connection test passed"
    else
        print_error "MongoDB connection test failed"
        return 1
    fi
    
    print_success "All tests passed"
}

# Show deployment summary
show_summary() {
    echo ""
    echo "=================================="
    echo "🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!"
    echo "=================================="
    echo ""
    echo "📊 Deployment Summary:"
    echo "• Backup created at: $BACKUP_DIR"
    echo "• Code updated from Git"
    echo "• Dependencies updated"
    echo "• Frontend rebuilt"
    echo "• Services restarted"
    echo "• Tests passed"
    echo ""
    echo "🔍 Next Steps:"
    echo "1. Test all features on the website"
    echo "2. Monitor logs: pm2 logs $BACKEND_SERVICE"
    echo "3. Check site: curl http://your-domain.com"
    echo ""
    echo "💡 Monitoring Commands:"
    echo "• pm2 status"
    echo "• pm2 logs $BACKEND_SERVICE --follow"
    echo "• systemctl status nginx"
    echo ""
}

# Rollback function
rollback() {
    print_error "Deployment failed. Rolling back..."
    
    if [ -d "$BACKUP_DIR/vphone_old" ]; then
        print_status "Restoring project files..."
        rm -rf "$PROJECT_DIR"
        cp -r "$BACKUP_DIR/vphone_old" "$PROJECT_DIR"
        
        print_status "Rebuilding frontend..."
        cd "$PROJECT_DIR/iphone-inventory"
        npm run build
        
        print_status "Restarting services..."
        pm2 restart "$BACKEND_SERVICE"
        systemctl reload nginx
        
        print_success "Rollback completed"
    else
        print_error "Rollback failed: backup not found"
    fi
}

# Main deployment process
main() {
    echo "🚀 VPhone Safe Deploy Starting..."
    echo "Timestamp: $(date)"
    echo "Backup will be created at: $BACKUP_DIR"
    echo ""
    
    # Set trap for rollback on error
    trap rollback ERR
    
    check_prerequisites
    check_services
    create_backup
    update_code
    update_dependencies
    build_frontend
    restart_services
    test_deployment
    
    # Remove trap as deployment succeeded
    trap - ERR
    
    show_summary
}

# Run main function
main "$@" 