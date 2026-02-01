# Deployment Guide: Vercel + Neon PostgreSQL + Cloudflare R2

This guide covers deploying the Vitamin English application to Vercel with Neon PostgreSQL database and Cloudflare R2 for PDF storage.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Neon PostgreSQL Setup](#neon-postgresql-setup)
3. [Cloudflare R2 Setup](#cloudflare-r2-setup)
4. [Vercel Deployment](#vercel-deployment)
5. [Data Migration from Railway](#data-migration-from-railway)
6. [Environment Variables](#environment-variables)
7. [Testing](#testing)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

- GitHub account
- Vercel account (free tier is sufficient)
- Neon account (free tier available)
- Cloudflare account (R2 has a free tier)
- Railway account (for data migration only)

## Neon PostgreSQL Setup

### 1. Create a Neon Project

1. Go to [Neon Console](https://console.neon.tech/)
2. Click **"New Project"**
3. Enter project name: `vitamin-english`
4. Select region (choose closest to your users)
5. Click **"Create Project"**

### 2. Get Database Connection String

1. In your project dashboard, find the **Connection Details** section
2. Copy the connection string (should look like):
   ```
   postgresql://username:password@host.neon.tech/database?sslmode=require
   ```
3. Save this for later use in environment variables

### 3. Initialize Database Schema

1. In Neon Console, click **"SQL Editor"**
2. Copy the contents of `database/schema-postgres.sql` from this repository
3. Paste into the SQL Editor
4. Click **"Run"** to create all tables and indexes
5. Verify tables were created successfully

### 4. Schema Sync for Existing Databases

If you have an existing database that needs schema updates, run these SQL statements in Neon SQL Editor to ensure all required columns exist:

```sql
-- Ensure students table has all required contact columns
ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_phone VARCHAR(50);
ALTER TABLE students ADD COLUMN IF NOT EXISTS color_code VARCHAR(50);
ALTER TABLE students ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE students ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_name VARCHAR(255);
ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_email VARCHAR(255);
ALTER TABLE students ADD COLUMN IF NOT EXISTS enrollment_date VARCHAR(50);

-- Ensure classes table has color column
ALTER TABLE classes ADD COLUMN IF NOT EXISTS color VARCHAR(50) DEFAULT '#4A90E2';
```

**Note:** The application now includes an automatic schema guard that runs on startup and adds missing columns automatically. However, running these SQL statements manually ensures the schema is correct before deployment.

## Cloudflare R2 Setup

### 1. Enable R2

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Go to **R2 Object Storage** in the sidebar
3. If first time, click **"Purchase R2 Plan"** (free tier available)
4. Click **"Create bucket"**

### 2. Create R2 Bucket

1. Bucket name: `vitamin-english-pdfs` (or your preferred name)
2. Location: Automatic (or select preferred region)
3. Click **"Create bucket"**

### 3. Generate R2 API Tokens

1. Go to **R2** → **Manage R2 API Tokens**
2. Click **"Create API token"**
3. Token name: `vitamin-english-api`
4. Permissions: **"Object Read & Write"**
5. Specify bucket: Select `vitamin-english-pdfs`
6. Click **"Create API Token"**
7. **IMPORTANT**: Copy and save:
   - Access Key ID
   - Secret Access Key
   - Endpoint URL (looks like: `https://[account-id].r2.cloudflarestorage.com`)
   - Account ID

⚠️ **You won't be able to see the Secret Access Key again!**

### 4. Configure Bucket CORS (Optional)

If you want PDFs to be downloadable directly from browser:

1. Go to your bucket settings
2. Add CORS policy:
```json
[
  {
    "AllowedOrigins": ["https://your-vercel-domain.vercel.app"],
    "AllowedMethods": ["GET"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3000
  }
]
```

## Vercel Deployment

### 1. Prepare Repository

1. Fork or push this repository to your GitHub account
2. Ensure all changes are committed

### 2. Import to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New"** → **"Project"**
3. Import your GitHub repository
4. Vercel will auto-detect the Node.js configuration

### 3. Configure Build Settings

Vercel should auto-detect these settings, but verify:

- **Framework Preset**: Other
- **Build Command**: (leave empty - no build needed)
- **Output Directory**: (leave empty)
- **Install Command**: `npm install`

### 4. Add Environment Variables

Click **"Environment Variables"** and add:

```bash
# Database
DATABASE_URL=postgresql://username:password@host.neon.tech/database?sslmode=require

# Session
SESSION_SECRET=your-random-secret-key-min-32-characters-long
NODE_ENV=production

# CORS (update with your actual Vercel domain)
CORS_ORIGIN=https://your-app.vercel.app

# Cloudflare R2
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key
R2_BUCKET_NAME=vitamin-english-pdfs
R2_ENDPOINT=https://[account-id].r2.cloudflarestorage.com
```

⚠️ **Generate a strong SESSION_SECRET**:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 5. Deploy

1. Click **"Deploy"**
2. Wait for deployment to complete (usually 1-2 minutes)
3. Vercel will provide a URL: `https://your-app.vercel.app`

### 6. Set Custom Domain (Optional)

1. Go to Project Settings → Domains
2. Add your custom domain
3. Configure DNS as instructed
4. Update `CORS_ORIGIN` environment variable
5. Redeploy

## Data Migration from Railway

### Option A: Using Migration Script (Recommended)

1. **On Railway**, run the migration script:
   ```bash
   node scripts/migrate-to-neon.js
   ```

2. Download the generated `migration.sql` file from Railway

3. **Import to Neon**:
   
   **Method 1: Using psql**
   ```bash
   psql "postgresql://username:password@host.neon.tech/database?sslmode=require" < migration.sql
   ```
   
   **Method 2: Using Neon SQL Editor**
   - Open Neon Console → SQL Editor
   - Copy contents of `migration.sql`
   - Paste and click "Run"

4. Verify data was imported:
   ```sql
   SELECT COUNT(*) FROM users;
   SELECT COUNT(*) FROM students;
   SELECT COUNT(*) FROM classes;
   ```

### Option B: Manual Export/Import

If you have a small dataset:

1. Export from Railway SQLite using a database tool
2. Convert to PostgreSQL format
3. Import using Neon SQL Editor

## Environment Variables

Complete reference of all environment variables:

### Core Required Variables

These are **required** for the application to run:

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | **Yes** | PostgreSQL connection string from Neon | `postgresql://user:pass@host.neon.tech/db?sslmode=require` |
| `SESSION_SECRET` | **Yes** | Secret for session encryption (min 32 chars) | Random 32+ char string |
| `NODE_ENV` | **Yes** | Environment mode | `production` |

### Optional Configuration Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `SEED_ON_STARTUP` | No | Auto-seed empty database on startup | `true` (enabled) |
| `CORS_ORIGIN` | No | Allowed CORS origin for API calls | Same origin |
| `COOKIE_DOMAIN` | No | Cookie domain for sessions | Auto-detected |

### PDF Storage Variables (R2)

Required only for PDF generation features:

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `R2_ACCOUNT_ID` | Yes* | Cloudflare account ID | `abc123...` |
| `R2_ACCESS_KEY_ID` | Yes* | R2 access key | `key123...` |
| `R2_SECRET_ACCESS_KEY` | Yes* | R2 secret key | `secret123...` |
| `R2_BUCKET_NAME` | Yes* | R2 bucket name | `vitamin-english-pdfs` |
| `R2_ENDPOINT` | Yes* | R2 endpoint URL | `https://[id].r2.cloudflarestorage.com` |

\* Required for PDF generation features. App will work without R2, but PDF endpoints will return 503.

### Seed Data Control

The application includes a seeding mechanism that automatically populates an empty database with test data:
- 4 classes: Adult beginner, Intermediate, Advanced, Young elementary
- 4 students with realistic contact information (email, phone, parent contact info)
- Sample attendance records for the past 3 days

**For Production:**
- Set `SEED_ON_STARTUP=false` to prevent auto-seeding
- Use the admin endpoint `/api/admin/seed-data` to manually seed once if needed
- See [SEED_DATA.md](SEED_DATA.md) for complete seed data documentation

**For Development/Staging:**
- Leave `SEED_ON_STARTUP` unset or set to `true`
- Database will auto-seed on first run if empty

## Testing

### 1. Health Check

```bash
curl https://your-app.vercel.app/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-25T12:00:00.000Z"
}
```

### 2. Database Connection

Try logging in with default credentials:
- Username: `admin`
- Password: `admin123`

⚠️ **Change default passwords immediately after deployment!**

### 3. Seed Test Data (Optional)

If you want to populate the database with test data:

**Option 1: Auto-seed on first deploy**
- Don't set `SEED_ON_STARTUP` (it defaults to enabled)
- Database will auto-populate on first run if empty

**Option 2: Manual seeding**
1. Set `SEED_ON_STARTUP=false` in Vercel
2. Deploy the application
3. Login as admin
4. Use curl or Postman to call:
   ```bash
   curl -X POST https://your-app.vercel.app/api/admin/seed-data \
     -H "Content-Type: application/json" \
     --cookie "vitamin_session=your-session-cookie"
   ```

See [SEED_DATA.md](SEED_DATA.md) for complete documentation.

### 4. Test Features

- ✅ Login/logout
- ✅ View students, classes, attendance
- ✅ Create/update records
- ✅ Search functionality (with and without keywords)
- ✅ Generate PDFs (if R2 is configured)
- ✅ Download PDFs

### 5. Check Logs

In Vercel Dashboard:
1. Go to your project
2. Click **"Deployments"**
3. Click on the latest deployment
4. Click **"View Function Logs"**

## Troubleshooting

### Database Connection Issues

**Error: "Failed to connect to database"**

Solution:
- Verify `DATABASE_URL` is correct in Vercel environment variables
- Ensure URL includes `?sslmode=require`
- Check Neon project is active (not suspended)

### PDF Generation Issues

**Error: "PDF storage not configured"**

Solution:
- Verify all R2 environment variables are set
- Check R2 credentials are correct
- Ensure R2 bucket exists

**Error: "Failed to upload PDF"**

Solution:
- Check R2 API token has write permissions
- Verify bucket name matches `R2_BUCKET_NAME`
- Check Cloudflare R2 service status

### Search Not Working

**Issue: Search requires query parameter**

Solution:
- Make sure you deployed the latest code
- Search now works without query: `/api/database/search?type=students`

### Session/Login Issues

**Error: "Session not persisting"**

Solution:
- Verify `SESSION_SECRET` is set
- Check cookies are enabled in browser
- For custom domains, update `CORS_ORIGIN`

### Vercel Function Timeout

**Error: "Function execution timeout"**

Solution:
- Vercel free tier has 10-second timeout
- Consider upgrading to Pro for 60-second timeout
- Optimize database queries
- Use pagination for large result sets

## Performance Optimization

### Database

1. **Connection Pooling**: Configured automatically with `pg.Pool`
2. **Indexes**: Created in schema for common queries
3. **Query Limits**: Most queries limited to 50-100 results

### Vercel

1. **Edge Caching**: Static files cached at edge
2. **Compression**: Enabled by default
3. **Serverless Functions**: Auto-scales based on traffic

### R2 Storage

1. **Signed URLs**: Use temporary URLs for downloads
2. **Lifecycle Rules**: Consider adding to delete old PDFs

## Monitoring

### Vercel Analytics

Enable in project settings for:
- Page views
- API usage
- Function performance
- Error rates

### Neon Monitoring

Check database metrics:
- Connection count
- Query performance
- Storage usage

### Logs

- **Vercel**: Function logs in deployment details
- **Neon**: Query logs in project dashboard
- **Cloudflare**: R2 access logs in analytics

## Backup Strategy

### Database Backups

**Neon automatic backups:**
- Free tier: 7 days retention
- Pro tier: 30 days retention
- Point-in-time recovery available

**Manual backup:**
```bash
pg_dump "postgresql://user:pass@host/db" > backup.sql
```

### R2 Backups

**Option 1: R2 Replication**
- Configure bucket replication to another bucket

**Option 2: Download PDFs**
- Use `/api/pdf/history` to list all PDFs
- Download and store elsewhere

## Security Checklist

- [ ] Change default admin password
- [ ] Generate strong SESSION_SECRET
- [ ] Enable Vercel password protection (optional)
- [ ] Configure proper CORS_ORIGIN
- [ ] Review R2 bucket permissions
- [ ] Enable Vercel deployment protection
- [ ] Set up monitoring and alerts
- [ ] Regular security updates (npm audit)

## Support

For issues:
1. Check logs in Vercel dashboard
2. Check Neon project status
3. Verify all environment variables
4. Review this troubleshooting guide
5. Check GitHub issues

## Next Steps

After successful deployment:

1. **Change default passwords**
2. **Test all features thoroughly**
3. **Set up monitoring**
4. **Configure backups**
5. **Add custom domain** (optional)
6. **Train users** on new features (improved search, PDF generation)

---

**Congratulations!** Your Vitamin English app is now running on Vercel with Neon PostgreSQL and Cloudflare R2! 🎉
