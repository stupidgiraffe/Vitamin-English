# Quick Reference - Monthly Reports Fix

## 🚀 What Changed

### Database
- `lesson_reports` → `teacher_comment_sheets` (table renamed)
- `lesson_report_id` → `teacher_comment_sheet_id` (column renamed)
- Added `start_date` and `end_date` columns to `monthly_reports`

### API Endpoints
- **NEW**: `/api/teacher-comment-sheets` (replaces `/api/reports`)
- **OLD**: `/api/reports` (still works for backwards compatibility)
- Both support date ranges: `?startDate=2026-01-01&endDate=2026-01-31`

### Monthly Report PDF
- **Layout**: Landscape (was Portrait)
- **Structure**: Categories as rows, Dates as columns (was Weeks as rows)
- **Labels**: Bilingual - English + Japanese
- **Theme Section**: Added 今月のテーマ area
- **No "N/A"**: Empty fields are blank

---

## 📋 Deployment Steps (Quick)

### 1. Backup Database
```bash
# PostgreSQL
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

### 2. Run Migration
```bash
cd database/migrations
psql $DATABASE_URL -f 005_rename_lesson_reports_to_teacher_comment_sheets.sql
```

### 3. Verify Migration
```bash
psql $DATABASE_URL -c "\d teacher_comment_sheets"
psql $DATABASE_URL -c "\d monthly_report_weeks"
psql $DATABASE_URL -c "SELECT * FROM monthly_reports LIMIT 1;"
```

### 4. Optional: Load Test Data
```bash
node database/seed-january-2026.js
```

### 5. Restart Application
```bash
# Vercel/Railway auto-deploys on git push
# Or manually restart your server
pm2 restart all  # if using PM2
```

---

## 🧪 Testing Checklist

### After Deployment
- [ ] Login to application
- [ ] Navigate to "Teacher Comment Sheets" (renamed from "Lesson Reports")
- [ ] Create a new teacher comment sheet
- [ ] View existing teacher comment sheets
- [ ] Create a monthly report with auto-generate
- [ ] Generate PDF for monthly report
- [ ] Verify PDF layout matches template (landscape, categories as rows)
- [ ] Check no "N/A" appears in PDFs
- [ ] Verify 今月のテーマ section displays correctly

### API Tests
```bash
# Test new endpoint
curl -X GET http://localhost:3000/api/teacher-comment-sheets \
  -H "Cookie: vitamin_session=..." 

# Test old endpoint (backwards compatibility)
curl -X GET http://localhost:3000/api/reports \
  -H "Cookie: vitamin_session=..."

# Test date range
curl -X GET "http://localhost:3000/api/teacher-comment-sheets?startDate=2026-01-01&endDate=2026-01-31" \
  -H "Cookie: vitamin_session=..."
```

---

## 🔧 Troubleshooting

### Migration Fails
```sql
-- Check if table already exists
SELECT * FROM information_schema.tables 
WHERE table_name = 'teacher_comment_sheets';

-- Check if old table still exists
SELECT * FROM information_schema.tables 
WHERE table_name = 'lesson_reports';

-- Manually rename if needed
ALTER TABLE lesson_reports RENAME TO teacher_comment_sheets;
```

### PDF Not Generating
```javascript
// Check logs for errors
tail -f logs/app.log | grep "PDF"

// Common issues:
// 1. Missing R2 credentials (check .env)
// 2. Invalid data format (check weekly data structure)
// 3. Font missing (should use built-in Helvetica)
```

### Old Data Migration
```sql
-- Verify all data migrated
SELECT COUNT(*) FROM teacher_comment_sheets;

-- Check foreign keys
SELECT * FROM monthly_report_weeks 
WHERE teacher_comment_sheet_id IS NOT NULL 
LIMIT 10;

-- Verify start_date and end_date populated
SELECT id, year, month, start_date, end_date 
FROM monthly_reports 
WHERE start_date IS NULL OR end_date IS NULL;
```

---

## 📝 Key Files

| File | Purpose |
|------|---------|
| `database/migrations/005_*.sql` | Database migration |
| `routes/teacherCommentSheets.js` | New API routes |
| `routes/monthlyReports.js` | Updated with date ranges |
| `utils/monthlyReportPdf.js` | Rewritten PDF generation |
| `server.js` | Route registration |
| `DEPLOYMENT_STEPS.md` | Full deployment guide |
| `VISUAL_GUIDE_PDF_FIX.md` | PDF before/after comparison |

---

## 🎯 API Examples

### Create Teacher Comment Sheet
```javascript
POST /api/teacher-comment-sheets
{
  "class_id": 1,
  "teacher_id": 1,
  "date": "2026-01-15",
  "target_topic": "Time expressions",
  "vocabulary": "wake up, go to bed, eat breakfast",
  "mistakes": "What time do you wake up?",
  "strengths": "Good pronunciation",
  "comments": "Great progress this week"
}
```

### Auto-Generate Monthly Report (New Way)
```javascript
POST /api/monthly-reports/auto-generate
{
  "class_id": 1,
  "start_date": "2026-01-01",
  "end_date": "2026-01-31"
}
```

### Auto-Generate Monthly Report (Old Way - Still Works)
```javascript
POST /api/monthly-reports/auto-generate
{
  "class_id": 1,
  "year": 2026,
  "month": 1
}
```

---

## ✅ Success Criteria

Your deployment is successful if:
1. ✅ No errors in application logs
2. ✅ Teacher Comment Sheets page loads
3. ✅ Can create new teacher comment sheets
4. ✅ Can generate monthly report PDFs
5. ✅ PDFs are in landscape orientation
6. ✅ PDFs show categories as rows, dates as columns
7. ✅ No "N/A" text appears in PDFs
8. ✅ Japanese text displays correctly in 今月のテーマ section

---

## 🆘 Need Help?

### Documentation
- Full deployment steps: `DEPLOYMENT_STEPS.md`
- Migration guide: `MIGRATION_GUIDE_005.md`
- PDF changes: `VISUAL_GUIDE_PDF_FIX.md`
- Security audit: `SECURITY_SUMMARY_MONTHLY_REPORTS_FIX.md`

### Support
- Check application logs: `/var/log/app.log`
- Database logs: PostgreSQL logs on Neon/Railway
- Contact: stupidgiraffe@github.com

---

**Last Updated**: 2026-02-05  
**Version**: 1.0  
**Status**: ✅ Production Ready
