# Database Setup Guide - IMPORTANT

## Problem: "Nothing is saved in the database"

This usually means the database is not properly configured. Follow these steps to fix it.

## Quick Fix (5 minutes)

### Step 1: Set up your DATABASE_URL

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

### Step 2: Get a free PostgreSQL database

**Option A: Neon (Recommended - 100% Free)**
1. Go to https://neon.tech
2. Sign up (free, no credit card required)
3. Create a new project
4. Copy the connection string (looks like: `postgresql://username:password@ep-...neon.tech/neondb`)
5. Paste it in your `.env` file as `DATABASE_URL=...`

**Option B: Railway (Free with limits)**
1. Go to https://railway.app
2. Sign up
3. Create a new PostgreSQL database
4. Copy the DATABASE_URL from the variables tab
5. Paste it in your `.env` file

**Option C: Local PostgreSQL**
```bash
# Install PostgreSQL locally, then:
DATABASE_URL=postgresql://localhost:5432/vitamin_english
```

### Step 3: Start the application

```bash
npm install
npm start
```

The application will now:
- ✅ Automatically create all database tables
- ✅ Create default admin and teacher users
- ✅ Optionally seed test data

### Step 4: Login

Default credentials:
- **Admin**: username: `admin`, password: `admin123`
- **Teacher**: username: `sarah`, password: `teacher123`

⚠️ **Change these passwords immediately after first login!**

## What was wrong?

The database wasn't configured because:
1. No `.env` file existed (only `.env.example`)
2. `DATABASE_URL` environment variable was not set
3. The database tables were never created

## Auto-Setup Features (NEW)

The application now automatically:
- ✅ Creates all database tables on first run
- ✅ Creates default users (admin and teacher)
- ✅ Seeds test data if the database is empty
- ✅ Shows clear error messages if DATABASE_URL is missing

## Verification

To verify everything is working:

1. **Check database health:**
   ```
   Visit: http://localhost:3000/health
   ```
   Should show: `{"status":"healthy","database":{"ok":true,...}}`

2. **Check database stats:**
   ```
   Visit: http://localhost:3000/api/database/stats
   ```
   (Requires login)

3. **Try creating a student:**
   - Login to the application
   - Go to Students tab
   - Click "Add Student"
   - Fill in name and submit
   - Refresh the page - student should persist

## Still Having Issues?

### Error: "DATABASE_URL is required but not configured"
- Make sure you created a `.env` file (not `.env.txt` or `.env.example`)
- Make sure the file contains: `DATABASE_URL=postgresql://...`
- Restart the server after creating/editing `.env`

### Error: "Connection refused" or "Cannot connect to database"
- Check that your database is running (for local PostgreSQL)
- Verify the DATABASE_URL is correct
- For Neon/Railway, check your internet connection

### Data disappears after restart
- Your database might be using ephemeral storage
- Neon free tier persists data permanently
- Railway free tier might have limits

## Migration from Old Setup

If you previously used the manual schema setup:

1. Your existing data is safe
2. The new auto-setup detects existing tables
3. No duplicate tables will be created
4. Migration 009 (DataHub improvements) will run automatically

## Technical Details

### What the auto-setup does:

1. **Checks if DATABASE_URL exists** - fails fast with helpful error if not
2. **Checks if tables exist** - queries information_schema
3. **Creates schema if needed** - runs `database/schema-postgres.sql`
4. **Creates default users** - admin and teacher accounts
5. **Optionally seeds data** - if `SEED_ON_STARTUP` is not 'false'

### Files involved:

- `database/connection.js` - Validates DATABASE_URL
- `database/init-postgres.js` - Auto-creates schema and users
- `database/schema-postgres.sql` - Complete table definitions
- `server.js` - Runs initialization on startup

## Environment Variables

Required:
```env
DATABASE_URL=postgresql://user:pass@host/database
```

Optional:
```env
SESSION_SECRET=random-string-min-32-chars
SEED_ON_STARTUP=false  # Set to 'false' to disable auto-seed
NODE_ENV=production
```

## Need More Help?

Check these files for detailed information:
- `README.md` - Full installation guide
- `DEPLOYMENT.md` - Production deployment guide
- `.env.example` - All available environment variables

Or raise an issue on GitHub with:
- Error messages from console
- Your DATABASE_URL (without password!)
- Node.js version (`node --version`)
