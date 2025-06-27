#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

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

# Check if running on macOS or Linux
if [[ "$OSTYPE" == "darwin"* ]]; then
    IS_MACOS=true
else
    IS_MACOS=false
fi

# Function to install dependencies
install_dependencies() {
    print_header "INSTALLING DEPENDENCIES"
    
    if $IS_MACOS; then
        # macOS installation
        print_status "Installing dependencies for macOS..."
        
        # Check if Homebrew is installed
        if ! command -v brew &> /dev/null; then
            print_status "Installing Homebrew..."
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        fi
        
        # Install Node.js
        if ! command -v node &> /dev/null; then
            print_status "Installing Node.js..."
            brew install node
        fi
        
        # Install MongoDB
        if ! command -v mongod &> /dev/null; then
            print_status "Installing MongoDB..."
            brew tap mongodb/brew
            brew install mongodb-community
        fi
        
        # Install PM2
        if ! command -v pm2 &> /dev/null; then
            print_status "Installing PM2..."
            npm install -g pm2
        fi
        
        # Install nginx
        if ! command -v nginx &> /dev/null; then
            print_status "Installing nginx..."
            brew install nginx
        fi
        
    else
        # Linux installation
        print_status "Installing dependencies for Linux..."
        
        # Update package list
        sudo apt update
        
        # Install Node.js
        if ! command -v node &> /dev/null; then
            print_status "Installing Node.js..."
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
            sudo apt-get install -y nodejs
        fi
        
        # Install MongoDB
        if ! command -v mongod &> /dev/null; then
            print_status "Installing MongoDB..."
            curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
            echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
            sudo apt-get update
            sudo apt-get install -y mongodb-org
        fi
        
        # Install PM2
        if ! command -v pm2 &> /dev/null; then
            print_status "Installing PM2..."
            sudo npm install -g pm2
        fi
        
        # Install nginx
        if ! command -v nginx &> /dev/null; then
            print_status "Installing nginx..."
            sudo apt install -y nginx
        fi
    fi
    
    print_status "All dependencies installed successfully!"
}

# Function to setup MongoDB
setup_mongodb() {
    print_header "SETTING UP MONGODB"
    
    if $IS_MACOS; then
        # macOS MongoDB setup
        print_status "Starting MongoDB service (macOS)..."
        brew services start mongodb/brew/mongodb-community
        sleep 5
    else
        # Linux MongoDB setup
        print_status "Starting MongoDB service (Linux)..."
        sudo systemctl start mongod
        sudo systemctl enable mongod
        sleep 5
    fi
    
    # Create database and user
    print_status "Setting up database and user..."
    
    # Check if MongoDB is running
    if ! mongosh --eval "db.runCommand('ping')" > /dev/null 2>&1; then
        print_warning "MongoDB not responding, trying to start..."
        sleep 10
    fi
    
    # Create user if not exists
    mongosh --eval "
    try {
        use admin;
        db.createUser({
            user: 'vphone_admin',
            pwd: 'vphone_secure_2024',
            roles: [
                { role: 'userAdminAnyDatabase', db: 'admin' },
                { role: 'readWriteAnyDatabase', db: 'admin' }
            ]
        });
        print('User created successfully!');
    } catch(e) {
        print('User might already exist: ' + e.message);
    }
    
    use vphone;
    db.createCollection('users');
    print('MongoDB setup completed!');
    " 2>/dev/null || print_warning "MongoDB setup completed with warnings"
    
    print_status "MongoDB setup completed!"
}

# Function to restore database
restore_database() {
    print_header "RESTORING DATABASE"
    
    if [ -d "./mongodb-data/vphone-complete-backup/vphone" ]; then
        print_status "Restoring from backup..."
        mongorestore --host localhost:27017 --authenticationDatabase admin -u vphone_admin -p vphone_secure_2024 --db vphone ./mongodb-data/vphone-complete-backup/vphone/ 2>/dev/null || print_warning "Restore completed with warnings"
        print_status "Database restored successfully!"
    else
        print_warning "No backup found, skipping restore..."
    fi
}

# Function to setup backend
setup_backend() {
    print_header "SETTING UP BACKEND"
    
    cd backend
    
    # Install dependencies
    print_status "Installing backend dependencies..."
    npm install
    
    # Create .env file from .env_test template
    print_status "Creating .env file from .env_test template..."
    if [ -f ".env_test" ]; then
        cp .env_test .env
        print_status "Copied .env_test to .env successfully!"
    else
        # Fallback to create .env manually
        print_warning ".env_test not found, creating .env manually..."
        cat > .env << EOF
MONGODB_URI=mongodb://vphone_admin:vphone_secure_2024@localhost:27017/vphone?authSource=admin
JWT_SECRET=mh2!#F8m@kd%$a7LzQxT9^v!w
EMAIL_USER=vphone24h3@gmail.com
EMAIL_PASS=ftxhkismjvdqzawp
NODE_ENV=production
PORT=4000
EOF
    fi
    
    cd ..
    print_status "Backend setup completed!"
}

