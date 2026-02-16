# SQL Queries for Neon SQL Editor

This guide provides SQL queries you can copy and paste into your Neon database SQL editor to check the database status, verify migrations, and troubleshoot issues.

## 📋 Table of Contents
1. [Check Database Status](#check-database-status)
2. [Verify Migrations Applied](#verify-migrations-applied)
3. [View Data Counts](#view-data-counts)
4. [Check Table Schemas](#check-table-schemas)
5. [Test DataHub Queries](#test-datahub-queries)
6. [Troubleshooting Queries](#troubleshooting-queries)

---

## 1. Check Database Status

### List all tables in your database
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

### Check which tables exist (migration verification)
```sql
SELECT 
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') as has_users,
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'classes') as has_classes,
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'students') as has_students,
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'attendance') as has_attendance,
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'teacher_comment_sheets') as has_teacher_comment_sheets,
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'monthly_reports') as has_monthly_reports,
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'monthly_report_weeks') as has_monthly_report_weeks,
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'makeup_lessons') as has_makeup_lessons,
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lesson_reports') as has_lesson_reports_OLD;
```

**What to look for:**
- ✅ All tables should return `true` except `has_lesson_reports_OLD` which should be `false`
- ❌ If `has_lesson_reports_OLD` is `true`, migration 005 hasn't been applied

---

## 2. Verify Migrations Applied

### Check if Migration 004 was applied (monthly_reports tables)
```sql
-- Check if monthly_reports table exists with correct columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'monthly_reports'
ORDER BY ordinal_position;

-- Check if monthly_report_weeks has correct foreign key column
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'monthly_report_weeks'
  AND column_name = 'teacher_comment_sheet_id';
```

**What to look for:**
- ✅ monthly_reports should have columns: id, class_id, year, month, monthly_theme, status, pdf_url, start_date, end_date, created_at, updated_at, created_by
- ✅ monthly_report_weeks should have `teacher_comment_sheet_id` column (NOT `lesson_report_id`)

### Check if Migration 005 was applied (table rename)
```sql
-- This should return rows (table exists)
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'teacher_comment_sheets';

-- This should return NO rows (old name shouldn't exist)
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'lesson_reports';

-- Check if start_date and end_date columns were added to monthly_reports
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'monthly_reports'
  AND column_name IN ('start_date', 'end_date');
```

**What to look for:**
- ✅ First query returns 1 row (`teacher_comment_sheets` exists)
- ✅ Second query returns 0 rows (`lesson_reports` doesn't exist)
- ✅ Third query returns 2 rows (`start_date` and `end_date` exist)

---

## 3. View Data Counts

### Count records in each table
```sql
SELECT 
    (SELECT COUNT(*) FROM users) as users_count,
    (SELECT COUNT(*) FROM classes) as classes_count,
    (SELECT COUNT(*) FROM students) as students_count,
    (SELECT COUNT(*) FROM attendance) as attendance_count,
    (SELECT COUNT(*) FROM teacher_comment_sheets) as teacher_comment_sheets_count,
    (SELECT COUNT(*) FROM monthly_reports) as monthly_reports_count,
    (SELECT COUNT(*) FROM makeup_lessons) as makeup_lessons_count;
```

**What to look for:**
- If all counts are 0, you need to seed test data
- At minimum you should have at least 1-2 users

### View sample users
```sql
SELECT id, username, full_name, role, created_at
FROM users
ORDER BY id
LIMIT 10;
```

**Default users after initialization:**
- `admin` / `admin123` (admin role)
- `sarah` / `teacher123` (teacher role)

---

## 4. Check Table Schemas

### View teacher_comment_sheets schema (verify correct table name)
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'teacher_comment_sheets'
ORDER BY ordinal_position;
```

### View foreign key constraints
```sql
SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'monthly_report_weeks';
```

**What to look for:**
- ✅ Should show `teacher_comment_sheet_id` referencing `teacher_comment_sheets(id)`
- ❌ Should NOT show any reference to `lesson_reports`

---

## 5. Test DataHub Queries

These are the exact queries the DataHub uses to display data:

### Test Students query
```sql
SELECT s.*, c.name as class_name 
FROM students s 
LEFT JOIN classes c ON s.class_id = c.id 
WHERE s.active = true
ORDER BY s.name
LIMIT 10;
```

### Test Classes query
```sql
SELECT c.*, u.full_name as teacher_name 
FROM classes c 
LEFT JOIN users u ON c.teacher_id = u.id 
WHERE c.active = true
ORDER BY c.name
LIMIT 10;
```

### Test Attendance query
```sql
SELECT a.*, s.name as student_name, c.name as class_name 
FROM attendance a 
LEFT JOIN students s ON a.student_id = s.id 
LEFT JOIN classes c ON a.class_id = c.id 
ORDER BY a.date DESC, s.name 
LIMIT 10;
```

### Test Teacher Comment Sheets query
```sql
SELECT tcs.*, c.name as class_name, u.full_name as teacher_name 
FROM teacher_comment_sheets tcs 
LEFT JOIN classes c ON tcs.class_id = c.id 
LEFT JOIN users u ON tcs.teacher_id = u.id 
ORDER BY tcs.date DESC 
LIMIT 10;
```

### Test Monthly Reports query
```sql
SELECT mr.*, c.name as class_name 
FROM monthly_reports mr 
LEFT JOIN classes c ON mr.class_id = c.id 
ORDER BY mr.year DESC, mr.month DESC, mr.created_at DESC 
LIMIT 10;
```

**What to look for:**
- ✅ All queries should execute without errors
- ✅ Queries may return 0 rows if you haven't added data yet, but should not error

---

## 6. Troubleshooting Queries

### Check if there are any broken foreign keys
```sql
-- Check monthly_report_weeks references
SELECT 
    mrw.id,
    mrw.monthly_report_id,
    mrw.teacher_comment_sheet_id,
    CASE 
        WHEN mr.id IS NULL THEN 'BROKEN: monthly_report not found'
        ELSE 'OK'
    END as monthly_report_status,
    CASE 
        WHEN tcs.id IS NULL AND mrw.teacher_comment_sheet_id IS NOT NULL THEN 'BROKEN: teacher_comment_sheet not found'
        ELSE 'OK'
    END as teacher_comment_sheet_status
FROM monthly_report_weeks mrw
LEFT JOIN monthly_reports mr ON mrw.monthly_report_id = mr.id
LEFT JOIN teacher_comment_sheets tcs ON mrw.teacher_comment_sheet_id = tcs.id;
```

### Check for duplicate constraints
```sql
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    conrelid::regclass as table_name
FROM pg_constraint
WHERE conrelid IN (
    'monthly_reports'::regclass,
    'monthly_report_weeks'::regclass
)
ORDER BY table_name, constraint_type;
```

### View indexes on monthly_report_weeks
```sql
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'monthly_report_weeks';
```

**What to look for:**
- ✅ Index on `teacher_comment_sheet_id` (NOT `lesson_report_id`)
- ❌ If you see `lesson_report_id` index, migrations haven't been applied correctly

---

## 🔧 Common Issues and Fixes

### Issue: "relation 'lesson_reports' does not exist"

**Diagnosis:**
```sql
-- Check if old table name exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'lesson_reports';
```

**Fix:** Migration 005 needs to be applied. The table should be named `teacher_comment_sheets`.

### Issue: "column 'lesson_report_id' does not exist"

**Diagnosis:**
```sql
-- Check column names in monthly_report_weeks
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'monthly_report_weeks';
```

**Fix:** Migrations 004 and 005 need to be applied. The column should be named `teacher_comment_sheet_id`.

### Issue: DataHub shows no data

**Diagnosis:**
```sql
-- Check record counts
SELECT 
    (SELECT COUNT(*) FROM students) as students,
    (SELECT COUNT(*) FROM classes) as classes,
    (SELECT COUNT(*) FROM attendance) as attendance;
```

**Fix:** If all counts are 0, you need to seed test data. Use the seed script or manually insert data.

---

## 🚀 Quick Start - Copy & Paste This First

Run this comprehensive check to verify your database is correctly set up:

```sql
-- Comprehensive Database Health Check
SELECT 'DATABASE HEALTH CHECK' as info;

-- 1. Check tables exist
SELECT 
    'Tables Check' as check_type,
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'teacher_comment_sheets') as teacher_comment_sheets_exists,
    NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lesson_reports') as lesson_reports_removed,
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'monthly_reports') as monthly_reports_exists,
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'monthly_report_weeks') as monthly_report_weeks_exists;

-- 2. Check column naming
SELECT 
    'Column Naming Check' as check_type,
    EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'monthly_report_weeks' 
        AND column_name = 'teacher_comment_sheet_id'
    ) as has_correct_column_name,
    NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'monthly_report_weeks' 
        AND column_name = 'lesson_report_id'
    ) as old_column_removed;

-- 3. Check data counts
SELECT 
    'Data Counts' as check_type,
    (SELECT COUNT(*) FROM users) as users,
    (SELECT COUNT(*) FROM classes) as classes,
    (SELECT COUNT(*) FROM students) as students,
    (SELECT COUNT(*) FROM attendance) as attendance,
    (SELECT COUNT(*) FROM teacher_comment_sheets) as teacher_comment_sheets,
    (SELECT COUNT(*) FROM monthly_reports) as monthly_reports;

-- 4. Test DataHub query (should not error)
SELECT 'DataHub Query Test' as check_type, COUNT(*) as test_query_works
FROM teacher_comment_sheets tcs 
LEFT JOIN classes c ON tcs.class_id = c.id 
LEFT JOIN users u ON tcs.teacher_id = u.id;
```

**Expected Results:**
1. ✅ All `*_exists` should be `true`, `lesson_reports_removed` should be `true`
2. ✅ `has_correct_column_name` should be `true`, `old_column_removed` should be `true`
3. ✅ At least 1-2 users should exist
4. ✅ DataHub query test should return a row (even if count is 0)

---

## 📝 Notes

- All queries are read-only and safe to run
- These queries won't modify your data
- If you need to reset your database, see the repository's database setup documentation
- For applying migrations, use `npm run migrate` or the GitHub Actions workflow

## Need Help?

If queries are failing or returning unexpected results:
1. Check the DATAHUB_RESOLUTION.md file in the repository
2. Review the DATABASE_FIXES_SUMMARY.md for technical details
3. Verify migrations have been applied using the GitHub Actions workflow
