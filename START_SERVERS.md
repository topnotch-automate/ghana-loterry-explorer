# How to Start All Servers

## Current Status
- ✅ **Frontend** is running (Vite dev server on port 3000)
- ❌ **Backend** is NOT running (needs to be started)

## Step-by-Step Instructions

### 1. Open a NEW Terminal Window

Keep your frontend terminal running, and open a **second terminal** for the backend.

### 2. Start the Backend Server

In the new terminal, run:

```bash
cd backend
npm run dev
```

You should see output like:
```
🚀 Server running on http://localhost:5000
📊 API available at http://localhost:5000/api
🌍 Environment: development
✅ Database connected
```

### 3. Verify Backend is Running

Open in browser: `http://localhost:5000/health`

Should return:
```json
{
  "status": "ok",
  "timestamp": "...",
  "environment": "development"
}
```

### 4. Check Frontend

Once backend is running, refresh your frontend browser. The `ERR_CONNECTION_REFUSED` errors should disappear and data should load.

## Required Setup (First Time Only)

### Backend Environment Variables

Create `backend/.env` file with:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/ghana_lottery
PORT=5000
CORS_ORIGIN=http://localhost:3000
NODE_ENV=development

# For authentication (if using)
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=7d
```

### Install Backend Dependencies (if not done)

```bash
cd backend
npm install
npm install jsonwebtoken bcrypt @types/jsonwebtoken @types/bcrypt
```

## Running All Services

You need **3 terminals** for full functionality:

**Terminal 1 - Frontend (already running):**
```bash
cd frontend
npm run dev
# Running on http://localhost:3000
```

**Terminal 2 - Backend (start this now):**
```bash
cd backend
npm run dev
# Running on http://localhost:5000
```

**Terminal 3 - Python Service (optional, for predictions):**
```bash
cd python-service
python app.py
# Running on http://localhost:5001
```

## Troubleshooting

### Backend won't start?

1. **Check if port 5000 is in use:**
   ```bash
   netstat -ano | findstr :5000
   ```

2. **Check database connection:**
   - Make sure PostgreSQL is running
   - Verify `DATABASE_URL` in `backend/.env`

3. **Check for errors in terminal:**
   - Look for red error messages
   - Common: Database connection errors, missing dependencies

### Still getting ERR_CONNECTION_REFUSED?

1. Verify backend is actually running:
   - Check terminal for "Server running" message
   - Test `http://localhost:5000/health` in browser

2. Check frontend API URL:
   - Should be `http://localhost:5000` (check `frontend/src/utils/constants.ts`)

3. Check CORS settings:
   - Backend should allow `http://localhost:3000`

---

**Quick Start Command:**
```bash
cd backend && npm run dev
```

