# VPhone Production Deployment Guide

## 🎯 Triển khai VPhone trên VPS với domain Nguyenkieuanh.com

### 📋 Yêu cầu hệ thống

**VPS Requirements:**
- Ubuntu 20.04+ hoặc CentOS 8+
- RAM: Tối thiểu 2GB (khuyến nghị 4GB+)
- Storage: Tối thiểu 20GB SSD
- CPU: 2 cores trở lên
- Network: Public IP với port 80, 443 mở

**Software Requirements:**
- Docker 24.0+
- Docker Compose 2.0+
- Git

### 🌐 Cấu hình DNS

**Trước khi triển khai, đảm bảo:**
1. Domain `Nguyenkieuanh.com` đã trỏ về IP của VPS
2. Cấu hình A record:
   ```
   Nguyenkieuanh.com    A    [IP_VPS_CUA_BAN]
   www.Nguyenkieuanh.com A   [IP_VPS_CUA_BAN]
   ```

### 🚀 Hướng dẫn triển khai

#### Bước 1: Chuẩn bị VPS

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Verify installation
docker --version
docker compose version
```

#### Bước 2: Clone và setup project

```bash
# Clone project
git clone https://github.com/your-repo/vphone.git
cd vphone

# Make deployment script executable
chmod +x deploy-production.sh

# Run production deployment
./deploy-production.sh
```

#### Bước 3: Kiểm tra triển khai

```bash
# Check all services
docker compose ps

# Check logs
docker compose logs -f

# Check SSL certificate generation
docker compose logs ssl-init
```

### 🔐 Cấu hình SSL tự động

Hệ thống sẽ tự động:
1. **Detect domain**: Nhận diện `Nguyenkieuanh.com` từ biến `DOMAIN`
2. **Generate SSL**: Tạo Let's Encrypt certificate
3. **Auto-renewal**: Tự động gia hạn certificate mỗi 12h

**SSL Status Check:**
```bash
# Check SSL certificate
docker compose exec nginx openssl x509 -in /etc/letsencrypt/live/Nguyenkieuanh.com/cert.pem -text -noout

# Check SSL renewal service
docker compose logs ssl-renewal
```

### 📊 Monitoring và Management

#### Service Status
```bash
# Check all services
docker compose ps

# Check specific service
docker compose logs backend
docker compose logs frontend
docker compose logs nginx
```

#### Database Management
```bash
# Access MongoDB
docker compose exec mongodb mongosh -u admin -p VPhone2025!SecurePass

# Backup database
docker compose exec mongodb mongodump --uri="mongodb://admin:VPhone2025!SecurePass@localhost:27017/vphone_production?authSource=admin"

# Restore database
docker compose exec mongodb mongorestore --uri="mongodb://admin:VPhone2025!SecurePass@localhost:27017/vphone_production?authSource=admin"
```

#### Log Management
```bash
# View real-time logs
docker compose logs -f

# View specific service logs
docker compose logs -f backend
docker compose logs -f nginx

# Log rotation (if needed)
docker system prune -f
```

### 🔒 Security Configuration

#### Firewall Setup
```bash
# UFW firewall
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable

# Check status
sudo ufw status
```

#### Change Default Passwords
1. **Admin User**: Đăng nhập và đổi password mặc định
2. **MongoDB**: Cập nhật password trong `.env`
3. **JWT Secret**: Generate secret mới cho production

### 🚨 Troubleshooting

#### SSL Certificate Issues
```bash
# Manual SSL generation
docker compose exec ssl-init certbot certonly --webroot --webroot-path=/ssl/webroot -d Nguyenkieuanh.com --email admin@nguyenkieuanh.com --agree-tos --non-interactive

# Check certificate status
docker compose exec nginx ls -la /etc/letsencrypt/live/
```

#### Domain Resolution Issues
```bash
# Check DNS resolution
nslookup Nguyenkieuanh.com
dig Nguyenkieuanh.com

# Check if domain points to server
curl -I http://Nguyenkieuanh.com
```

#### Service Health Issues
```bash
# Restart specific service
docker compose restart backend
docker compose restart frontend
docker compose restart nginx

# Full restart
docker compose down && docker compose up -d
```

### 📈 Performance Optimization

#### Resource Monitoring
```bash
# Check resource usage
docker stats

# Check disk usage
df -h
docker system df
```

#### Backup Strategy
```bash
# Create backup script
cat > backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker compose exec mongodb mongodump --uri="mongodb://admin:VPhone2025!SecurePass@localhost:27017/vphone_production?authSource=admin" --out /backup/vphone_$DATE
EOF

chmod +x backup.sh
```

### 🔄 Updates và Maintenance

#### Update Application
```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker compose down
docker compose build --no-cache
docker compose up -d
```

#### System Maintenance
```bash
# Clean up Docker
docker system prune -f

# Update system packages
sudo apt update && sudo apt upgrade -y

# Restart if needed
sudo reboot
```

### 📞 Support Information

**Production Environment:**
- **Domain**: https://Nguyenkieuanh.com
- **Admin Email**: admin@vphone.vn
- **Admin Username**: admin
- **Default Password**: 123456 (⚠️ Đổi ngay sau khi đăng nhập)

**SSL Configuration:**
- **Provider**: Let's Encrypt
- **Contact Email**: admin@nguyenkieuanh.com
- **Auto-renewal**: Enabled

**Database:**
- **Type**: MongoDB 7.0
- **Database**: vphone_production
- **Auto-backup**: Recommended to setup

---

## ✅ Checklist triển khai

- [ ] DNS đã trỏ về VPS
- [ ] VPS đã cài Docker & Docker Compose
- [ ] Chạy `./deploy-production.sh`
- [ ] Kiểm tra services: `docker compose ps`
- [ ] Kiểm tra SSL: `docker compose logs ssl-init`
- [ ] Truy cập https://Nguyenkieuanh.com
- [ ] Đăng nhập và đổi password admin
- [ ] Setup firewall
- [ ] Setup backup strategy

🎉 **Hoàn thành triển khai production!** 