# Function to setup frontend
setup_frontend() {
    print_header "SETTING UP FRONTEND"
    
    cd iphone-inventory
    
    # Install dependencies
    print_status "Installing frontend dependencies..."
    npm install
    
    # Create .env file for build
    if [ "$1" = "local" ]; then
        VITE_API_URL="http://localhost:8080/api"
    else
        VITE_API_URL="http://app.vphone.vn/api"
    fi
    
    print_status "Creating .env file with API_URL: $VITE_API_URL"
    cat > .env << EOF
VITE_API_URL=$VITE_API_URL
EOF
    
    # Build frontend
    print_status "Building frontend..."
    npm run build
    
    cd ..
    print_status "Frontend setup completed!"
}

# Function to setup nginx
setup_nginx() {
    print_header "SETTING UP NGINX"
    
    if [ "$1" = "local" ]; then
        # Local nginx config
        print_status "Creating local nginx config..."
        
        if $IS_MACOS; then
            # macOS nginx config
            sudo tee /usr/local/etc/nginx/servers/vphone.conf > /dev/null << EOF
server {
    listen 8080;
    server_name localhost;
    
    root $(pwd)/iphone-inventory/dist;
    index index.html;
    
    client_max_body_size 50M;
    
    # API routes
    location /api/ {
        proxy_pass http://localhost:4000/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Health check
    location /health {
        proxy_pass http://localhost:4000/health;
        access_log off;
    }
    
    # Frontend routes
    location / {
        try_files \$uri \$uri/ /index.html;
    }
    
    # Static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF
            
            # Test and start nginx
            sudo nginx -t && brew services restart nginx
            
        else
            # Linux nginx config
            sudo tee /etc/nginx/sites-available/vphone > /dev/null << EOF
server {
    listen 8080;
    server_name localhost;
    
    root $(pwd)/iphone-inventory/dist;
    index index.html;
    
    client_max_body_size 50M;
    
    # API routes
    location /api/ {
        proxy_pass http://localhost:4000/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Health check
    location /health {
        proxy_pass http://localhost:4000/health;
        access_log off;
    }
    
    # Frontend routes
    location / {
        try_files \$uri \$uri/ /index.html;
    }
    
    # Static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF
            
            sudo ln -sf /etc/nginx/sites-available/vphone /etc/nginx/sites-enabled/
            sudo nginx -t && sudo systemctl restart nginx
        fi
        
    else
        # Production nginx config (NO SSL)
        print_status "Creating production nginx config (HTTP only)..."
        
        sudo tee /etc/nginx/sites-available/vphone-prod > /dev/null << EOF
server {
    listen 80;
    server_name app.vphone.vn;
    
    root $(pwd)/iphone-inventory/dist;
    index index.html;
    
    client_max_body_size 50M;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # API routes
    location /api/ {
        proxy_pass http://localhost:4000/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Health check
    location /health {
        proxy_pass http://localhost:4000/health;
        access_log off;
    }
    
    # Frontend routes
    location / {
        try_files \$uri \$uri/ /index.html;
    }
    
    # Static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF
        
        # Remove default nginx site
        sudo rm -f /etc/nginx/sites-enabled/default
        sudo ln -sf /etc/nginx/sites-available/vphone-prod /etc/nginx/sites-enabled/
        sudo nginx -t && sudo systemctl restart nginx
    fi
    
    print_status "Nginx setup completed!"
}

# Function to start services with PM2
start_services() {
    print_header "STARTING SERVICES WITH PM2"
    
    # Stop existing PM2 processes
    pm2 delete all 2>/dev/null || true
    
    # Start backend
    print_status "Starting backend with PM2..."
    cd backend
    pm2 start server.js --name "vphone-backend" --env production
    cd ..
    
    # Save PM2 configuration
    pm2 save
    
    # Setup PM2 startup (only on Linux)
    if ! $IS_MACOS; then
        pm2 startup | grep "sudo" | bash 2>/dev/null || true
    fi
    
    print_status "Services started successfully!"
}

# Function to show status
show_status() {
    print_header "SYSTEM STATUS"
    
    print_status "PM2 Processes:"
    pm2 list
    
    print_status "MongoDB Status:"
    if $IS_MACOS; then
        brew services list | grep mongodb || echo "MongoDB status unknown"
    else
        sudo systemctl status mongod --no-pager -l | head -10
    fi
    
    print_status "Nginx Status:"
    if $IS_MACOS; then
        brew services list | grep nginx || echo "Nginx status unknown"
    else
        sudo systemctl status nginx --no-pager -l | head -10
    fi
}

# Function to show logs
show_logs() {
    echo "Which logs do you want to see?"
    echo "1) Backend logs"
    echo "2) PM2 logs (all)"
    echo "3) MongoDB logs"
    echo "4) Nginx logs"
    read -p "Enter your choice (1-4): " log_choice
    
    case $log_choice in
        1)
            pm2 logs vphone-backend
            ;;
        2)
            pm2 logs
            ;;
        3)
            if $IS_MACOS; then
                tail -f /usr/local/var/log/mongodb/mongo.log 2>/dev/null || echo "MongoDB logs not found"
            else
                sudo tail -f /var/log/mongodb/mongod.log 2>/dev/null || echo "MongoDB logs not found"
            fi
            ;;
        4)
            if $IS_MACOS; then
                tail -f /usr/local/var/log/nginx/error.log 2>/dev/null || echo "Nginx logs not found"
            else
                sudo tail -f /var/log/nginx/error.log 2>/dev/null || echo "Nginx logs not found"
            fi
            ;;
        *)
            print_error "Invalid choice!"
            ;;
    esac
}

# Function to cleanup
cleanup() {
    print_header "CLEANING UP"
    
    # Stop PM2 processes
    pm2 delete all 2>/dev/null || true
    
    # Stop services
    if $IS_MACOS; then
        brew services stop nginx 2>/dev/null || true
        brew services stop mongodb/brew/mongodb-community 2>/dev/null || true
    else
        sudo systemctl stop nginx 2>/dev/null || true
        sudo systemctl stop mongod 2>/dev/null || true
    fi
    
    print_status "Cleanup completed!"
}

# Main menu
show_menu() {
    print_header "VPHONE PM2 DEPLOYMENT TOOL"
    echo "Select deployment option:"
    echo ""
    echo "🏠  1) Deploy to LOCAL (localhost:8080)"
    echo "🌐  2) Deploy to PRODUCTION (app.vphone.vn - HTTP only)"
    echo "📋  3) Show logs"
    echo "📊  4) Show status"
    echo "🗑️  5) Cleanup services"
    echo "🔧  6) Install dependencies only"
    echo "❌  7) Exit"
    echo ""
}

# Deploy local
deploy_local() {
    print_header "DEPLOYING TO LOCAL ENVIRONMENT"
    
    install_dependencies
    setup_mongodb
    restore_database
    setup_backend
    setup_frontend "local"
    setup_nginx "local"
    start_services
    
    print_status "Local deployment completed!"
    echo -e "${CYAN}Access your app at: http://localhost:8080${NC}"
    echo -e "${CYAN}Backend API: http://localhost:8080/api${NC}"
    
    show_status
}

# Deploy production
deploy_production() {
    print_header "DEPLOYING TO PRODUCTION ENVIRONMENT"
    
    if $IS_MACOS; then
        print_error "Production deployment should be run on Linux VPS!"
        exit 1
    fi
    
    install_dependencies
    setup_mongodb
    restore_database
    setup_backend
    setup_frontend "production"
    setup_nginx "production"
    start_services
    
    print_status "Production deployment completed!"
    echo -e "${CYAN}Access your app at: http://app.vphone.vn${NC}"
    echo -e "${CYAN}Backend API: http://app.vphone.vn/api${NC}"
    echo -e "${YELLOW}Note: Using HTTP only (no SSL)${NC}"
    
    show_status
}

# Main script
main() {
    if [ "$1" = "local" ]; then
        deploy_local
        exit 0
    elif [ "$1" = "prod" ] || [ "$1" = "production" ]; then
        deploy_production
        exit 0
    fi
    
    while true; do
        show_menu
        read -p "Enter your choice (1-7): " choice
        
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
                show_status
                ;;
            5)
                cleanup
                ;;
            6)
                install_dependencies
                ;;
            7)
                print_status "Goodbye!"
                exit 0
                ;;
            *)
                print_error "Invalid choice! Please enter 1-7."
                ;;
        esac
        
        echo ""
        read -p "Press Enter to continue..."
        clear
    done
}

# Run main function
main "$@" 