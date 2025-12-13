# Authentication & Subscription - Quick Start

## 🚀 Quick Setup (5 minutes)

### 1. Install Backend Dependencies

```bash
cd backend
npm install jsonwebtoken bcrypt @types/jsonwebtoken @types/bcrypt
```

### 2. Add Environment Variables

Edit `backend/.env`:

```env
JWT_SECRET=your-super-secret-key-here
JWT_EXPIRES_IN=7d
```

Generate a secure secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 3. Run Database Migration

```bash
cd backend
npm run migrate
```

### 4. Start Services

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend  
cd frontend
npm run dev

# Terminal 3 - Python Service (for predictions)
cd python-service
python app.py
```

### 5. Test It!

1. Open `http://localhost:3000`
2. Click "Sign Up" in navigation
3. Create an account
4. Login
5. Go to `/subscription` to upgrade
6. Access `/predictions` with Pro

## ✅ What's Working

- ✅ User registration with password validation
- ✅ User login with JWT tokens
- ✅ Protected routes (Dashboard, Predictions, Subscription)
- ✅ Subscription management
- ✅ Pro feature access control
- ✅ Beautiful UI matching app design
- ✅ Mobile-responsive navigation
- ✅ Auto-logout on token expiration

## 🎯 User Flow

1. **New User**: Register → Login → Free features → Upgrade to Pro → Access predictions
2. **Returning User**: Login → Access features based on subscription
3. **Pro User**: Full access to all features including predictions

## 📝 API Endpoints

### Auth
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Sign in
- `GET /api/auth/me` - Get current user (protected)

### Subscriptions
- `POST /api/subscriptions/upgrade` - Upgrade to Pro
- `GET /api/subscriptions/status` - Get subscription status
- `GET /api/subscriptions/history` - Get subscription history

## 🔒 Security

- Passwords hashed with bcrypt (10 rounds)
- JWT tokens with 7-day expiration
- Protected routes require authentication
- Pro features require subscription

---

**Ready to use!** 🎉

