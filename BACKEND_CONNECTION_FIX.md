# Backend Connection Fix

## Issue: Network Error in Browser Console

The error "Network Error" occurs when the frontend cannot connect to the backend server.

## Root Cause

The backend server is not running or not accessible at `http://localhost:5000`.

## Solution

### Step 1: Start the Backend Server

Open a **new terminal** and run:

```bash
cd backend
npm run dev
```

You should see:
```
🚀 Server running on http://localhost:5000
📊 API available at http://localhost:5000/api
✅ Database connected
✅ Database connection test successful
```

### Step 2: Verify Backend is Running

1. **Check the terminal** - You should see the server logs
2. **Test the health endpoint:**
   - Open browser: `http://localhost:5000/health`
   - Should return: `{"status":"ok","timestamp":"...","environment":"development"}`

### Step 3: Refresh Frontend

After starting the backend, refresh your frontend browser. The network errors should disappear.

## Changes Made

1. **Improved API Configuration:**
   - In development, uses relative URLs (`/api`) to leverage Vite proxy
   - In production, uses configured `VITE_API_URL` or defaults to `http://localhost:5000`

2. **Better Error Handling:**
   - Network errors now show a clear message: "Cannot connect to the server. Please make sure the backend is running on http://localhost:5000"
   - HomePage detects when all API calls fail and shows a helpful error message

3. **Error Interceptor:**
   - Axios interceptor now properly handles network errors (when `error.response` is undefined)

## Troubleshooting

### Backend Won't Start

1. **Check if port 5000 is already in use:**
   ```bash
   # Windows
   netstat -ano | findstr :5000
   ```

2. **Check DATABASE_URL in `.env`:**
   ```bash
   cd backend
   cat .env | findstr DATABASE_URL
   ```

3. **Check for missing dependencies:**
   ```bash
   cd backend
   npm install
   ```

### Backend Starts But Frontend Still Shows Errors

1. **Check CORS configuration:**
   - Backend should allow `http://localhost:3000`
   - Check `backend/.env`: `CORS_ORIGIN=http://localhost:3000`

2. **Check browser console for CORS errors:**
   - If you see CORS errors, the backend CORS configuration needs to be updated

3. **Verify API endpoints:**
   - Test: `http://localhost:5000/api/draws/latest`
   - Should return JSON (even if empty array)

### Database Connection Issues

If backend starts but shows database errors:

1. **Check PostgreSQL is running:**
   ```bash
   # Windows Services
   # Look for PostgreSQL service
   ```

2. **Verify DATABASE_URL:**
   ```bash
   # Should be: postgresql://username:password@localhost:5432/database_name
   ```

3. **Run database check:**
   ```bash
   cd backend
   npm run check-db
   ```

## Quick Start Checklist

- [ ] Backend server running (`npm run dev` in `backend` directory)
- [ ] Backend shows "✅ Database connected" in logs
- [ ] Health endpoint works: `http://localhost:5000/health`
- [ ] Frontend refreshed in browser
- [ ] No network errors in browser console

## Expected Behavior

**Before (Error):**
```
Failed to load frequency: ApiError: Network Error
```

**After (Working):**
- No errors in console
- Data loads successfully
- HomePage shows draws and frequency charts

---

**Note:** Always start the backend server before accessing the frontend. The frontend depends on the backend API to function.

