# Database Connection Diagnostic Guide

## Issue: No Data Available

This guide helps diagnose database connection and data availability issues.

## Step 1: Check Database Connection

### Option A: Run the Database Check Script

```bash
cd backend
npm run check-db
```

This script will:
- Test database connection
- Check if `draws` table exists
- Count total draws in database
- Show date range of data
- Display latest draw information
- Check users table

### Option B: Manual Database Check

1. **Check if PostgreSQL is running:**
   ```bash
   # Windows (PowerShell)
   Get-Service -Name postgresql*
   
   # Or check if port 5432 is listening
   netstat -an | findstr 5432
   ```

2. **Verify DATABASE_URL in `.env`:**
   ```bash
   cd backend
   # Check if .env file exists
   cat .env | findstr DATABASE_URL
   ```
   
   Format should be:
   ```
   DATABASE_URL=postgresql://username:password@localhost:5432/database_name
   ```

3. **Test connection manually:**
   ```bash
   # Using psql (if installed)
   psql -h localhost -U your_username -d your_database
   ```

## Step 2: Check if Database Has Data

### Check Draw Count

```sql
-- Connect to your database and run:
SELECT COUNT(*) FROM draws;
```

### Check Latest Draw

```sql
SELECT draw_date, lotto_type, winning_numbers 
FROM draws 
ORDER BY draw_date DESC 
LIMIT 5;
```

### Check Date Range

```sql
SELECT 
  MIN(draw_date) as earliest,
  MAX(draw_date) as latest,
  COUNT(*) as total_draws
FROM draws;
```

## Step 3: Common Issues and Solutions

### Issue 1: Database Not Running
**Symptoms:** Connection refused errors
**Solution:**
- Start PostgreSQL service
- Windows: Services → PostgreSQL → Start
- Or: `net start postgresql-x64-XX` (replace XX with version)

### Issue 2: Wrong DATABASE_URL
**Symptoms:** Authentication failed or database not found
**Solution:**
- Verify username, password, host, port, and database name
- Test connection string manually

### Issue 3: Empty Database
**Symptoms:** Connection works but COUNT(*) returns 0
**Solution:**
- Run scraper to populate data:
  ```bash
  cd backend
  npm run scrape
  ```
- Or import existing data:
  ```bash
  npm run populate
  ```

### Issue 4: Tables Don't Exist
**Symptoms:** "relation 'draws' does not exist"
**Solution:**
- Run migrations:
  ```bash
  cd backend
  npm run migrate
  ```

### Issue 5: Connection Timeout
**Symptoms:** Connection timeout errors
**Solution:**
- Check firewall settings
- Verify PostgreSQL is listening on correct port
- Check `postgresql.conf` for `listen_addresses`

## Step 4: Verify Backend Can Connect

1. **Start backend server:**
   ```bash
   cd backend
   npm run dev
   ```

2. **Check logs for:**
   - `✅ Database connected`
   - `✅ Database connection test successful`
   - Any error messages

3. **Test API endpoint:**
   ```bash
   curl http://localhost:5000/api/draws/latest
   # Or open in browser
   ```

## Step 5: Check Frontend Connection

1. **Verify backend is running** (should see server logs)

2. **Check browser console** for:
   - `ERR_CONNECTION_REFUSED` → Backend not running
   - `404 Not Found` → Wrong API URL
   - `500 Internal Server Error` → Backend error (check backend logs)

3. **Test API directly:**
   - Open: `http://localhost:5000/api/draws/latest`
   - Should return JSON with draw data or empty array

## Quick Diagnostic Commands

### Windows PowerShell (as Administrator)

```powershell
# Check PostgreSQL service
Get-Service postgresql*

# Check if port 5432 is in use
netstat -an | Select-String "5432"

# Check backend .env file
Get-Content backend\.env | Select-String "DATABASE_URL"
```

### Check Database Connection from Node.js

Create a test file `backend/test-db.js`:

```javascript
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.query('SELECT NOW()')
  .then((res) => {
    console.log('✅ Database connected:', res.rows[0]);
    return pool.query('SELECT COUNT(*) FROM draws');
  })
  .then((res) => {
    console.log('📊 Draw count:', res.rows[0].count);
    pool.end();
  })
  .catch((err) => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });
```

Run: `node backend/test-db.js`

## Expected Results

### Healthy Database:
- ✅ Connection successful
- ✅ `draws` table exists
- ✅ Draw count > 0
- ✅ Latest draw date is recent
- ✅ Date range shows historical data

### Empty Database:
- ✅ Connection successful
- ✅ `draws` table exists
- ⚠️ Draw count = 0
- **Action:** Run `npm run scrape` to populate

### Connection Issues:
- ❌ Connection failed
- **Check:** PostgreSQL running, DATABASE_URL correct, firewall settings

---

**Next Steps:**
1. Run `npm run check-db` in backend directory
2. Review the output
3. Follow solutions based on the errors shown
4. If database is empty, run `npm run scrape` to populate data

