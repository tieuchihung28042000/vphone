#!/bin/bash

echo "🔍 ==========================="
echo "🔍 VPS DEPLOY DEBUG SCRIPT"
echo "🔍 ==========================="

# Kiểm tra thư mục hiện tại
echo ""
echo "📁 Current directory: $(pwd)"
echo "📁 Contents:"
ls -la

# Kiểm tra git status
echo ""
echo "🔍 Git status BEFORE pull:"
git status
echo ""
echo "🔍 Current commit:"
git log --oneline -1

# Pull code mới
echo ""
echo "📥 Pulling latest code..."
git pull origin main

echo ""
echo "🔍 Git status AFTER pull:"
git status
echo ""
echo "🔍 Latest commit after pull:"
git log --oneline -1

# Kiểm tra PM2 processes
echo ""
echo "🔍 Current PM2 processes:"
pm2 list

# Stop all PM2 processes
echo ""
echo "🛑 Stopping all PM2 processes..."
pm2 stop all

# Update backend dependencies
echo ""
echo "📦 Updating backend dependencies..."
cd backend
echo "📍 Current directory: $(pwd)"
npm install
echo ""
echo "🔍 Backend package.json main script:"
grep -A 5 -B 5 "scripts" package.json

# Update frontend dependencies  
cd ../iphone-inventory
echo ""
echo "📦 Updating frontend dependencies..."
echo "📍 Current directory: $(pwd)"
npm install

# Clear all caches
echo ""
echo "🗑️ Clearing all caches..."
rm -rf dist/ node_modules/.vite/ node_modules/.cache/ .vite/
echo "✅ Caches cleared"

# Build frontend
echo ""
echo "🔨 Building frontend..."
npm run build
if [ $? -eq 0 ]; then
    echo "✅ Build successful"
    echo "📁 Build output:"
    ls -la dist/
else
    echo "❌ Build failed!"
    exit 1
fi

# Go back to root
cd ..

# Start PM2 with fresh environment
echo ""
echo "🚀 Starting PM2 processes..."
pm2 restart all --update-env

# Wait a moment for processes to start
sleep 3

# Check PM2 status
echo ""
echo "✅ Final PM2 status:"
pm2 list

# Check nginx
echo ""
echo "🌐 Nginx status:"
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl status nginx --no-pager -l

# Show recent logs
echo ""
echo "📋 Recent PM2 logs (last 20 lines):"
pm2 logs --lines 20

echo ""
echo "🎉 ========================="
echo "🎉 DEPLOY COMPLETED!"
echo "🎉 ========================="
echo ""
echo "💡 Next steps:"
echo "1. Hard refresh browser (Ctrl+F5 / Cmd+Shift+R)"
echo "2. Clear browser cache completely"
echo "3. Try incognito/private mode"
echo "4. Check browser console for errors (F12)"
echo "5. Verify URL is correct: https://app.vphone.vn"
echo ""
echo "🔍 To check if changes are live:"
echo "curl -I https://app.vphone.vn" 