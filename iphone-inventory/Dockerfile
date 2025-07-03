# Multi-stage build
# Stage 1: Build the React app
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Accept build arg for API URL
ARG VITE_API_URL=http://localhost

# Set environment variable for Vite build
ENV VITE_API_URL=$VITE_API_URL

# Build the app with environment variable
RUN npm run build

# Stage 2: Serve the app with nginx
FROM nginx:alpine

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built app from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy logo to nginx html directory
COPY --from=builder /app/public/logo-vphone.png /usr/share/nginx/html/

# Create non-root user
RUN adduser -S nginxuser -u 1001 -G nginx

# Set permissions
RUN chown -R nginxuser:nginx /usr/share/nginx/html
RUN chown -R nginxuser:nginx /var/cache/nginx
RUN chown -R nginxuser:nginx /var/log/nginx
RUN chown -R nginxuser:nginx /etc/nginx/conf.d
RUN touch /var/run/nginx.pid
RUN chown -R nginxuser:nginx /var/run/nginx.pid

USER nginxuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"] 