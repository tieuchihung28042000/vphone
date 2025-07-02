# 🚀 VPhone Production - Nguyenkieuanh.com

## Quick Start - CHỈ CẦN 1 LỆNH!

### Triển khai VPhone trên VPS:
```bash
# Clone project
git clone [your-repo-url]
cd vphone

# Chạy script all-in-one (tự động cài Docker nếu chưa có)
chmod +x vphone-deploy.sh
./vphone-deploy.sh
```

**Đó là tất cả!** Script sẽ tự động:
- ✅ Cài Docker & Docker Compose (nếu chưa có)
- ✅ Sửa lỗi permissions
- ✅ Tạo file .env từ template
- ✅ Build images với giới hạn tài nguyên
- ✅ Khởi động tất cả services
- ✅ Tạo SSL certificate
- ✅ Tạo admin user
- ✅ Kiểm tra DNS

### 3. Access System
- **URL**: https://Nguyenkieuanh.com
- **Admin**: admin@vphone.vn / admin / 123456

## Important Notes

### DNS Configuration Required
```
Nguyenkieuanh.com    A    [YOUR_VPS_IP]
```

### Auto Features
- ✅ SSL Certificate (Let's Encrypt)
- ✅ Admin User Creation
- ✅ SSL Auto-renewal
- ✅ Database Setup

### Monitoring
```bash
# Check status
docker compose ps

# View logs
docker compose logs -f

# SSL status
docker compose logs ssl-init
```

### Security
- Change default admin password after first login
- Setup firewall: `sudo ufw allow 80,443/tcp && sudo ufw enable`
- Regular backups recommended

---
📖 **Full Documentation**: See `PRODUCTION_DEPLOYMENT.md` 