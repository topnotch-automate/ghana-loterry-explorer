# Quick Fix: Backend Connection Error

## Problem
Frontend shows `ERR_CONNECTION_REFUSED` and doesn't display analyses/latest draws.

## Solution: Start the Backend Server

### Step 1: Open a new terminal

### Step 2: Navigate to backend directory
```bash
cd backend
```

### Step 3: Start the backend server
```bash
npm run dev
```

You should see:
```
🚀 Server running on http://localhost:5000
📊 API available at http://localhost:5000/api
🌍 Environment: development
```

### Step 4: Verify it's working
Open in browser: `http://localhost:5000/health`

Should return:
```json
{"status":"ok","timestamp":"...","environment":"development"}
```

### Step 5: Refresh your frontend
The frontend should now be able to load data.

## What's Happening

- **Frontend** (port 3000) tries to connect to **Backend** (port 5000)
- If backend is not running → `ERR_CONNECTION_REFUSED`
- Frontend shows empty data or error messages
- Once backend starts → Frontend can fetch data

## Free vs Pro Access

✅ **Free Users Can Access:**
- Home page (search, latest draws)
- Search page
- Analytics page
- Import page

🔒 **Requires Login:**
- Dashboard
- Predictions (requires Pro subscription)
- Subscription management

## Troubleshooting

### Backend won't start?
1. Check if port 5000 is in use
2. Check `backend/.env` has `DATABASE_URL`
3. Make sure PostgreSQL is running
4. Run `npm install` in backend directory

### Still getting errors?
1. Check browser console (F12) for specific errors
2. Check backend terminal for error messages
3. Verify database connection in backend logs

---

**Quick Command:**
```bash
cd backend && npm run dev
```

