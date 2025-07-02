#!/bin/bash

# VPhone Production Deployment Script
# For domain: Nguyenkieuanh.com

set -e  # Exit on any error

echo "🚀 VPhone Production Deployment for Nguyenkieuanh.com"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_warning "Running as root. Make sure this is intended for production deployment."
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

print_status "Creating production environment file..."

# Create .env file for production
cat > .env << 'EOF'
# VPhone Production Configuration for Nguyenkieuanh.com
DOMAIN=Nguyenkieuanh.com
SSL_EMAIL=admin@nguyenkieuanh.com

# MongoDB Configuration  
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=@654321
MONGO_DB_NAME=vphone_production

# JWT Secret (production-grade)
JWT_SECRET=VPhone2025!ProductionJWT#NguyenKieuAnh$SecureKey

# Email Configuration
EMAIL_USER=vphone24h3@gmail.com
EMAIL_PASS=ftxhkismjvdqzawp

# Production Environment
NODE_ENV=production
EOF

print_success "Created .env file with production configuration"

# Stop any existing containers
print_status "Stopping existing containers..."
docker compose down 2>/dev/null || true

# Remove old volumes if requested
read -p "Do you want to remove old data volumes? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_warning "Removing old volumes..."
    docker volume prune -f
fi

# Build all images
print_status "Building Docker images..."
docker compose build --no-cache

# Start services
print_status "Starting production services..."
docker compose up -d

# Wait for services to be healthy
print_status "Waiting for services to be healthy..."
sleep 10

# Check service status
print_status "Checking service status..."
docker compose ps

# Show logs for SSL init
print_status "Checking SSL initialization..."
docker compose logs ssl-init

echo ""
print_success "🎉 Production deployment completed!"
echo ""
echo "📋 Production Information:"
echo "   🌐 Domain: https://Nguyenkieuanh.com"
echo "   📧 Admin Email: admin@vphone.vn"
echo "   👤 Admin Username: admin"
echo "   🔑 Admin Password: 123456"
echo ""
echo "🔐 SSL Certificate:"
echo "   - Let's Encrypt certificate will be auto-generated"
echo "   - Contact email: admin@nguyenkieuanh.com"
echo "   - May take 2-5 minutes for first-time setup"
echo ""
echo "📝 Important Next Steps:"
echo "   1. ✅ Make sure domain Nguyenkieuanh.com points to this server IP"
echo "   2. ⏳ Wait for SSL certificate generation (check logs)"
echo "   3. 🌐 Access https://Nguyenkieuanh.com"
echo "   4. 🔒 Change default admin password after first login"
echo ""
echo "📊 Monitoring Commands:"
echo "   📋 All logs: docker compose logs -f"
echo "   🔐 SSL logs: docker compose logs -f ssl-init ssl-renewal"
echo "   🖥️  Backend logs: docker compose logs -f backend"
echo "   🌐 Frontend logs: docker compose logs -f frontend"
echo "   📊 Service status: docker compose ps"
echo ""
echo "🔧 Management Commands:"
echo "   🛑 Stop: docker compose down"
echo "   🔄 Restart: docker compose restart"
echo "   📊 Status: docker compose ps"
echo ""

# Check if domain resolves to this server
print_status "Checking domain resolution..."
SERVER_IP=$(curl -s ifconfig.me || curl -s ipinfo.io/ip || echo "unknown")
DOMAIN_IP=$(nslookup Nguyenkieuanh.com | grep -A1 "Name:" | tail -1 | awk '{print $2}' 2>/dev/null || echo "unknown")

echo "   🖥️  Server IP: $SERVER_IP"
echo "   🌐 Domain IP: $DOMAIN_IP"

if [[ "$SERVER_IP" == "$DOMAIN_IP" ]]; then
    print_success "Domain correctly points to this server!"
else
    print_warning "Domain may not point to this server yet. Please check DNS settings."
fi

echo ""
print_success "Deployment script completed! 🚀" 