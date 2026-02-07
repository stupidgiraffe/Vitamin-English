# Database Migration Instructions

## Overview

This document provides step-by-step instructions for applying database migrations to fix critical issues with the Vitamin English application.

## What's Being Fixed

The application requires two critical migrations:

1. **Migration 004**: Creates `monthly_reports` and `monthly_report_weeks` tables
2. **Migration 005**: Renames `lesson_reports` → `teacher_comment_sheets` and adds date range columns

These migrations fix:
- ✅ Login error: "reports can't be fetched"
- ✅ Cannot save teacher comment sheets (name conflicts)
- ✅ Cannot save monthly reports (dependencies not working)

## Prerequisites

- Access to your Neon PostgreSQL database
- `DATABASE_URL` environment variable properly set
- Node.js installed (version 18+)

## Quick Start

### Check if Migrations Are Needed

1. Check migration status via API endpoint:
   ```bash
   # After logging in to the app
   curl http://localhost:3000/api/debug/migration-status
   ```

2. Or look for warnings in the server logs when starting the application:
   ```bash
   npm start
   ```
   
   You'll see warnings like:
   ```
   ⚠️  WARNING: Migration 004 not applied
   ⚠️  WARNING: Migration 005 not applied
   🚨 DATABASE SCHEMA IS OUTDATED
   ```

### Apply Migrations

1. **Navigate to the project directory**:
   ```bash
   cd /path/to/Vitamin-English
   ```

2. **Ensure DATABASE_URL is set**:
   ```bash
   # Check if it's set
   echo $DATABASE_URL
   
   # If not set, set it now (replace with your actual Neon connection string)
   export DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
   ```

3. **Run the migration script**:
   ```bash
   node scripts/apply-migrations.js
   ```

4. **Verify the migrations**:
   The script will automatically verify and display the results. You should see:
   ```
   ✅ Migration 004 applied successfully
   ✅ Migration 005 applied successfully
   🎉 All migrations completed successfully!
   ```

5. **Restart your application**:
   ```bash
   npm start
   ```

## Detailed Migration Process

### What the Migration Script Does

The `apply-migrations.js` script:

1. ✅ Connects to your Neon PostgreSQL database
2. ✅ Checks which migrations are already applied
3. ✅ Applies missing migrations in the correct order
4. ✅ Uses database transactions for safety (rollback on error)
5. ✅ Verifies each migration was successful
6. ✅ Provides detailed console output

### Migration 004: Create Monthly Reports Tables

Creates two new tables:

**monthly_reports**:
- Stores monthly report metadata (class, year, month, theme, status, PDF URL)
- Links to classes and users
- Has indexes for performance

**monthly_report_weeks**:
- Stores weekly lesson data within monthly reports
- Links to monthly reports and lesson reports
- Supports up to 6 weeks per month

### Migration 005: Rename and Enhance Tables

Makes the following changes:

1. **Renames table**: `lesson_reports` → `teacher_comment_sheets`
2. **Updates foreign keys**: Updates references in `monthly_report_weeks`
3. **Renames indexes**: Updates index names to match new table
4. **Adds date columns**: Adds `start_date` and `end_date` to `monthly_reports`
5. **Populates dates**: Calculates dates from existing year/month values

## Backwards Compatibility

The application includes backwards compatibility features:

### Routes with Fallback Logic

**routes/reports.js**:
- Tries `teacher_comment_sheets` first
- Falls back to `lesson_reports` if needed
- Logs warnings when using old table names

**routes/monthlyReports.js**:
- Checks for table/column existence before querying
- Uses `COALESCE` for optional columns
- Provides clear error messages

### Schema Guard

The `schema-guard.js` module:
- Checks for missing migrations on startup
- Logs clear warnings if migrations are needed
- Adds missing columns automatically (where safe)
- Does not prevent app startup if migrations are missing

## Troubleshooting

### Error: "DATABASE_URL environment variable is not set"

**Solution**: Set the environment variable:
```bash
export DATABASE_URL="your-neon-connection-string"
```

