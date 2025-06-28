#!/bin/bash

# Simple Git Push Script
# Sử dụng: ./scripts/git-push.sh "optional message"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
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

# Get commit message
if [ -n "$1" ]; then
    COMMIT_MSG="$1"
else
    COMMIT_MSG="Update: $(date '+%Y-%m-%d %H:%M:%S')"
fi

echo "🚀 Git Push Script"
echo "==================="
echo ""

# Show current status
print_status "Current branch: $(git branch --show-current)"
print_status "Commit message: $COMMIT_MSG"
echo ""

# Add all changes
print_status "Adding all changes..."
git add .

# Check if there are changes to commit
if git diff --cached --quiet; then
    print_warning "No changes to commit"
    exit 0
fi

# Show what will be committed
print_status "Files to be committed:"
git diff --cached --name-only | sed 's/^/  /'
echo ""

# Commit
print_status "Committing..."
git commit -m "$COMMIT_MSG"

# Push
print_status "Pushing to origin..."
git push

print_success "Done! ✅" 