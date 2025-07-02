# Sử dụng Node.js 18 Alpine image
FROM node:18-alpine

# Thiết lập thư mục làm việc
WORKDIR /app

# Copy package.json và package-lock.json
COPY package*.json ./

# Cài đặt system dependencies và npm packages
RUN apk add --no-cache wget
RUN npm ci --only=production

# Copy source code
COPY . .

# Tạo user non-root để bảo mật
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodeuser -u 1001

# Chuyển ownership của thư mục app cho user nodejs
RUN chown -R nodeuser:nodejs /app
USER nodeuser

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/health || exit 1

# Khởi chạy ứng dụng
CMD ["npm", "start"] 