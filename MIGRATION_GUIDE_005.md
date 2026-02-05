# Monthly Reports Migration Guide

## Overview

This migration renames the `lesson_reports` table to `teacher_comment_sheets` for better clarity and adds date range support to monthly reports.

## Changes Made

### 1. Database Changes
- **Table Rename**: `lesson_reports` → `teacher_comment_sheets`
- **Column Rename**: `monthly_report_weeks.lesson_report_id` → `teacher_comment_sheet_id`
- **New Columns**: Added `start_date` and `end_date` to `monthly_reports` table
- **Index Renames**: Updated index names to match new table name

### 2. Backend Changes
- **New Route**: `/api/teacher-comment-sheets` (routes/teacherCommentSheets.js)
- **Old Route**: `/api/reports` (still works for backwards compatibility)
- **Updated**: monthlyReports.js to use new table/column names
- **Enhanced**: Auto-generate and preview endpoints support both `year/month` and `start_date/end_date` parameters

### 3. PDF Generation
- **Complete Rewrite**: monthlyReportPdf.js now displays:
  - **Rows**: Categories (Date, Target, Vocabulary, Phrase, Others)
  - **Columns**: Lesson dates (dynamic)
  - Landscape orientation for better fit
  - Bilingual labels (English/Japanese)
  - Footer: "VitaminEnglishSchool" in green box
- **Fixed**: Removed emoji (🍊) from PDF headers to avoid encoding issues
- **Fixed**: Replaced all `|| 'N/A'` with `|| ''` (empty string)

### 4. Frontend Changes
- Navigation: "Lesson Reports" → "Teacher Comment Sheets"
- Admin table selector updated
- Localization files updated (en.json, ja.json)
- Support for both old and new table names during transition

## Running the Migration

### Option 1: Using the Migration Script (Recommended)
```bash
node scripts/run-migration-005.js
```

### Option 2: Manual SQL Execution
Connect to your PostgreSQL database and run:
```bash
psql $DATABASE_URL -f database/migrations/005_rename_lesson_reports_to_teacher_comment_sheets.sql
```

### Option 3: Via Neon Dashboard
1. Go to your Neon database dashboard
2. Open the SQL Editor
3. Copy the contents of `database/migrations/005_rename_lesson_reports_to_teacher_comment_sheets.sql`
4. Execute the SQL

## Loading Test Data

After running the migration, you can load January 2026 test data:

```bash
node database/seed-january-2026.js
```

This will create:
- 5 teacher comment sheets for January 2026
- 1 monthly report with all weeks populated
- Test data is for class_id=1

## Verification Steps

1. **Verify Table Rename**:
   ```sql
   SELECT COUNT(*) FROM teacher_comment_sheets;
   -- Should return count of existing records
   
   SELECT COUNT(*) FROM lesson_reports;
   -- Should return error: relation does not exist
   ```

2. **Verify New Columns**:
   ```sql
   SELECT start_date, end_date FROM monthly_reports LIMIT 5;
   -- Should show computed dates based on year/month
   ```

3. **Verify Foreign Key**:
   ```sql
   SELECT teacher_comment_sheet_id FROM monthly_report_weeks LIMIT 5;
   -- Should return IDs linking to teacher_comment_sheets
   ```

4. **Test API Endpoints**:
   - GET `/api/teacher-comment-sheets` - should list all sheets
   - GET `/api/monthly-reports/available-months/:classId` - should work
   - POST `/api/monthly-reports/auto-generate` - test with both parameter formats:
     - `{ class_id, year, month }` (backwards compatible)
     - `{ class_id, start_date, end_date }` (new format)

5. **Test PDF Generation**:
   - Generate a monthly report PDF
   - Verify:
     - Layout is landscape
     - Rows are categories, columns are dates
     - No "N/A" values appear
     - Footer shows "VitaminEnglishSchool" in green box
     - No emoji encoding issues

## Backwards Compatibility

- Old `/api/reports` route still works (redirects to same handler)
- Both `lesson_reports` and `teacher_comment_sheets` recognized in frontend
- Old `year/month` parameters still work for auto-generate
- Existing monthly reports automatically get `start_date`/`end_date` computed

## Rollback (if needed)

If you need to rollback the migration:

```sql
-- Rename table back
ALTER TABLE teacher_comment_sheets RENAME TO lesson_reports;

-- Rename column back
ALTER TABLE monthly_report_weeks RENAME COLUMN teacher_comment_sheet_id TO lesson_report_id;

-- Rename indexes back
ALTER INDEX IF EXISTS idx_teacher_comment_sheets_date RENAME TO idx_reports_date;
ALTER INDEX IF EXISTS idx_teacher_comment_sheets_class RENAME TO idx_reports_class;

-- Remove new columns (optional - data will be lost)
ALTER TABLE monthly_reports DROP COLUMN IF EXISTS start_date;
ALTER TABLE monthly_reports DROP COLUMN IF EXISTS end_date;
```

## Troubleshooting

### Migration Script Fails
- Check database connection string in `.env`
- Ensure PostgreSQL version supports all SQL commands
- Check if migration was already applied partially

### PDF Generation Issues
- Check PDFKit version: `npm list pdfkit`
- Verify R2 storage credentials if using cloud storage
- Check server logs for detailed error messages

### Frontend Not Updating
- Clear browser cache
- Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
- Check browser console for JavaScript errors

## Next Steps

1. Run migration in production
2. Monitor error logs
3. Test all monthly report features
4. Generate sample PDFs
5. Update any documentation referencing "Lesson Reports"

## Support

For issues or questions:
- Check server logs: `pm2 logs` or `railway logs`
- Review database logs in Neon dashboard
- Test endpoints with Postman or curl
- Check this repository's Issues page
