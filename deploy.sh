#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${PURPLE}================================${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}================================${NC}"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
}

# Function to cleanup containers
cleanup() {
    print_status "Stopping and removing existing containers..."
    docker-compose -f docker-compose.local.yml down 2>/dev/null || true
    docker-compose -f docker-compose.prod.yml down 2>/dev/null || true
    docker-compose down 2>/dev/null || true
    
    # Remove orphaned containers
    docker container prune -f
    
    print_status "Cleanup completed"
}

# Function to deploy local environment
deploy_local() {
    print_header "DEPLOYING TO LOCAL ENVIRONMENT"
    
    cleanup
    
    print_status "Building and starting local containers..."
    docker-compose -f docker-compose.local.yml up --build -d
    
    if [ $? -eq 0 ]; then
        print_status "Local deployment successful!"
        echo -e "${CYAN}Access your app at: http://localhost:8080${NC}"
        echo -e "${CYAN}Backend API: http://localhost:8080/api${NC}"
        echo -e "${CYAN}MongoDB: localhost:27017${NC}"
        
        print_status "Waiting for services to be ready..."
        sleep 10
        
        # Health check
        if curl -s http://localhost:8080/health > /dev/null; then
            print_status "✅ Health check passed!"
        else
            print_warning "⚠️ Health check failed, but services may still be starting..."
        fi
        
        # Show logs
        echo ""
        print_status "Container status:"
        docker-compose -f docker-compose.local.yml ps
    else
        print_error "Local deployment failed!"
        exit 1
    fi
}

# Function to deploy production environment
deploy_production() {
    print_header "DEPLOYING TO PRODUCTION ENVIRONMENT"
    
    cleanup
    
    print_status "Building and starting production containers..."
    docker-compose -f docker-compose.prod.yml up --build -d
    
    if [ $? -eq 0 ]; then
        print_status "Production deployment successful!"
        echo -e "${CYAN}Access your app at: https://app.vphone.vn${NC}"
        echo -e "${CYAN}Backend API: https://app.vphone.vn/api${NC}"
        
        print_status "Waiting for services to be ready..."
        sleep 15
        
        # Show logs
        echo ""
        print_status "Container status:"
        docker-compose -f docker-compose.prod.yml ps
        
        print_warning "Note: Make sure SSL certificates are properly configured!"
        print_warning "Run 'certbot --nginx -d app.vphone.vn' if SSL is not working"
    else
        print_error "Production deployment failed!"
        exit 1
    fi
}

# Function to show logs
show_logs() {
    echo "Which environment logs do you want to see?"
    echo "1) Local"
    echo "2) Production"
    read -p "Enter your choice (1-2): " log_choice
    
    case $log_choice in
        1)
            docker-compose -f docker-compose.local.yml logs -f
            ;;
        2)
            docker-compose -f docker-compose.prod.yml logs -f
            ;;
        *)
            print_error "Invalid choice!"
            ;;
    esac
}

# Function to backup database
backup_database() {
    print_status "Creating database backup..."
    timestamp=$(date +%Y%m%d_%H%M%S)
    backup_dir="./mongodb-data/backup_$timestamp"
    
    mkdir -p "$backup_dir"
    
    docker exec vphone-mongodb mongodump --authenticationDatabase admin -u vphone_admin -p vphone_secure_2024 --db vphone --out /data/backup
    docker cp vphone-mongodb:/data/backup/vphone "$backup_dir/"
    
    print_status "Backup completed: $backup_dir"
}

# Main menu
show_menu() {
    print_header "VPHONE DEPLOYMENT TOOL"
    echo "Select deployment option:"
    echo ""
    echo "🏠  1) Deploy to LOCAL (localhost:8080)"
    echo "🌐  2) Deploy to PRODUCTION (app.vphone.vn)"
    echo "📋  3) Show logs"
    echo "🗑️  4) Cleanup containers"
    echo "💾  5) Backup database"
    echo "❌  6) Exit"
    echo ""
}

# Main script
main() {
    check_docker
    
    if [ "$1" = "local" ]; then
        deploy_local
        exit 0
    elif [ "$1" = "prod" ] || [ "$1" = "production" ]; then
        deploy_production
        exit 0
    fi
    
    while true; do
        show_menu
        read -p "Enter your choice (1-6): " choice
        
        case $choice in
            1)
                deploy_local
                break
                ;;
            2)
                deploy_production
                break
                ;;
            3)
                show_logs
                ;;
            4)
                cleanup
                ;;
            5)
                backup_database
                ;;
            6)
                print_status "Goodbye!"
                exit 0
                ;;
            *)
                print_error "Invalid choice! Please enter 1-6."
                ;;
        esac
        
        echo ""
        read -p "Press Enter to continue..."
        clear
    done
}

# Run main function
main "$@" 