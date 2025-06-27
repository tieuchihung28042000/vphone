#!/bin/bash

echo "🔄 Khôi phục dữ liệu vphone hoàn chỉnh..."

# Chờ MongoDB khởi động
sleep 10

# Khôi phục dữ liệu từ backup
mongorestore --host mongodb:27017 \
  --username vphone_admin \
  --password vphone_secure_2024 \
  --authenticationDatabase admin \
  --db vphone \
  --drop \
  /docker-entrypoint-initdb.d/backup/vphone/

echo "✅ Khôi phục dữ liệu vphone hoàn tất!" 