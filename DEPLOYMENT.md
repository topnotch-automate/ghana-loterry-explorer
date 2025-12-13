# Deployment Guide - Ghana Lottery Explorer

Complete guide for deploying the Ghana Lottery Explorer application to production for global access.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Server Requirements](#server-requirements)
3. [Deployment Options](#deployment-options)
4. [Step-by-Step Deployment](#step-by-step-deployment)
5. [Domain & SSL Setup](#domain--ssl-setup)
6. [Process Management](#process-management)
7. [Monitoring & Maintenance](#monitoring--maintenance)
8. [Security Checklist](#security-checklist)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- **Server**: Ubuntu 20.04+ / Debian 11+ (recommended) or any Linux VPS
- **Node.js**: Version 18+ installed
- **PostgreSQL**: Version 12+ installed
- **Python**: Version 3.9+ installed (for prediction service)
- **Domain Name**: Registered domain (e.g., ghanalottery.com)
- **SSH Access**: To your server
- **Basic Linux Knowledge**: Command line familiarity

---

## Server Requirements

### Minimum Requirements
- **CPU**: 2 cores
- **RAM**: 4GB
- **Storage**: 20GB SSD
- **Bandwidth**: 100GB/month

### Recommended Requirements
- **CPU**: 4 cores
- **RAM**: 8GB
- **Storage**: 50GB SSD
- **Bandwidth**: 500GB/month

### Cloud Provider Options
- **DigitalOcean**: $12-24/month (Droplet)
- **AWS EC2**: t3.medium instance
- **Linode**: $12-24/month
- **Vultr**: $12-24/month
- **Hetzner**: €4-8/month (Europe)

---

## Deployment Options

### Option 1: Single Server (Recommended for Start)
Deploy everything on one server:
- Frontend (static files served by Nginx)
- Backend API (Node.js/Express)
- Python Service (Flask)
- PostgreSQL Database

### Option 2: Separate Services
- Frontend: CDN (Cloudflare, AWS CloudFront)
- Backend: VPS or containerized
- Database: Managed PostgreSQL (AWS RDS, DigitalOcean)
- Python Service: Separate container/service

---

## Step-by-Step Deployment

### 1. Server Initial Setup

#### Connect to your server:
```bash
ssh root@your-server-ip
```

#### Update system:
```bash
apt update && apt upgrade -y
```

#### Install essential tools:
```bash
apt install -y curl wget git build-essential
```

### 2. Install Node.js 18+

```bash
# Using NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Verify installation
node --version  # Should show v18.x or higher
npm --version
```

### 3. Install PostgreSQL

```bash
# Install PostgreSQL
apt install -y postgresql postgresql-contrib

# Start and enable PostgreSQL
systemctl start postgresql
systemctl enable postgresql

# Create database and user
sudo -u postgres psql << EOF
CREATE DATABASE ghana_lottery;
CREATE USER lottery_user WITH PASSWORD 'your_secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE ghana_lottery TO lottery_user;
ALTER USER lottery_user CREATEDB;
\q
EOF
```

### 4. Install Python 3.9+ and pip

```bash
# Install Python and pip
apt install -y python3 python3-pip python3-venv

# Verify installation
python3 --version
pip3 --version
```

### 5. Install Nginx

```bash
apt install -y nginx

# Start and enable Nginx
systemctl start nginx
systemctl enable nginx
```

### 6. Install PM2 (Process Manager)

```bash
npm install -g pm2

# Setup PM2 to start on boot
pm2 startup systemd
# Follow the instructions shown
```

### 7. Clone and Setup Application

```bash
# Create application directory
mkdir -p /var/www
cd /var/www

# Clone your repository (replace with your repo URL)
git clone https://github.com/yourusername/ghana-lottery-explorer.git
cd ghana-lottery-explorer

# Install all dependencies
npm run install:all

# Install Python dependencies
cd python-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
deactivate
cd ..
```

### 8. Configure Environment Variables

#### Backend `.env`:
```bash
cd backend
nano .env
```

```env
# Database
DATABASE_URL=postgresql://lottery_user:your_secure_password_here@localhost:5432/ghana_lottery

# Server
NODE_ENV=production
PORT=5000

# Python Service
PYTHON_SERVICE_URL=http://localhost:5001

# CORS (replace with your domain)
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com

# JWT Secret (generate a strong random string)
JWT_SECRET=your_super_secret_jwt_key_here

# Logging
LOG_LEVEL=info
```

#### Frontend `.env`:
```bash
cd ../frontend
nano .env
```

```env
VITE_API_URL=https://api.yourdomain.com
# Or if using same domain:
# VITE_API_URL=https://yourdomain.com/api
```

### 9. Setup Database

```bash
cd /var/www/ghana-lottery-explorer/backend

# Run database schema
sudo -u postgres psql -d ghana_lottery -f src/database/schema.sql

# Run migrations (if any)
npm run migrate
```

### 10. Build Application

```bash
cd /var/www/ghana-lottery-explorer

# Build frontend
npm run build:frontend

# Build backend
npm run build:backend
```

### 11. Configure Nginx

```bash
nano /etc/nginx/sites-available/ghana-lottery
```

```nginx
# Upstream for backend API
upstream backend {
    server localhost:5000;
}

# Upstream for Python service (if needed for direct access)
upstream python_service {
    server localhost:5001;
}

# HTTP to HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;
    
    # Let's Encrypt verification
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    # Redirect all HTTP to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# Main HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Configuration (will be set up with Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # SSL Security Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Frontend (React App)
    location / {
        root /var/www/ghana-lottery-explorer/frontend/dist;
        try_files $uri $uri/ /index.html;
        index index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend API
    location /api {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts for long-running requests (predictions)
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://backend;
        access_log off;
    }
}
```

Enable the site:
```bash
ln -s /etc/nginx/sites-available/ghana-lottery /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default  # Remove default site

# Test Nginx configuration
nginx -t

# Reload Nginx
systemctl reload nginx
```

### 12. Start Services with PM2

#### Start Backend:
```bash
cd /var/www/ghana-lottery-explorer/backend

pm2 start dist/index.js --name "lottery-backend" \
  --env production \
  --log-date-format "YYYY-MM-DD HH:mm:ss Z" \
  --error /var/log/lottery-backend-error.log \
  --out /var/log/lottery-backend-out.log \
  --max-memory-restart 500M
```

#### Start Python Service:
```bash
cd /var/www/ghana-lottery-explorer/python-service

pm2 start start.sh --name "lottery-python" \
  --interpreter bash \
  --log-date-format "YYYY-MM-DD HH:mm:ss Z" \
  --error /var/log/lottery-python-error.log \
  --out /var/log/lottery-python-out.log \
  --max-memory-restart 1G
```

#### Save PM2 configuration:
```bash
pm2 save
```

### 13. Setup SSL with Let's Encrypt

```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx

# Get SSL certificate (replace with your domain)
certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal is set up automatically, but test it:
certbot renew --dry-run
```

---

## Domain & SSL Setup

### 1. DNS Configuration

Add these DNS records to your domain registrar:

```
Type    Name    Value              TTL
A       @       your-server-ip     3600
A       www     your-server-ip     3600
```

### 2. Verify DNS Propagation

```bash
# Check if DNS is propagated
dig yourdomain.com
nslookup yourdomain.com
```

### 3. Firewall Configuration

```bash
# Install UFW (if not installed)
apt install -y ufw

# Allow SSH (IMPORTANT - do this first!)
ufw allow 22/tcp

# Allow HTTP and HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Enable firewall
ufw enable

# Check status
ufw status
```

---

## Process Management

### PM2 Commands

```bash
# View all processes
pm2 list

# View logs
pm2 logs lottery-backend
pm2 logs lottery-python

# Restart services
pm2 restart lottery-backend
pm2 restart lottery-python

# Stop services
pm2 stop lottery-backend

# Delete from PM2
pm2 delete lottery-backend

# Monitor resources
pm2 monit
```

### Auto-restart on Server Reboot

PM2 startup is already configured, but verify:
```bash
pm2 startup
pm2 save
```

---

## Monitoring & Maintenance

### 1. Setup Log Rotation

```bash
nano /etc/logrotate.d/lottery-app
```

```
/var/log/lottery-*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    missingok
    create 0640 root root
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

### 2. Monitor Server Resources

```bash
# Install monitoring tools
apt install -y htop iotop

# View system resources
htop
df -h  # Disk usage
free -h  # Memory usage
```

### 3. Database Backups

Create backup script:
```bash
nano /usr/local/bin/backup-lottery-db.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/lottery"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Create backup
pg_dump -U lottery_user ghana_lottery | gzip > $BACKUP_DIR/backup_$DATE.sql.gz

# Keep only last 7 days
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete

echo "Backup completed: backup_$DATE.sql.gz"
```

Make executable:
```bash
chmod +x /usr/local/bin/backup-lottery-db.sh
```

Add to crontab (daily at 2 AM):
```bash
crontab -e
```

```
0 2 * * * /usr/local/bin/backup-lottery-db.sh
```

### 4. Application Updates

```bash
# Create update script
nano /usr/local/bin/update-lottery-app.sh
```

```bash
#!/bin/bash
cd /var/www/ghana-lottery-explorer

# Pull latest changes
git pull origin main

# Install dependencies
npm run install:all

# Build application
npm run build

# Run migrations (if any)
cd backend
npm run migrate

# Restart services
pm2 restart lottery-backend
pm2 restart lottery-python

echo "Application updated successfully"
```

---

## Security Checklist

- [ ] **Firewall**: UFW configured, only necessary ports open
- [ ] **SSH**: Key-based authentication enabled, password auth disabled
- [ ] **SSL/HTTPS**: Let's Encrypt certificate installed and auto-renewal enabled
- [ ] **Database**: Strong password, user with minimal privileges
- [ ] **Environment Variables**: All secrets in `.env` files, not committed to git
- [ ] **Node.js**: Running as non-root user (create dedicated user)
- [ ] **Updates**: Regular system updates scheduled
- [ ] **Backups**: Database backups automated
- [ ] **Monitoring**: Logs monitored, alerts set up
- [ ] **Rate Limiting**: Implemented in Express (if needed)
- [ ] **CORS**: Properly configured for production domain

### Create Non-Root User (Recommended)

```bash
# Create user
adduser lottery-app
usermod -aG sudo lottery-app

# Switch to new user
su - lottery-app

# Setup SSH keys
mkdir -p ~/.ssh
chmod 700 ~/.ssh
# Copy your public key to ~/.ssh/authorized_keys
```

---

## Troubleshooting

### Backend not starting
```bash
# Check logs
pm2 logs lottery-backend
tail -f /var/log/lottery-backend-error.log

# Check if port is in use
netstat -tulpn | grep 5000

# Verify environment variables
cd /var/www/ghana-lottery-explorer/backend
cat .env
```

### Python service not starting
```bash
# Check logs
pm2 logs lottery-python

# Test manually
cd /var/www/ghana-lottery-explorer/python-service
source venv/bin/activate
python app.py
```

### Database connection issues
```bash
# Test connection
sudo -u postgres psql -d ghana_lottery -U lottery_user

# Check PostgreSQL status
systemctl status postgresql

# Check PostgreSQL logs
tail -f /var/log/postgresql/postgresql-*.log
```

### Nginx issues
```bash
# Test configuration
nginx -t

# Check error logs
tail -f /var/log/nginx/error.log

# Reload Nginx
systemctl reload nginx
```

### SSL certificate issues
```bash
# Check certificate status
certbot certificates

# Renew manually
certbot renew

# Check auto-renewal
systemctl status certbot.timer
```

---

## Quick Reference Commands

```bash
# View all services
pm2 list

# Restart all services
pm2 restart all

# View logs
pm2 logs

# Check Nginx status
systemctl status nginx

# Check PostgreSQL status
systemctl status postgresql

# View disk usage
df -h

# View memory usage
free -h

# View running processes
htop
```

---

## Alternative: Docker Deployment (Optional)

If you prefer containerized deployment:

### Docker Compose Setup

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: ghana_lottery
      POSTGRES_USER: lottery_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      DATABASE_URL: postgresql://lottery_user:${DB_PASSWORD}@postgres:5432/ghana_lottery
      NODE_ENV: production
      PORT: 5000
      PYTHON_SERVICE_URL: http://python-service:5001
    depends_on:
      - postgres
      - python-service
    ports:
      - "5000:5000"

  python-service:
    build:
      context: ./python-service
      dockerfile: Dockerfile
    ports:
      - "5001:5001"

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  postgres_data:
```

### Quick Deploy Script

Use the provided `deploy.sh` script for automated deployment:

```bash
chmod +x deploy.sh
./deploy.sh
```

This script will:
- Check prerequisites
- Install dependencies
- Setup Python environment
- Build the application
- Guide you through remaining steps

---

## Additional Resources

- **PM2 Documentation**: https://pm2.keymetrics.io/
- **Nginx Documentation**: https://nginx.org/en/docs/
- **Let's Encrypt**: https://letsencrypt.org/docs/
- **PostgreSQL Documentation**: https://www.postgresql.org/docs/
- **Quick Checklist**: See [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)

---

## Support

For deployment issues, check:
1. Application logs: `pm2 logs`
2. Nginx logs: `/var/log/nginx/error.log`
3. System logs: `journalctl -xe`
4. Database logs: `/var/log/postgresql/`

---

**Last Updated**: December 2024

