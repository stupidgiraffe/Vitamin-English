# 🚀 Quick SQL Reference - What to Run in Neon SQL Editor

## ⚡ START HERE - Run This First

Copy and paste this into your Neon SQL editor to check everything:

```sql
-- Quick Database Health Check
SELECT 
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'teacher_comment_sheets') as "✓ teacher_comment_sheets exists",
    NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lesson_reports') as "✓ lesson_reports removed",
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'monthly_reports') as "✓ monthly_reports exists",
    EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'monthly_report_weeks' 
        AND column_name = 'teacher_comment_sheet_id'
    ) as "✓ correct column name";
```

**✅ All should be `true` (or `t`)** - If not, see full guide in `SQL_QUERIES_FOR_NEON_EDITOR.md`

---

## 📊 Check What Data You Have

```sql
SELECT 
    (SELECT COUNT(*) FROM users) as users,
    (SELECT COUNT(*) FROM classes) as classes,
    (SELECT COUNT(*) FROM students) as students,
    (SELECT COUNT(*) FROM attendance) as attendance,
    (SELECT COUNT(*) FROM teacher_comment_sheets) as reports;
```

---

## 👥 View Your Users (Should Have Default Admin)

```sql
SELECT username, full_name, role FROM users;
```

**Expected:** At least 2 users (admin, sarah)

---

## 🔍 Test DataHub Query (Should Work Without Error)

```sql
SELECT tcs.*, c.name as class_name, u.full_name as teacher_name 
FROM teacher_comment_sheets tcs 
LEFT JOIN classes c ON tcs.class_id = c.id 
LEFT JOIN users u ON tcs.teacher_id = u.id 
LIMIT 5;
```

**✅ Should return rows or empty result (no error)**

---

## 📋 List All Your Tables

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

**Expected tables:**
- attendance
- classes
- makeup_lessons
- monthly_report_weeks
- monthly_reports
- pdf_history
- students
- teacher_comment_sheets (NOT lesson_reports)
- users

---

## 🔧 If You See Errors

1. **"relation 'lesson_reports' does not exist"**
   - ✅ Good! This means migration 005 worked
   - The table is now called `teacher_comment_sheets`

2. **"column 'lesson_report_id' does not exist"**
   - ❌ Migration 004 needs to be applied
   - The column should be `teacher_comment_sheet_id`

3. **No data in tables**
   - Normal if this is a fresh database
   - Seed data with: `npm run seed` (run in your app)

---

## 📚 Full Documentation

For complete SQL queries and troubleshooting:
👉 See `SQL_QUERIES_FOR_NEON_EDITOR.md`

For migration fixes and context:
👉 See `DATAHUB_RESOLUTION.md`
