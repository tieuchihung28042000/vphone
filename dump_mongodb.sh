#!/bin/bash

# Script để dump dữ liệu MongoDB từ Docker container
# Tạo bởi: Auto

set -e

# Màu sắc cho output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== MongoDB Dump Script ===${NC}"

# Đọc thông tin từ file .env nếu có
if [ -f .env ]; then
    echo -e "${YELLOW}Đang đọc thông tin từ file .env...${NC}"
    source .env
fi

# Container name
CONTAINER_NAME="vphone-mongodb"

# Kiểm tra container có đang chạy không
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    echo "❌ Container $CONTAINER_NAME không đang chạy!"
    exit 1
fi

# Tạo thư mục backup nếu chưa có
BACKUP_DIR="./backups"
mkdir -p "$BACKUP_DIR"

# Tạo tên file backup với timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/mongodb_dump_$TIMESTAMP"

echo -e "${GREEN}Đang dump MongoDB...${NC}"

# Nếu có thông tin authentication từ .env
if [ -n "$MONGO_ROOT_USERNAME" ] && [ -n "$MONGO_ROOT_PASSWORD" ]; then
    echo "Sử dụng authentication từ file .env"
    
    # Nếu có tên database cụ thể
    if [ -n "$MONGO_DB_NAME" ]; then
        echo "Dump database: $MONGO_DB_NAME"
        docker exec "$CONTAINER_NAME" mongodump \
            --username="$MONGO_ROOT_USERNAME" \
            --password="$MONGO_ROOT_PASSWORD" \
            --authenticationDatabase=admin \
            --db="$MONGO_DB_NAME" \
            --out="/tmp/mongodb_dump"
    else
        echo "Dump tất cả databases"
        docker exec "$CONTAINER_NAME" mongodump \
            --username="$MONGO_ROOT_USERNAME" \
            --password="$MONGO_ROOT_PASSWORD" \
            --authenticationDatabase=admin \
            --out="/tmp/mongodb_dump"
    fi
else
    echo -e "${YELLOW}Cảnh báo: Không tìm thấy thông tin authentication trong .env${NC}"
    echo "Đang thử dump không authentication..."
    
    # Thử dump không authentication (nếu MongoDB không yêu cầu auth)
    if [ -n "$MONGO_DB_NAME" ]; then
        docker exec "$CONTAINER_NAME" mongodump \
            --db="$MONGO_DB_NAME" \
            --out="/tmp/mongodb_dump"
    else
        docker exec "$CONTAINER_NAME" mongodump \
            --out="/tmp/mongodb_dump"
    fi
fi

# Copy dump từ container ra host
echo -e "${GREEN}Đang copy dump từ container...${NC}"
docker cp "$CONTAINER_NAME:/tmp/mongodb_dump" "$BACKUP_FILE"

# Xóa dump trong container
docker exec "$CONTAINER_NAME" rm -rf /tmp/mongodb_dump

# Tạo file archive
echo -e "${GREEN}Đang tạo file archive...${NC}"
cd "$BACKUP_DIR"
tar -czf "mongodb_dump_${TIMESTAMP}.tar.gz" "mongodb_dump_${TIMESTAMP}"
rm -rf "mongodb_dump_${TIMESTAMP}"
cd ..

echo -e "${GREEN}✅ Hoàn thành!${NC}"
echo -e "File backup: ${GREEN}$BACKUP_DIR/mongodb_dump_${TIMESTAMP}.tar.gz${NC}"
echo -e "Kích thước: $(du -h "$BACKUP_DIR/mongodb_dump_${TIMESTAMP}.tar.gz" | cut -f1)"


