#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="/home/chihung2k/sites/nguyenkieuanh.com"
cd "$ROOT_DIR"

if [ ! -f .env ]; then
  echo "❌ Thiếu file .env ở $ROOT_DIR/.env" >&2
  exit 1
fi

# Parse env file an toàn (không eval, tránh ${...} expansion)
parse_env() {
  local key="$1"
  awk -F'=' -v k="$key" 'BEGIN{IGNORECASE=0} $0 !~ /^\s*#/ {gsub(/\r/,""); if ($1==k) {sub(/^\s*/,"",$2); sub(/\s*$/ ,"",$2); print $2; exit}}' .env
}

echo "🚀 Build & start containers"
docker compose up -d --build

echo "⏳ Chờ MongoDB healthy..."
for i in {1..30}; do
  if docker inspect -f '{{.State.Health.Status}}' vphone-mongodb 2>/dev/null | grep -q healthy; then
    echo "✅ MongoDB healthy"
    break
  fi
  sleep 2
  if [ "$i" -eq 30 ]; then
    echo "❌ MongoDB chưa healthy sau 60s" >&2
    exit 1
  fi
done

echo "⏳ Chờ Backend healthy..."
for i in {1..30}; do
  if docker inspect -f '{{.State.Health.Status}}' vphone-backend 2>/dev/null | grep -q healthy; then
    echo "✅ Backend healthy"
    break
  fi
  sleep 2
  if [ "$i" -eq 30 ]; then
    echo "❌ Backend chưa healthy sau 60s" >&2
    exit 1
  fi
done

# Seed admin user nếu chưa có
DB_NAME="$(parse_env MONGO_DB_NAME)"
DB_NAME="${DB_NAME:-vphone_production}"
MONGO_USER="$(parse_env MONGO_ROOT_USERNAME)"
MONGO_USER="${MONGO_USER:-admin}"
MONGO_PASS="$(parse_env MONGO_ROOT_PASSWORD)"
MONGO_PASS="${MONGO_PASS:-@654321}"

echo "🔎 Kiểm tra user trong MongoDB ($DB_NAME.users)"
COUNT=$(docker exec -i vphone-mongodb mongosh --quiet -u "$MONGO_USER" -p "$MONGO_PASS" --authenticationDatabase admin --eval "db.getSiblingDB(\"$DB_NAME\").users.countDocuments()" || echo 0)
COUNT=${COUNT:-0}
echo "📊 users.countDocuments() = $COUNT"

if [ "$COUNT" -eq 0 ]; then
  echo "🧩 Seed admin mặc định (admin@vphone.vn / 123456)"
  HASH=$(docker exec -i vphone-backend node -e "console.log(require('bcrypt').hashSync('123456',10))")
  docker exec -i vphone-mongodb mongosh --quiet -u "$MONGO_USER" -p "$MONGO_PASS" --authenticationDatabase admin --eval "
    const db = db.getSiblingDB(\"$DB_NAME\");
    db.users.insertOne({
      email: 'admin@vphone.vn',
      username: 'admin',
      password: '$HASH',
      role: 'admin',
      approved: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    print('✅ Đã tạo admin mặc định.');
  "
else
  echo "✅ DB đã có user, bỏ qua bước seed."
fi

BACKEND_PORT_VAL="$(parse_env BACKEND_PORT)"
BACKEND_PORT_VAL="${BACKEND_PORT_VAL:-4000}"
echo "🔍 Kiểm tra health endpoint backend"
curl -sS http://localhost:${BACKEND_PORT_VAL}/api/health || true

echo "🎉 Hoàn tất deploy"


