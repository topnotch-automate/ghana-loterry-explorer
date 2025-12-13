# Backend Start Guide - Fix ERR_CONNECTION_REFUSED

## Issue
Frontend shows `ERR_CONNECTION_REFUSED` error, meaning the backend API server is not running.

## Solution

### 1. Start the Backend Server

Open a terminal and run:

```bash
cd backend
npm run dev
```

The backend should start on `http://localhost:5000`

### 2. Verify Backend is Running

Check the terminal output. You should see:
```
🚀 Server running on http://localhost:5000
📊 API available at http://localhost:5000/api
🌍 Environment: development
```

### 3. Test Backend Health

Open in browser or use curl:
```bash
curl http://localhost:5000/health
```

Should return:
```json
{
  "status": "ok",
  "timestamp": "...",
  "environment": "development"
}
```

### 4. Check Environment Variables

Make sure `backend/.env` exists with:
```env
DATABASE_URL=postgresql://username:password@localhost:5432/ghana_lottery
PORT=5000
CORS_ORIGIN=http://localhost:3000
NODE_ENV=development
```

### 5. Common Issues

#### Issue: Port 5000 already in use
**Solution:** 
- Change port in `backend/.env`: `PORT=5001`
- Update `frontend/src/utils/constants.ts`: `BASE_URL: 'http://localhost:5001'`

#### Issue: Database connection error
**Solution:**
- Make sure PostgreSQL is running
- Check `DATABASE_URL` in `backend/.env`
- Verify database exists: `psql -U username -d ghana_lottery`

#### Issue: Missing dependencies
**Solution:**
```bash
cd backend
npm install
```

#### Issue: Missing JWT dependencies (for auth)
**Solution:**
```bash
cd backend
npm install jsonwebtoken bcrypt @types/jsonwebtoken @types/bcrypt
```

### 6. Start All Services

For full functionality, you need:

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

**Terminal 3 - Python Service (for predictions):**
```bash
cd python-service
python app.py
```

### 7. Verify Frontend Can Connect

After starting backend:
1. Open browser console (F12)
2. Check Network tab
3. Look for API calls to `http://localhost:5000/api/*`
4. Should see 200 status codes, not ERR_CONNECTION_REFUSED

### 8. Quick Test

Once backend is running, test these endpoints:
- `http://localhost:5000/health` - Health check
- `http://localhost:5000/api/draws` - Get draws
- `http://localhost:5000/api/analytics/frequency?days=30` - Get frequency

---

**Status:** Backend must be running for frontend to work
**Default Port:** 5000
**Default Frontend Port:** 3000

