# Install Required Dependencies

Before running the application, you need to install the following dependencies for authentication and subscription features.

## Backend Dependencies

```bash
cd backend
npm install jsonwebtoken bcrypt
npm install --save-dev @types/jsonwebtoken @types/bcrypt
```

## Frontend Dependencies

No additional dependencies needed - all required packages are already in `package.json`.

## Environment Variables

Add to `backend/.env`:

```env
# JWT Secret (generate a strong random string)
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# Frontend URL (for CORS)
CORS_ORIGIN=http://localhost:3000,https://yourdomain.com
```

## Generate JWT Secret

You can generate a secure JWT secret using:

```bash
# Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Or use an online generator
```

## Database Migration

Make sure the users and subscriptions tables exist:

```bash
cd backend
npm run migrate
```

Or manually run:
```bash
psql -U username -d ghana_lottery -f src/database/migrations/002_add_users_and_subscriptions.sql
```

## Testing

After installation:

1. Start backend: `cd backend && npm run dev`
2. Start frontend: `cd frontend && npm run dev`
3. Navigate to `http://localhost:3000/register` to create an account
4. Login at `http://localhost:3000/login`
5. Access subscription page at `http://localhost:3000/subscription`

