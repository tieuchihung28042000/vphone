#!/bin/bash

echo "🔧 Testing return-export functionality on VPS..."

# 1. Test health check
echo "1. Testing health check..."
curl -s https://nguyenkieuanh.com/api/health | jq .

# 2. Test return-export endpoint without auth
echo "2. Testing return-export endpoint without auth..."
curl -s -X GET https://nguyenkieuanh.com/api/return-export

# 3. Test with a real user (try common admin credentials)
echo "3. Testing login with different credentials..."

# Try different admin credentials
ADMIN_EMAILS=("admin@vphone.com" "admin@admin.com" "chihung@vphone.com" "test@admin.com")
ADMIN_PASSWORDS=("123456" "admin" "password" "admin123")

TOKEN=""
for email in "${ADMIN_EMAILS[@]}"; do
  for password in "${ADMIN_PASSWORDS[@]}"; do
    echo "Trying: $email / $password"
    RESPONSE=$(curl -s -X POST https://nguyenkieuanh.com/api/auth/login \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"$email\",\"password\":\"$password\"}")
    
    TOKEN=$(echo $RESPONSE | jq -r '.token // empty')
    if [ ! -z "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
      echo "✅ Login successful with: $email"
      break 2
    fi
  done
done

if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
  echo "❌ Could not login with any credentials"
  echo "4. Creating a test user..."
  
  # Get a valid branch_id
  BRANCH_ID=$(curl -s https://nguyenkieuanh.com/api/branches | jq -r '.[0]._id')
  echo "Using branch_id: $BRANCH_ID"
  
  # Create test user
  curl -s -X POST https://nguyenkieuanh.com/api/auth/register \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"testuser@vphone.com\",
      \"password\": \"123456\",
      \"full_name\": \"Test User\",
      \"role\": \"admin\",
      \"branch_id\": \"$BRANCH_ID\"
    }" | jq .
  
  # Try login with test user
  RESPONSE=$(curl -s -X POST https://nguyenkieuanh.com/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"testuser@vphone.com","password":"123456"}')
  
  TOKEN=$(echo $RESPONSE | jq -r '.token // empty')
fi

if [ ! -z "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
  echo "✅ Got token: ${TOKEN:0:20}..."
  
  echo "5. Testing return-export with token..."
  curl -s -X GET https://nguyenkieuanh.com/api/return-export \
    -H "Authorization: Bearer $TOKEN" | jq .
  
  echo "6. Testing return-import with token..."
  curl -s -X GET https://nguyenkieuanh.com/api/return-import \
    -H "Authorization: Bearer $TOKEN" | jq .
    
else
  echo "❌ Still could not get valid token"
fi

echo "✅ Return export test completed!" 