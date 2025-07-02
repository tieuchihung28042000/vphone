# 🚀 VPhone Production - Nguyenkieuanh.com

## Quick Start

### 1. Chuẩn bị VPS
```bash
# Install Docker & Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
sudo apt install docker-compose-plugin -y
```

### 2. Deploy Production
```bash
# Clone project
git clone [your-repo-url]
cd vphone

# Run production deployment
chmod +x deploy-production.sh
./deploy-production.sh
```

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