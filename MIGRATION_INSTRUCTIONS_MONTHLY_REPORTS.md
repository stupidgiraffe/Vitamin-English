# Database Migration Instructions - Monthly Reports

## Overview
This document provides instructions for applying the database migration to add Monthly Reports functionality to the Vitamin English School system.

## Migration File
- **File**: `database/migrations/004_create_monthly_reports.sql`
- **Date Created**: 2026-02-05
- **Purpose**: Add monthly reports tables for tracking monthly progress per class

## What This Migration Does

### Tables Created
1. **monthly_reports**
   - Stores main report metadata (class, year, month, theme, status)
   - One report per class per month (enforced by UNIQUE constraint)
   - Links to users for audit trail

2. **monthly_report_weeks**
   - Stores weekly lesson data for each report
   - Up to 6 weeks per report
   - Can reference lesson_reports for data source tracking

### Indexes Created
- `idx_monthly_reports_class` - Fast lookups by class
- `idx_monthly_reports_date` - Fast lookups by year/month
- `idx_monthly_reports_status` - Fast filtering by status
- `idx_monthly_report_weeks_report` - Fast joins with monthly reports
- `idx_monthly_report_weeks_lesson` - Fast lookups of linked lesson reports

### Triggers Created
- `update_monthly_reports_updated_at` - Automatically updates `updated_at` timestamp on report changes

## Prerequisites
- PostgreSQL database access
- `psql` command-line tool or database GUI tool
- Database connection credentials

## Migration Steps

### Option 1: Using psql Command Line

#### For Local Development (SQLite)
This migration is for PostgreSQL only. If you're using SQLite locally, the feature won't work until you switch to PostgreSQL or a compatible database.

#### For PostgreSQL (Production/Staging)
1. Connect to your database:
```bash
psql "postgresql://username:password@host:port/database"
```

2. Run the migration:
```bash
\i database/migrations/004_create_monthly_reports.sql
```

3. Verify tables were created:
```sql
\dt monthly_reports
\dt monthly_report_weeks
```

4. Check indexes:
```sql
\di idx_monthly_reports*
\di idx_monthly_report_weeks*
```

### Option 2: Using Database GUI Tool

#### Using pgAdmin, DBeaver, or similar:
1. Open your database connection
2. Open a new SQL query window
3. Copy the contents of `database/migrations/004_create_monthly_reports.sql`
4. Paste and execute the SQL
5. Verify tables and indexes were created

### Option 3: Using Neon Console (if using Neon)
1. Log in to Neon console
2. Navigate to your project
3. Go to SQL Editor
4. Copy the contents of `database/migrations/004_create_monthly_reports.sql`
5. Paste and execute
6. Verify success

### Option 4: Using Railway Console (if using Railway)
1. Log in to Railway dashboard
2. Select your project and PostgreSQL service
3. Open the Query tab
4. Copy the contents of `database/migrations/004_create_monthly_reports.sql`
5. Paste and execute
6. Check Tables tab to verify

## Verification

After running the migration, verify it was successful:

### 1. Check Tables Exist
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('monthly_reports', 'monthly_report_weeks');
```

Expected result: 2 rows (both tables)

### 2. Check monthly_reports Structure
```sql
\d monthly_reports
```

Expected columns:
- id (SERIAL PRIMARY KEY)
- class_id (INTEGER, NOT NULL, FOREIGN KEY)
- year (INTEGER, NOT NULL)
- month (INTEGER, NOT NULL, CHECK constraint)
- monthly_theme (TEXT)
- status (VARCHAR(20), DEFAULT 'draft', CHECK constraint)
- pdf_url (TEXT)
- created_at (TIMESTAMP, DEFAULT)
- updated_at (TIMESTAMP, DEFAULT)
- created_by (INTEGER, FOREIGN KEY)

### 3. Check monthly_report_weeks Structure
```sql
\d monthly_report_weeks
```

Expected columns:
- id (SERIAL PRIMARY KEY)
- monthly_report_id (INTEGER, NOT NULL, FOREIGN KEY)
- week_number (INTEGER, NOT NULL, CHECK constraint)
- lesson_date (DATE)
- target (TEXT)
- vocabulary (TEXT)
- phrase (TEXT)
- others (TEXT)
- lesson_report_id (INTEGER, FOREIGN KEY)

### 4. Check Indexes
```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename IN ('monthly_reports', 'monthly_report_weeks')
ORDER BY tablename, indexname;
```

Expected indexes:
- idx_monthly_reports_class
- idx_monthly_reports_date
- idx_monthly_reports_status
- idx_monthly_report_weeks_lesson
- idx_monthly_report_weeks_report

### 5. Check Trigger
```sql
SELECT tgname, tgtype 
FROM pg_trigger 
WHERE tgrelid = 'monthly_reports'::regclass;
```

Expected trigger: monthly_reports_updated_at

## Rollback (If Needed)

If you need to undo this migration:

```sql
-- Drop tables (this will cascade to related data)
DROP TABLE IF EXISTS monthly_report_weeks CASCADE;
DROP TABLE IF EXISTS monthly_reports CASCADE;

-- Drop function (if needed)
DROP FUNCTION IF EXISTS update_monthly_reports_updated_at() CASCADE;
```

**Warning**: Rolling back will delete all monthly reports data!

## Post-Migration Steps

1. **Restart Application**: Restart the Node.js server to load the new routes
```bash
npm start
# or
node server.js
```

2. **Verify API Endpoints**: Check that new endpoints are accessible
```bash
curl -X GET http://localhost:3000/api/monthly-reports \
  -H "Cookie: vitamin_session=<your-session-cookie>"
```

3. **Test in Browser**: 
   - Log in to the application
   - Navigate to "Monthly Reports" in the menu
   - Try creating a test report

## Common Issues

### Issue: "relation already exists"
**Solution**: Tables already exist. Check if migration was already applied. Use `DROP TABLE` commands if you need to re-apply.

### Issue: "permission denied"
**Solution**: Ensure your database user has CREATE TABLE permissions.

### Issue: "syntax error near 'RETURNS TRIGGER'"
**Solution**: Ensure you're using PostgreSQL, not SQLite or MySQL. This syntax is PostgreSQL-specific.

### Issue: Migration runs but app doesn't show monthly reports
**Solution**: 
1. Check that server.js was updated to include monthly reports routes
2. Verify the route is registered: grep "monthlyReports" server.js
3. Restart the application server
4. Clear browser cache

## Additional Notes

- **Idempotent**: The migration uses `CREATE TABLE IF NOT EXISTS`, so it's safe to run multiple times
- **No Data Loss**: This migration only adds new tables, doesn't modify existing ones
- **Backward Compatible**: Existing features continue to work unchanged
- **Foreign Keys**: CASCADE delete ensures data integrity when classes or users are deleted

## Support

If you encounter issues during migration:
1. Check PostgreSQL logs for error details
2. Verify database connection credentials
3. Ensure PostgreSQL version is 12 or higher
4. Contact system administrator if permissions issues persist

---
**Migration Version**: 004
**Created**: 2026-02-05
**Database**: PostgreSQL 12+
