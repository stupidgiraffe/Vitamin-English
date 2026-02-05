# Deployment Steps for Monthly Reports Fix

## Pre-Deployment Checklist

- [x] All code changes committed
- [x] Code review completed (0 issues)
- [x] Security scan passed (0 alerts)
- [x] Documentation created
- [x] Migration script tested
- [ ] Backup database before migration

## Step 1: Backup Database

```bash
# In Neon dashboard or via CLI
pg_dump $DATABASE_URL > backup_before_migration_005.sql
```

## Step 2: Run Migration

Choose one method:

### Method A: Using Migration Script (Recommended)
```bash
node scripts/run-migration-005.js
```

### Method B: Via Neon Dashboard
1. Go to Neon dashboard
2. Open SQL Editor
3. Copy contents of `database/migrations/005_rename_lesson_reports_to_teacher_comment_sheets.sql`
4. Execute

### Method C: Direct SQL
```bash
psql $DATABASE_URL -f database/migrations/005_rename_lesson_reports_to_teacher_comment_sheets.sql
```

## Step 3: Verify Migration

```bash
# Check table exists
psql $DATABASE_URL -c "SELECT COUNT(*) FROM teacher_comment_sheets;"

# Check new columns
psql $DATABASE_URL -c "SELECT start_date, end_date FROM monthly_reports LIMIT 5;"
```

## Step 4: Load Test Data (Optional)

```bash
node database/seed-january-2026.js
```

## Step 5: Test Features

1. Open application
2. Navigate to "Teacher Comment Sheets"
3. Create a new sheet
4. Generate a monthly report
5. Download PDF and verify:
   - Landscape orientation
   - Rows are categories, columns are dates
   - No "N/A" values
   - Footer shows "VitaminEnglishSchool"

## Step 6: Monitor

- Check server logs for errors
- Test API endpoints
- Verify existing data displays correctly

## Rollback (If Needed)

See MIGRATION_GUIDE_005.md for rollback instructions.

## Success Criteria

- ✅ teacher_comment_sheets table exists
- ✅ monthly_reports has start_date and end_date columns
- ✅ API endpoints respond correctly
- ✅ PDF generation works with new layout
- ✅ Frontend displays "Teacher Comment Sheets"

---

**Estimated Time**: 15-30 minutes  
**Downtime Required**: None (migration is non-breaking)  
**Risk Level**: Low (backwards compatible)
