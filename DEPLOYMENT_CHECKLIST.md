# Deployment Checklist

Quick reference checklist for deploying Ghana Lottery Explorer to production.

## Pre-Deployment

- [ ] Server provisioned (VPS/Cloud instance)
- [ ] Domain name registered and DNS configured
- [ ] SSH access to server configured
- [ ] Server has minimum requirements (2 CPU, 4GB RAM, 20GB storage)

## Server Setup

- [ ] System updated (`apt update && apt upgrade`)
- [ ] Node.js 18+ installed
- [ ] PostgreSQL 12+ installed and running
- [ ] Python 3.9+ installed
- [ ] Nginx installed
- [ ] PM2 installed globally
- [ ] Firewall (UFW) configured

## Application Setup

- [ ] Repository cloned to `/var/www/ghana-lottery-explorer`
- [ ] All dependencies installed (`npm run install:all`)
- [ ] Python virtual environment created and dependencies installed
- [ ] Backend `.env` file configured with:
  - [ ] `DATABASE_URL`
  - [ ] `NODE_ENV=production`
  - [ ] `PORT=5000`
  - [ ] `PYTHON_SERVICE_URL=http://localhost:5001`
  - [ ] `CORS_ORIGIN` (your domain)
  - [ ] `JWT_SECRET` (strong random string)
- [ ] Frontend `.env` file configured with:
  - [ ] `VITE_API_URL` (your API URL)

## Database Setup

- [ ] PostgreSQL database created (`ghana_lottery`)
- [ ] Database user created with proper permissions
- [ ] Schema applied (`schema.sql`)
- [ ] Migrations run (`npm run migrate`)
- [ ] Database backup script created and scheduled

## Build & Deploy

- [ ] Frontend built (`npm run build:frontend`)
- [ ] Backend built (`npm run build:backend`)
- [ ] Build artifacts verified in `dist` folders

## Services Configuration

- [ ] Backend started with PM2 (`lottery-backend`)
- [ ] Python service started with PM2 (`lottery-python`)
- [ ] PM2 startup script configured
- [ ] PM2 configuration saved (`pm2 save`)

## Nginx Configuration

- [ ] Nginx configuration file created
- [ ] Frontend static files served correctly
- [ ] Backend API proxied to `localhost:5000`
- [ ] Health check endpoint configured
- [ ] Nginx configuration tested (`nginx -t`)
- [ ] Nginx reloaded/restarted

## SSL/HTTPS

- [ ] Let's Encrypt Certbot installed
- [ ] SSL certificate obtained
- [ ] SSL auto-renewal configured
- [ ] HTTPS redirect working
- [ ] SSL grade checked (A or A+)

## Security

- [ ] Firewall rules configured (ports 22, 80, 443 only)
- [ ] SSH key-based authentication enabled
- [ ] Root login disabled (if applicable)
- [ ] Strong database password set
- [ ] Environment variables secured (not in git)
- [ ] CORS properly configured
- [ ] Security headers added in Nginx

## Monitoring

- [ ] PM2 monitoring setup
- [ ] Log rotation configured
- [ ] Database backup automation configured
- [ ] System monitoring tools installed (htop, etc.)

## Testing

- [ ] Frontend loads correctly
- [ ] API endpoints accessible
- [ ] Database queries working
- [ ] Python prediction service responding
- [ ] Health checks passing
- [ ] SSL certificate valid
- [ ] Mobile responsiveness tested

## Post-Deployment

- [ ] Domain DNS propagation verified
- [ ] All services running (`pm2 list`)
- [ ] Logs checked for errors
- [ ] Performance tested
- [ ] Backup verified working
- [ ] Update script created
- [ ] Documentation updated

## Quick Commands Reference

```bash
# Check services
pm2 list
pm2 logs

# Restart services
pm2 restart all

# Check Nginx
systemctl status nginx
nginx -t

# Check PostgreSQL
systemctl status postgresql

# View logs
pm2 logs lottery-backend
pm2 logs lottery-python
tail -f /var/log/nginx/error.log

# Database backup
pg_dump -U lottery_user ghana_lottery > backup.sql

# Update application
cd /var/www/ghana-lottery-explorer
git pull
npm run install:all
npm run build
pm2 restart all
```

---

**Note**: For detailed instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md)

