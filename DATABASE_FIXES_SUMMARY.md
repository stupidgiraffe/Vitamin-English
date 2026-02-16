# Database Fixes Summary

## Issues Identified

The DataHub was not displaying data due to database migration errors. The root cause was inconsistent table naming between migrations:

### 1. **Migration 004 - Wrong Table Reference**
**File:** `database/migrations/004_create_monthly_reports.sql`

**Problem:**
- Referenced `lesson_reports` table which doesn't exist in the base schema
- Line 30: `lesson_report_id INTEGER REFERENCES lesson_reports(id)`
- Line 39: Index on `lesson_report_id`

**Fix:**
- Changed to reference `teacher_comment_sheets` table (the correct table name)
- Updated column name to `teacher_comment_sheet_id`
- Updated index to use the correct column name

### 2. **Migration 005 - Non-Idempotent Rename**
**File:** `database/migrations/005_rename_lesson_reports_to_teacher_comment_sheets.sql`

**Problem:**
- Migration assumed `lesson_reports` table always exists
- Would fail if table was already named `teacher_comment_sheets`
- Not idempotent (couldn't be run multiple times safely)

**Fix:**
- Added conditional checks using PL/pgSQL DO blocks
- Only renames table if `lesson_reports` exists
- Only renames column if `lesson_report_id` exists
- Now safe to run multiple times

### 3. **Migration 002 - Non-Idempotent Date Update**
**File:** `database/migrations/002_normalize_date_formats.sql`

**Problem:**
- Tried to UPDATE `lesson_reports` table unconditionally
- Would fail if table didn't exist or was already renamed

**Fix:**
- Wrapped in PL/pgSQL DO block with conditional logic
- Tries `teacher_comment_sheets` first (new name)
- Falls back to `lesson_reports` (legacy name) if needed
- Skips gracefully if neither exists

### 4. **Seed Data - Wrong Table Name**
**File:** `database/seed-test-data.js`

**Problem:**
- Line 175: `DELETE FROM lesson_reports WHERE 1=1`
- References non-existent table name

**Fix:**
- Changed to `DELETE FROM teacher_comment_sheets WHERE 1=1`

## Root Cause Analysis

The base PostgreSQL schema (`database/schema-postgres.sql`) always had the `teacher_comment_sheets` table name. The `lesson_reports` name was only used in older SQLite schemas. However, migration 004 was written assuming migrations would run on a database that had `lesson_reports`, which would then be renamed by migration 005.

This created a chicken-and-egg problem:
- Fresh databases (from schema-postgres.sql) have `teacher_comment_sheets`
- Migration 004 tried to create foreign keys to `lesson_reports` (doesn't exist)
- Migration 005 tried to rename a table that was never there

## Solution

Made all migrations idempotent and consistent with the actual schema:
1. Migration 004 now correctly references `teacher_comment_sheets` from the start
2. Migration 005 gracefully handles both scenarios (table exists or doesn't)
3. Migration 002 checks for both table names before updating
4. Seed scripts use the correct table name

## DataHub Architecture

The DataHub/Database Viewer feature:
- **Frontend:** `/public/index.html` - Database Viewer page (line 398)
- **JavaScript:** `/public/js/app.js` - Search and table loading functions
- **Backend Routes:** `/routes/database.js` - API endpoints
- **API Endpoints:**
  - `GET /api/database/table/:tableName` - Load entire table
  - `GET /api/database/search` - Search across tables with filters

### Supported Tables
- students
- classes  
- attendance
- teacher_comment_sheets
- monthly_reports
- makeup_lessons
- users

## Testing Recommendations

1. **Fresh Database:** Run all migrations on a fresh database to ensure they work correctly
2. **Existing Database:** Run migrations on a database that may have partial migration state
3. **DataHub Verification:** 
   - Log in to the application
   - Navigate to Database page
   - Try searching for data
   - Try loading individual tables
   - Verify all 7 tables can be loaded

## Files Modified

1. `database/migrations/004_create_monthly_reports.sql` - Fixed table references
2. `database/migrations/005_rename_lesson_reports_to_teacher_comment_sheets.sql` - Made idempotent
3. `database/migrations/002_normalize_date_formats.sql` - Made compatible with both table names
4. `database/seed-test-data.js` - Fixed table name in clearAllData function

## Next Steps

If you have access to the Neon database:
1. Run the migration script: `npm run migrate` or use the GitHub Actions workflow
2. Verify migrations applied successfully
3. Check that DataHub displays data correctly
4. If database is in a bad state, you may need to manually drop and recreate tables

## Notes

- The base schema file (`database/schema-postgres.sql`) is already correct
- No changes needed to route handlers or frontend code
- All issues were in the migration files and seed script
