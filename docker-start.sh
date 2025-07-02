#!/bin/bash

# VPhone Docker Management Script
# Usage: ./docker-start.sh [action]
# Actions: start, stop, restart, build, logs, status

set -e

ACTION=${1:-start}
ENV_FILE=${ENV_FILE:-.env}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if .env file exists
check_env_file() {
    if [ ! -f "$ENV_FILE" ]; then
        log_warning "File $ENV_FILE không tồn tại. Đang tạo từ env.example..."
        if [ -f "env.example" ]; then
            cp env.example "$ENV_FILE"
            log_success "Đã tạo file $ENV_FILE từ env.example"
            log_warning "Vui lòng kiểm tra và cập nhật các biến môi trường trong $ENV_FILE"
        else
            log_error "File env.example không tồn tại!"
            exit 1
        fi
    fi
}

# Check Docker and Docker Compose
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker chưa được cài đặt!"
        exit 1
    fi

    if ! docker compose version &> /dev/null; then
        log_error "Docker Compose v2 chưa được cài đặt!"
        exit 1
    fi
}

# Start services
start_services() {
    log_info "Khởi động VPhone Docker services..."
    check_env_file
    check_docker
    
    docker compose --env-file "$ENV_FILE" up -d
    
    log_success "Đang khởi động các services..."
    sleep 5
    
    # Wait for services to be healthy
    log_info "Đang kiểm tra trạng thái services..."
    docker compose ps
    
    echo ""
    log_success "VPhone đã khởi động thành công!"
    log_info "Truy cập ứng dụng tại: http://localhost:8080"
    log_info "API Backend: http://localhost:8080/api (proxy) hoặc http://localhost:4001 (direct)"
    log_info "Frontend: http://localhost:3001 (direct)"
    log_info "MongoDB: localhost:27018"
}

# Stop services
stop_services() {
    log_info "Đang dừng VPhone Docker services..."
    docker compose down
    log_success "Đã dừng tất cả services!"
}

# Restart services
restart_services() {
    log_info "Đang khởi động lại VPhone Docker services..."
    stop_services
    sleep 2
    start_services
}

# Build services
build_services() {
    log_info "Đang build lại VPhone Docker images..."
    check_env_file
    check_docker
    
    docker compose --env-file "$ENV_FILE" build --no-cache
    log_success "Build hoàn thành!"
}

# Show logs
show_logs() {
    SERVICE=${2:-}
    if [ -n "$SERVICE" ]; then
        log_info "Hiển thị logs cho service: $SERVICE"
        docker compose logs -f "$SERVICE"
    else
        log_info "Hiển thị logs cho tất cả services..."
        docker compose logs -f
    fi
}

# Show status
show_status() {
    log_info "Trạng thái VPhone Docker services:"
    docker compose ps
    
    echo ""
    log_info "Health check các services:"
    
    # Check MongoDB
    if docker compose exec mongodb mongosh --eval "db.adminCommand('ping')" --quiet &> /dev/null; then
        log_success "MongoDB: Healthy"
    else
        log_error "MongoDB: Unhealthy"
    fi
    
    # Check Backend
    if curl -s http://localhost:4001/api/health &> /dev/null; then
        log_success "Backend: Healthy"
    else
        log_error "Backend: Unhealthy"
    fi
    
    # Check Frontend
    if curl -s http://localhost:3001/health &> /dev/null; then
        log_success "Frontend: Healthy"
    else
        log_error "Frontend: Unhealthy"
    fi
    
    # Check Nginx
    if curl -s http://localhost:8080/health &> /dev/null; then
        log_success "Nginx: Healthy"
    else
        log_error "Nginx: Unhealthy"
    fi
}

# Main script logic
case $ACTION in
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    restart)
        restart_services
        ;;
    build)
        build_services
        ;;
    logs)
        show_logs "$@"
        ;;
    status)
        show_status
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|build|logs [service]|status}"
        echo ""
        echo "Examples:"
        echo "  $0 start          # Khởi động tất cả services"
        echo "  $0 stop           # Dừng tất cả services"
        echo "  $0 restart        # Khởi động lại tất cả services"
        echo "  $0 build          # Build lại images"
        echo "  $0 logs           # Xem logs tất cả services"
        echo "  $0 logs backend   # Xem logs của backend"
        echo "  $0 status         # Kiểm tra trạng thái services"
        exit 1
        ;;
esac 