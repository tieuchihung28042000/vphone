# Khắc Phục Lỗi 500 Trên VPS

## Vấn đề
Khi rebuild Docker trên VPS, xuất hiện lỗi 500 (Internal Server Error) cho các tính năng mới (Return Import/Export) mặc dù hoạt động tốt ở local.

## Nguyên nhân chính đã khắc phục:

### 1. Models chưa được import trong server.js
**Vấn đề:** Models `ReturnImport` và `ReturnExport` chưa được import trong `backend/server.js`

**Khắc phục:** Đã thêm import:
```javascript
const ReturnImport = require('./models/ReturnImport');
const ReturnExport = require('./models/ReturnExport');
```

### 2. Error handling chưa tốt
**Vấn đề:** Routes mới không có error handling chi tiết

**Khắc phục:** Đã thêm error handling middleware và logging:
```javascript
const handleError = (res, error, message = 'Internal server error') => {
  console.error(`[ReturnImport Error] ${message}:`, error);
  res.status(500).json({ 
    message, 
    error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' 
  });
};
```

### 3. Thiếu logging để debug
**Vấn đề:** Không có logging chi tiết để debug trên VPS

**Khắc phục:** Đã thêm logging cho:
- Route registration
- Model initialization
- MongoDB connection
- Error handling

## Cách khắc phục trên VPS:

### Bước 1: Update code
```bash
cd /path/to/vphone
git pull origin main
```

### Bước 2: Chạy script khắc phục
```bash
./scripts/fix-vps-500.sh
```

### Bước 3: Kiểm tra logs
```bash
docker logs vphone-backend --tail 50
```

### Bước 4: Test endpoints
```bash
./scripts/test-vps.sh
```

## Endpoints để test:

1. **Health check:**
   ```bash
   curl http://localhost:4000/api/health
   ```

2. **Test models:**
   ```bash
   curl http://localhost:4000/api/test-return-models
   ```

3. **Test return import:**
   ```bash
   curl http://localhost:4000/api/return-import
   ```

4. **Test return export:**
   ```bash
   curl http://localhost:4000/api/return-export
   ```

## Nếu vẫn lỗi:

### Kiểm tra logs chi tiết:
```bash
docker logs vphone-backend --follow
```

### Kiểm tra MongoDB connection:
```bash
docker exec -it vphone-backend node -e "
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI).then(() => {
  console.log('MongoDB connected');
  process.exit(0);
}).catch(err => {
  console.error('MongoDB error:', err);
  process.exit(1);
});
"
```

### Rebuild clean:
```bash
docker compose down
docker system prune -f
docker compose build --no-cache
docker compose up -d
```

## Các file đã thay đổi:
- `backend/server.js` - Thêm import models và logging
- `backend/routes/returnImport.js` - Thêm error handling
- `backend/routes/returnExport.js` - Thêm error handling
- `backend/Dockerfile` - Thêm debug commands
- `scripts/fix-vps-500.sh` - Script khắc phục tự động
- `scripts/test-vps.sh` - Script test tự động

## Liên hệ hỗ trợ:
Nếu vẫn gặp vấn đề, vui lòng cung cấp:
1. Output của `docker logs vphone-backend`
2. Output của `./scripts/test-vps.sh`
3. Thông tin môi trường VPS (OS, Docker version, etc.) 