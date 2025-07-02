#!/bin/bash
set -e

# Colors for logging
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[SSL-RENEWAL]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SSL-RENEWAL]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[SSL-RENEWAL]${NC} $1"
}

log_error() {
    echo -e "${RED}[SSL-RENEWAL]${NC} $1"
}

# Get environment variables
DOMAIN=${DOMAIN:-localhost}
SSL_EMAIL=${SSL_EMAIL:-}

log_info "🔄 SSL Renewal Service khởi động"
log_info "Domain: $DOMAIN"

# Skip renewal for localhost
if [ "$DOMAIN" = "localhost" ] || [ -z "$DOMAIN" ]; then
    log_warning "⚠️  Domain là localhost, không cần renewal"
    # Still run the loop to keep container alive
    while true; do
        sleep 43200  # 12 hours
        log_info "💤 SSL renewal service đang chạy (localhost mode)"
    done
fi

# Main renewal loop
while true; do
    log_info "🔍 Kiểm tra SSL certificates..."
    
    # Check if certificates exist
    if [ ! -f "/ssl/certs/live/$DOMAIN/fullchain.pem" ]; then
        log_warning "⚠️  SSL certificates không tồn tại, bỏ qua renewal"
        sleep 43200  # 12 hours
        continue
    fi
    
    # Check certificate expiry (renew if less than 30 days)
    if openssl x509 -checkend 2592000 -noout -in "/ssl/certs/live/$DOMAIN/fullchain.pem" > /dev/null 2>&1; then
        log_info "✅ SSL certificates vẫn còn hạn (>30 ngày)"
    else
        log_warning "⚠️  SSL certificates sắp hết hạn (<30 ngày), bắt đầu renewal..."
        
        # Attempt renewal
        if certbot renew --webroot --webroot-path=/ssl/webroot --quiet --deploy-hook "/ssl/renewal-hook.sh"; then
            log_success "✅ SSL certificates đã được gia hạn thành công"
            
            # Reload nginx
            if curl -s -X POST http://nginx:80/reload > /dev/null 2>&1; then
                log_success "✅ Nginx đã được reload"
            else
                log_warning "⚠️  Không thể reload nginx, có thể cần restart manual"
            fi
        else
            log_error "❌ Không thể gia hạn SSL certificates"
            
            # Try to notify admin (if email is configured)
            if [ ! -z "$SSL_EMAIL" ]; then
                log_warning "⚠️  Cần kiểm tra SSL renewal manual cho domain: $DOMAIN"
            fi
        fi
    fi
    
    # Wait 12 hours before next check
    log_info "⏰ Đợi 12 giờ cho lần kiểm tra tiếp theo..."
    sleep 43200  # 12 hours
done 