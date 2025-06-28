#!/bin/bash

# VPhone Update and Deploy Script
# Sử dụng: ./scripts/update-and-deploy.sh "commit message"
# Hoặc: ./scripts/update-and-deploy.sh (sẽ dùng commit message mặc định)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

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

print_header() {
    echo -e "${PURPLE}$1${NC}"
}

# Get commit message from parameter or use default
get_commit_message() {
    if [ -n "$1" ]; then
        echo "$1"
    else
        echo "Fix: Cập nhật và sửa lỗi hệ thống - $(date '+%Y-%m-%d %H:%M:%S')"
    fi
}

# Show current status
show_git_status() {
    print_header "📋 TRẠNG THÁI HIỆN TẠI:"
    echo ""
    
    # Check if we're in a git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        print_error "Không phải là Git repository!"
        exit 1
    fi
    
    # Show current branch
    CURRENT_BRANCH=$(git branch --show-current)
    print_status "Nhánh hiện tại: $CURRENT_BRANCH"
    
    # Show uncommitted changes
    if ! git diff --quiet || ! git diff --cached --quiet; then
        print_warning "Có thay đổi chưa commit:"
        git status --porcelain
    else
        print_success "Không có thay đổi chưa commit"
    fi
    
    # Show untracked files
    UNTRACKED=$(git ls-files --others --exclude-standard)
    if [ -n "$UNTRACKED" ]; then
        print_warning "Có file chưa được track:"
        echo "$UNTRACKED"
    fi
    
    echo ""
}

# Cleanup unnecessary files
cleanup_files() {
    print_status "Dọn dẹp file không cần thiết..."
    
    # Remove commonly unwanted files
    find . -name ".DS_Store" -delete 2>/dev/null || true
    find . -name "*.log" -delete 2>/dev/null || true
    find . -name "node_modules" -type d -prune -exec rm -rf {} + 2>/dev/null || true
    find . -name "dist" -type d -prune -exec rm -rf {} + 2>/dev/null || true
    
    # Remove backup files
    find . -name "*.backup" -delete 2>/dev/null || true
    find . -name "*~" -delete 2>/dev/null || true
    
    print_success "Dọn dẹp hoàn tất"
}

# Add and commit changes
commit_changes() {
    local commit_message="$1"
    
    print_header "📝 COMMIT THAY ĐỔI:"
    echo ""
    
    print_status "Commit message: $commit_message"
    
    # Add all changes (including untracked files)
    print_status "Thêm tất cả thay đổi..."
    git add .
    
    # Show what will be committed
    if git diff --cached --quiet; then
        print_warning "Không có thay đổi nào để commit"
        return 0
    fi
    
    print_status "Các file sẽ được commit:"
    git diff --cached --name-only | while read file; do
        echo "  + $file"
    done
    
    # Commit changes
    print_status "Đang commit..."
    git commit -m "$commit_message"
    
    print_success "Commit thành công!"
    echo ""
}

# Push to remote
push_to_remote() {
    print_header "🚀 PUSH LÊN GIT REPOSITORY:"
    echo ""
    
    local current_branch=$(git branch --show-current)
    
    print_status "Đang push nhánh '$current_branch' lên origin..."
    
    # Push with upstream tracking
    if git push -u origin "$current_branch"; then
        print_success "Push thành công!"
    else
        print_error "Push thất bại!"
        return 1
    fi
    
    echo ""
}

# Deploy to VPS
deploy_to_vps() {
    print_header "🏗️  DEPLOY LÊN VPS:"
    echo ""
    
    # Check if deploy script exists
    if [ ! -f "scripts/deploy-vps.sh" ]; then
        print_error "Không tìm thấy script deploy-vps.sh!"
        return 1
    fi
    
    print_status "Chạy script deploy..."
    
    # Make deploy script executable
    chmod +x scripts/deploy-vps.sh
    
    # Run deploy script
    if scripts/deploy-vps.sh; then
        print_success "Deploy thành công!"
    else
        print_error "Deploy thất bại!"
        return 1
    fi
    
    echo ""
}

# Show summary
show_summary() {
    print_header "🎉 HOÀN THÀNH CẬP NHẬT VÀ DEPLOY!"
    echo ""
    echo "=================================="
    echo "✅ Summary:"
    echo "  • Code đã được commit và push"
    echo "  • VPS đã được cập nhật"
    echo "  • Services đã được restart"
    echo "  • Tests đã pass"
    echo ""
    echo "🔍 Kiểm tra:"
    echo "  • Website: http://your-domain.com"
    echo "  • Backend API: http://your-domain.com/api/branches"
    echo ""
    echo "📊 Monitoring:"
    echo "  • pm2 status"
    echo "  • pm2 logs --follow"
    echo "  • systemctl status nginx"
    echo ""
    echo "⏰ Thời gian hoàn thành: $(date)"
    echo "=================================="
    echo ""
}

# Confirmation prompt
confirm_action() {
    echo ""
    print_warning "⚠️  BẠN SẮP THỰC HIỆN CẬP NHẬT VÀ DEPLOY!"
    echo ""
    echo "Các bước sẽ được thực hiện:"
    echo "1. Dọn dẹp file không cần thiết"
    echo "2. Add và commit tất cả thay đổi"
    echo "3. Push lên Git repository"
    echo "4. Deploy lên VPS"
    echo "5. Restart services và test"
    echo ""
    
    read -p "Bạn có chắc chắn muốn tiếp tục? (y/N): " -n 1 -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warning "Hủy bỏ thao tác"
        exit 0
    fi
    echo ""
}

# Error handling
handle_error() {
    print_error "Có lỗi xảy ra tại dòng $1"
    echo ""
    print_warning "Các bước đã thực hiện có thể cần được rollback thủ công"
    echo ""
    exit 1
}

# Main function
main() {
    # Set error handler
    trap 'handle_error $LINENO' ERR
    
    print_header "🚀 VPHONE UPDATE AND DEPLOY SCRIPT"
    echo ""
    echo "Timestamp: $(date)"
    echo ""
    
    # Get commit message
    local commit_message=$(get_commit_message "$1")
    
    # Show current status
    show_git_status
    
    # Ask for confirmation
    confirm_action
    
    # Execute steps
    cleanup_files
    commit_changes "$commit_message"
    push_to_remote
    deploy_to_vps
    
    # Show summary
    show_summary
}

# Help function
show_help() {
    echo "VPhone Update and Deploy Script"
    echo ""
    echo "Sử dụng:"
    echo "  $0                          # Sử dụng commit message mặc định"
    echo "  $0 \"message\"                # Sử dụng commit message tùy chỉnh"
    echo "  $0 --help                   # Hiển thị help"
    echo ""
    echo "Ví dụ:"
    echo "  $0 \"Fix: Sửa lỗi đăng nhập\""
    echo "  $0 \"Feature: Thêm chức năng báo cáo\""
    echo ""
}

# Check parameters
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    show_help
    exit 0
fi

# Run main function
main "$1" 