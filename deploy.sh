#!/bin/bash
# Quick deployment script for Ghana Lottery Explorer
# Run this script on your production server

set -e  # Exit on error

echo "🚀 Starting deployment of Ghana Lottery Explorer..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo -e "${RED}Please do not run as root. Create a user first.${NC}"
   exit 1
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js is not installed. Please install Node.js 18+ first.${NC}"
    exit 1
fi

# Check PostgreSQL
if ! command -v psql &> /dev/null; then
    echo -e "${RED}PostgreSQL is not installed. Please install PostgreSQL first.${NC}"
    exit 1
fi

# Check Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Python 3 is not installed. Please install Python 3.9+ first.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites check passed${NC}"

# Install dependencies
echo "📦 Installing dependencies..."
npm run install:all

# Setup Python virtual environment
echo "🐍 Setting up Python environment..."
cd python-service
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate
cd ..

# Build application
echo "🔨 Building application..."
npm run build

# Check if .env files exist
if [ ! -f "backend/.env" ]; then
    echo -e "${YELLOW}⚠ Warning: backend/.env not found. Please create it before starting services.${NC}"
fi

if [ ! -f "frontend/.env" ]; then
    echo -e "${YELLOW}⚠ Warning: frontend/.env not found. Please create it before starting services.${NC}"
fi

echo -e "${GREEN}✓ Build completed successfully${NC}"
echo ""
echo "Next steps:"
echo "1. Configure backend/.env and frontend/.env files"
echo "2. Setup database: cd backend && npm run migrate"
echo "3. Start services with PM2:"
echo "   - pm2 start backend/dist/index.js --name lottery-backend"
echo "   - pm2 start python-service/start.sh --name lottery-python --interpreter bash"
echo "4. Configure Nginx (see DEPLOYMENT.md)"
echo "5. Setup SSL with Let's Encrypt"

