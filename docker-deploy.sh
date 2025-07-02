#!/bin/bash

# VPhone All-in-One Deployment Script (HTTP Only)
# Resource Limits: 1 CPU, 1GB RAM, 20GB Storage

set -e  # Exit on any error

echo "🚀 VPhone All-in-One Deployment (HTTP Only)"
echo "============================================"
echo "Resource Limits: 1 CPU, 1GB RAM, 20GB Storage"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# Step 1: Check Docker
print_status "Checking Docker installation..."
if ! command -v docker &> /dev/null; then
    print_error "Docker not found! Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    print_success "Docker installed! Please logout and login again, then run this script."
    exit 0
fi

if ! command -v docker compose &> /dev/null; then
    print_error "Docker Compose not found! Installing..."
    sudo apt update
    sudo apt install docker-compose-plugin -y
fi

print_success "Docker is ready!"

# Step 2: Fix Docker permissions if needed
if ! docker ps &> /dev/null; then
    print_warning "Docker permission issue detected. Fixing..."
    sudo usermod -aG docker $USER
    print_warning "Please run: newgrp docker"
    print_warning "Or logout and login again, then run this script."
    exit 0
fi

# Step 3: Setup environment
print_status "Setting up environment configuration..."
if [ ! -f .env ]; then
    if [ -f env.example ]; then
        cp env.example .env
        print_success "Created .env from template"
    else
        print_error "env.example not found!"
        exit 1
    fi
else
    print_status ".env already exists"
fi

print_status "Current configuration:"
echo "   🌐 Domain: $(grep DOMAIN= .env | cut -d'=' -f2 || echo 'localhost')"

# Step 4: Stop existing containers
print_status "Stopping any existing containers..."
docker compose down 2>/dev/null || true
docker compose -f docker-compose.resource-limited.yml down 2>/dev/null || true

# Step 5: Clean up old data (optional)
echo ""
read -p "🗑️  Remove old data volumes? (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_warning "Removing old volumes..."
    docker volume prune -f
fi

# Step 6: Build images
print_status "Building Docker images (this may take a few minutes)..."
docker compose -f docker-compose.resource-limited.yml build --no-cache

# Step 7: Start services with resource limits
print_status "Starting VPhone with resource limits (HTTP only)..."
print_warning "Resource Limits Applied:"
echo "   🖥️  CPU: 1 core maximum"
echo "   💾 RAM: 1GB maximum" 
echo "   💿 Storage: 20GB maximum"
echo ""

docker compose -f docker-compose.resource-limited.yml up -d

# Step 8: Wait for services
print_status "Waiting for services to initialize..."
echo "This may take 2-5 minutes for first-time setup..."

# Wait and show progress
for i in {1..30}; do
    echo -n "."
    sleep 2
done
echo ""

# Step 9: Check service status
print_status "Checking service status..."
docker compose -f docker-compose.resource-limited.yml ps

# Step 10: Test API
print_status "Testing API connection..."
sleep 5
if curl -s http://localhost/api/branches &> /dev/null; then
    print_success "API is responding!"
else
    print_warning "API may still be starting up..."
fi

# Step 11: Show final status
echo ""
echo "🎉 VPhone Deployment Completed!"
echo "==============================="
echo ""
echo "📊 Resource Usage:"
echo "   🖥️  CPU Limit: 1 core"
echo "   💾 RAM Limit: 1GB"
echo "   💿 Storage Limit: 20GB"
echo ""
echo "🌐 Access Information:"
DOMAIN=$(grep DOMAIN= .env | cut -d'=' -f2 || echo 'localhost')
if [ "$DOMAIN" = "localhost" ] || [ -z "$DOMAIN" ]; then
    echo "   🌍 URL: http://localhost"
else
    echo "   🌍 URL: http://$DOMAIN"
    print_warning "Make sure $DOMAIN points to this server's IP!"
fi
echo ""
echo "🔑 Login Information:"
echo "   📧 Email: admin@vphone.vn"
echo "   👤 Username: admin"
echo "   🔑 Password: 123456"
echo ""
echo "📋 Management Commands:"
echo "   📊 Status: docker compose -f docker-compose.resource-limited.yml ps"
echo "   📈 Monitor: docker stats"
echo "   📝 Logs: docker compose -f docker-compose.resource-limited.yml logs -f"
echo "   🔄 Restart: docker compose -f docker-compose.resource-limited.yml restart"
echo "   🛑 Stop: docker compose -f docker-compose.resource-limited.yml down"
echo ""

# Step 12: Check domain resolution (for production)
if [ "$DOMAIN" != "localhost" ] && [ -n "$DOMAIN" ]; then
    print_status "Checking domain resolution..."
    SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s ipinfo.io/ip 2>/dev/null || echo "unknown")
    DOMAIN_IP=$(nslookup $DOMAIN 2>/dev/null | grep -A1 "Name:" | tail -1 | awk '{print $2}' 2>/dev/null || echo "unknown")
    
    echo "   🖥️  Server IP: $SERVER_IP"
    echo "   🌐 Domain IP: $DOMAIN_IP"
    
    if [[ "$SERVER_IP" == "$DOMAIN_IP" ]]; then
        print_success "✅ Domain correctly points to this server!"
    else
        print_warning "⚠️  Domain may not point to this server yet."
        echo "      Please update DNS: $DOMAIN -> $SERVER_IP"
    fi
fi

echo ""
print_success "🚀 All done! VPhone is ready to use!"
echo "" 