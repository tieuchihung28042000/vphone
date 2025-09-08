# Hướng Dẫn Deploy Trên VPS

## Bước 1: Pull code mới từ GitHub

```bash
cd ~/sites/nguyenkieuanh.com
git pull origin main
```

## Bước 2: Rebuild Docker với no-cache

```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

## Bước 3: Kiểm tra logs

```bash
docker compose logs vphone-backend --tail 50
```

Bạn sẽ thấy:
- ✅ [MONGODB] User model initialized
- ✅ [MONGODB] Branch model initialized  
- ✅ [MONGODB] ReturnImport model initialized
- ✅ [MONGODB] ReturnExport model initialized

## Bước 4: Test các endpoint

```bash
# Test health
curl -s http://localhost:4000/api/health

# Test user creation endpoint
curl -s http://localhost:4000/api/test-user-creation

# Test branches
curl -s http://localhost:4000/api/branches

# Test user registration với branch thật
BRANCH_ID=$(curl -s http://localhost:4000/api/branches | jq -r '.[0]._id')
BRANCH_NAME=$(curl -s http://localhost:4000/api/branches | jq -r '.[0].name')

curl -s -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"test$(date +%s)@example.com\",
    \"password\": \"123456\",
    \"full_name\": \"Test User\",
    \"role\": \"nhan_vien_ban_hang\",
    \"branch_id\": \"$BRANCH_ID\",
    \"branch_name\": \"$BRANCH_NAME\"
  }"
```

## Bước 5: Test trên website

1. Truy cập https://nguyenkieuanh.com/quan-ly-user
2. Click "Tạo User mới"
3. Điền thông tin và test

## Nếu vẫn lỗi:

### Kiểm tra logs chi tiết:
```bash
docker logs vphone-backend --follow
```

### Restart lại backend:
```bash
docker compose restart vphone-backend
```

### Kiểm tra MongoDB:
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

## Các lỗi thường gặp:

1. **Endpoint không tồn tại** → Chưa pull code mới hoặc chưa rebuild
2. **branch_id validation lỗi** → Sử dụng ObjectId không hợp lệ
3. **CORS error** → Kiểm tra domain trong CORS config
4. **MongoDB connection** → Kiểm tra connection string

## Scripts hỗ trợ:

Sau khi pull code, bạn có thể sử dụng:
- `./scripts/fix-vps-500.sh` - Rebuild hoàn toàn
- `./scripts/quick-deploy.sh` - Restart nhanh  
- `./scripts/test-user-creation.sh` - Test user creation
- `./scripts/test-vps.sh` - Test tổng thể 