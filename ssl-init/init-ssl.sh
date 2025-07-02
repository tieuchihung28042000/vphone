#!/bin/bash
set -e

# Colors for logging
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[SSL-INIT]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SSL-INIT]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[SSL-INIT]${NC} $1"
}

log_error() {
    echo -e "${RED}[SSL-INIT]${NC} $1"
}

# Get environment variables
DOMAIN=${DOMAIN:-localhost}
SSL_EMAIL=${SSL_EMAIL:-}

log_info "🔐 SSL Init Container khởi động"
log_info "Domain: $DOMAIN"
log_info "Email: $SSL_EMAIL"

# Skip SSL setup for localhost
if [ "$DOMAIN" = "localhost" ] || [ -z "$DOMAIN" ]; then
    log_warning "⚠️  Domain là localhost, bỏ qua SSL setup"
    
    # Create dummy certificates for nginx to start
    mkdir -p /ssl/certs/live/$DOMAIN
    
    # Generate self-signed certificate for localhost
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /ssl/certs/live/$DOMAIN/privkey.pem \
        -out /ssl/certs/live/$DOMAIN/fullchain.pem \
        -subj "/C=VN/ST=HCM/L=HCM/O=VPhone/CN=$DOMAIN"
    
    log_success "✅ Self-signed certificate tạo cho localhost"
    exit 0
fi

# Validate email for Let's Encrypt
if [ -z "$SSL_EMAIL" ]; then
    log_error "❌ SSL_EMAIL không được để trống cho domain thật"
    exit 1
fi

# Check if certificates already exist
if [ -f "/ssl/certs/live/$DOMAIN/fullchain.pem" ] && [ -f "/ssl/certs/live/$DOMAIN/privkey.pem" ]; then
    log_success "✅ SSL certificates đã tồn tại cho $DOMAIN"
    
    # Check if certificates are still valid (more than 30 days)
    if openssl x509 -checkend 2592000 -noout -in "/ssl/certs/live/$DOMAIN/fullchain.pem" > /dev/null 2>&1; then
        log_success "✅ SSL certificates vẫn còn hạn (>30 ngày)"
        exit 0
    else
        log_warning "⚠️  SSL certificates sắp hết hạn, cần renew"
    fi
fi

# Check if we can use webroot mode (nginx ready)
log_info "🔍 Kiểm tra nginx availability..."
if curl -s --connect-timeout 5 http://nginx/.well-known/acme-challenge/test > /dev/null 2>&1; then
    log_success "✅ Nginx sẵn sàng cho webroot mode"
    STANDALONE_MODE=false
else
    log_info "ℹ️  Nginx chưa sẵn sàng, sử dụng standalone mode"
    STANDALONE_MODE=true
fi

# Create SSL certificates
log_info "🔐 Tạo SSL certificates với Let's Encrypt..."

if [ "$STANDALONE_MODE" = "true" ]; then
    # Standalone mode (nginx not ready)
    log_info "🔐 Sử dụng standalone mode để tạo certificate..."
    certbot certonly \
        --standalone \
        --email "$SSL_EMAIL" \
        --agree-tos \
        --no-eff-email \
        --config-dir /ssl/certs \
        --work-dir /ssl/work \
        --logs-dir /ssl/logs \
        -d "$DOMAIN" \
        --non-interactive
else
    # Webroot mode (preferred)
    log_info "🔐 Sử dụng webroot mode để tạo certificate..."
    certbot certonly \
        --webroot \
        --webroot-path=/ssl/webroot \
        --email "$SSL_EMAIL" \
        --agree-tos \
        --no-eff-email \
        --config-dir /ssl/certs \
        --work-dir /ssl/work \
        --logs-dir /ssl/logs \
        -d "$DOMAIN" \
        --non-interactive
fi

if [ $? -eq 0 ]; then
    log_success "✅ SSL certificates tạo thành công cho $DOMAIN"
    
    # Set proper permissions
    chmod -R 644 /ssl/certs/
    
    # Create renewal hook
    cat > /ssl/renewal-hook.sh << 'EOF'
#!/bin/bash
# Reload nginx after certificate renewal
if [ -f /var/run/nginx.pid ]; then
    nginx -s reload
fi
EOF
    chmod +x /ssl/renewal-hook.sh
    
    log_success "✅ SSL setup hoàn tất"
else
    log_error "❌ Không thể tạo SSL certificates"
    
    # Create self-signed as fallback
    log_warning "⚠️  Tạo self-signed certificate làm fallback"
    mkdir -p /ssl/certs/live/$DOMAIN
    
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /ssl/certs/live/$DOMAIN/privkey.pem \
        -out /ssl/certs/live/$DOMAIN/fullchain.pem \
        -subj "/C=VN/ST=HCM/L=HCM/O=VPhone/CN=$DOMAIN"
    
    log_warning "⚠️  Sử dụng self-signed certificate"
fi

log_info "🎉 SSL init container hoàn thành" 