Make sure to include `?sslmode=require` for Neon databases.

### Error: "permission denied"

**Solution**: Ensure your database user has sufficient permissions:
- CREATE TABLE
- ALTER TABLE
- CREATE INDEX
- CREATE FUNCTION
- CREATE TRIGGER

### Error: "relation already exists"

**Explanation**: This is normal if migrations have been partially applied.

**Solution**: The script handles this gracefully and will skip already-applied changes.

### Migrations Applied But App Still Has Errors

**Check 1**: Verify tables exist
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('teacher_comment_sheets', 'monthly_reports', 'monthly_report_weeks');
```

**Check 2**: Verify columns exist
```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'monthly_reports' 
AND column_name IN ('start_date', 'end_date');
```

**Check 3**: Restart your application server
```bash
npm start
```

### Need to Rollback?

If you need to undo the migrations:

1. **Manual rollback for Migration 005**:
   ```sql
   ALTER TABLE teacher_comment_sheets RENAME TO lesson_reports;
   ALTER TABLE monthly_report_weeks RENAME COLUMN teacher_comment_sheet_id TO lesson_report_id;
   ALTER TABLE monthly_reports DROP COLUMN IF EXISTS start_date;
   ALTER TABLE monthly_reports DROP COLUMN IF EXISTS end_date;
   ```

2. **Manual rollback for Migration 004**:
   ```sql
   DROP TABLE IF EXISTS monthly_report_weeks;
   DROP TABLE IF EXISTS monthly_reports;
   ```

⚠️ **Warning**: Rollback will delete data in `monthly_reports` and `monthly_report_weeks` tables.

## Verification Checklist

After running migrations, verify:

- [ ] Migration script completed without errors
- [ ] Server starts without migration warnings
- [ ] Can log in to the application
- [ ] Can fetch reports on the dashboard
- [ ] Can create/edit teacher comment sheets
- [ ] Can create/edit monthly reports
- [ ] No console errors in browser
- [ ] No errors in server logs

## API Endpoint for Status Check

You can check migration status programmatically:

```bash
# GET /api/debug/migration-status (requires authentication)
curl -H "Cookie: connect.sid=YOUR_SESSION_ID" \
  http://localhost:3000/api/debug/migration-status
```

Response includes:
- Which migrations are applied
- Which tables exist
- Which columns exist
- Recommendation for next steps

## Production Deployment

When deploying to production:

1. **Backup your database first**:
   ```bash
   # Use your Neon dashboard or pg_dump
   pg_dump $DATABASE_URL > backup.sql
   ```

2. **Run migrations on production**:
   ```bash
   # SSH to your server or use your deployment platform
   DATABASE_URL="production-url" node scripts/apply-migrations.js
   ```

3. **Deploy new code**:
   ```bash
   git push production main
   ```

4. **Verify in production**:
   - Check server logs for migration warnings
   - Test critical features
   - Monitor error logs

## Support

If you encounter issues not covered in this guide:

1. Check server logs for detailed error messages
2. Check browser console for client-side errors
3. Use the `/api/debug/migration-status` endpoint
4. Review the migration SQL files in `database/migrations/`
5. Contact the development team

## Files Reference

- `scripts/apply-migrations.js` - Main migration runner
- `database/migrations/004_create_monthly_reports.sql` - Migration 004 SQL
- `database/migrations/005_rename_lesson_reports_to_teacher_comment_sheets.sql` - Migration 005 SQL
- `database/schema-guard.js` - Schema validation and warnings
- `routes/reports.js` - Backwards compatible report routes
- `routes/monthlyReports.js` - Monthly report routes with checks

## Summary

The migration process is designed to be:
- ✅ Safe (uses transactions)
- ✅ Idempotent (can run multiple times)
- ✅ Backwards compatible (during transition)
- ✅ Well-tested (includes verification steps)
- ✅ Informative (detailed logging)

Follow the steps in this guide and your database will be upgraded successfully!
