# Monthly Reports Improvements

This document describes the improvements made to the Monthly Reports feature.

## 1. Unique Report Handling (Exact Date Range)

### Database Changes
- **Migration 006** updates the uniqueness constraint:
  - **Old**: `UNIQUE(class_id, year, month)` - prevented multiple reports in the same month
  - **New**: `UNIQUE(class_id, start_date, end_date)` - allows overlapping ranges, but prevents exact duplicates

### API Behavior
- When creating a report with an exact date range that already exists:
  - **Before**: Returns `400 Bad Request` with error message
  - **After**: Returns `200 OK` with the existing report data plus `alreadyExists: true` flag

### UI Behavior
- When attempting to create a duplicate report:
  - Shows friendly info message: "This report already exists. Opening existing report..."
  - Automatically opens the existing report in the view modal
  - No stacked error toasts

### Benefits
- Users can create reports for arbitrary date ranges (not just calendar months)
- Multiple overlapping reports are allowed (e.g., weekly and monthly reports)
- Attempting to create the same report twice is handled gracefully

## 2. Japan-Style Date/Time Formatting

### New Centralized Formatter
- **File**: `public/js/dateTime.js`
- **Functions**:
  - `formatDateJP(date)` - Date only in Japanese format (2026年2月7日)
  - `formatDateTimeJP(date)` - Date and time in Japanese 24-hour format (2026年2月7日 15:30)
  - `formatDateSmart(date)` - Smart formatter that shows time only when meaningful
  - `formatDateISO(date)` - ISO format for date inputs (YYYY-MM-DD)
  - `formatDateReadableEN(date)` - English format for compatibility (Feb. 7, 2026)

### Usage in Monthly Reports
- **List View**: Uses `formatDateISO()` for date ranges
- **Detail View**: Uses `formatDateJP()` for lesson dates and date ranges
- All dates display in Asia/Tokyo timezone
- Time is omitted for date-only values (no more "00:00:00" timestamps)

### Benefits
- Consistent date formatting across the application
- No more long GMT/ISO strings in the UI
- Proper Japan timezone handling
- Smart time display (shown only when meaningful)

## 3. Test Report Generation UI

### New Feature
- **Button**: "🧪 Generate Test Report" in Monthly Reports page controls
- **Functionality**: Creates a sample monthly report with test data
- **Test Data**: January 2024 report with 4 sample lessons
- **Admin Only**: Requires admin role to use

### User Experience
1. Click "🧪 Generate Test Report" button
2. System creates report for first available class and teacher
3. Success toast shows: "Test report created! Report ID: {id}"
4. Report list refreshes automatically
5. The new report opens in view modal automatically

### Benefits
- Easy way to test monthly report features without SQL
- Quickly generate sample data for demonstrations
- Helps validate PDF generation and other features

## 4. Default Class Selection in Create Modal

### Enhancement
- When opening the "Create Monthly Report" modal:
  - If a class is selected in the filter dropdown, that class is pre-selected in the modal
  - Eliminates the need to select the class twice

### Benefits
- Improved user experience
- Faster workflow when creating multiple reports for the same class
- Reduces potential for errors

## Migration Instructions

### For Production Deployment

1. **Run Migration 006**:
   ```bash
   npm run migrate
   # or
   node scripts/apply-migrations.js
   ```

2. **Verify Migration**:
   - Check that the script shows all three migrations as applied
   - Confirm the new unique constraint exists: `monthly_reports_class_date_range_unique`
   - Confirm the old constraint was removed

3. **Test the Features**:
   - Create a monthly report
   - Try creating the same report again (should show existing report)
   - Verify date formatting looks correct
   - Test the test report generation button (admin only)

### Rollback Plan

If issues occur, the old constraint can be restored:
```sql
-- Remove new constraint
ALTER TABLE monthly_reports DROP CONSTRAINT IF EXISTS monthly_reports_class_date_range_unique;

-- Restore old constraint
ALTER TABLE monthly_reports ADD CONSTRAINT monthly_reports_class_year_month_key UNIQUE (class_id, year, month);
```

## Technical Details

### Files Modified
- `database/migrations/006_monthly_reports_unique_range.sql` - New migration
- `database/schema-postgres.sql` - Updated schema
- `routes/monthlyReports.js` - Updated auto-generate endpoint
- `public/js/dateTime.js` - New date formatting utilities (created)
- `public/js/monthly-reports.js` - Updated report creation and viewing
- `public/js/app.js` - Updated list rendering and added test report function
- `public/index.html` - Added test report button and dateTime.js script
- `scripts/apply-migrations.js` - Updated to include migration 006

### Backward Compatibility
- Existing reports work without changes
- `year` and `month` columns are retained for backward compatibility
- API still accepts both `(year, month)` and `(start_date, end_date)` parameters
- Frontend displays month/year alongside date ranges

## Known Limitations
- Test report always creates January 2024 data (not configurable from UI)
- Test report generation requires at least one class and one teacher to exist
- Date formatting functions require browser support for `Intl.DateTimeFormat`
