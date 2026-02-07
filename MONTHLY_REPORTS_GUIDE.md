# Monthly Reports Feature - User Guide

## Overview
The Monthly Reports feature allows teachers and administrators to create comprehensive monthly progress reports for each class. These reports track weekly lesson content throughout the month and can be exported as professional PDFs with full Japanese text support.

## Recent Improvements (February 2026)
- **One-Click Creation**: Simplified modal with automatic data population from teacher comment sheets
- **Proper Japanese Rendering**: All Japanese characters (今月のテーマ, 日付, 目標, etc.) now display correctly in PDFs
- **Better Date Display**: Lesson dates shown as "Feb. 7, 2026" instead of generic "Week 1/2/3..."
- **Japan Timezone**: All dates use Asia/Tokyo timezone to avoid confusing GMT timestamps
- **Auto-Load**: Reports load automatically when you open the page

## Accessing Monthly Reports

1. Log in to the Vitamin English School Management System
2. Click on **"Monthly Reports"** in the navigation menu
3. Reports will load automatically with current filters applied

## Features

### 1. Creating a New Monthly Report (Simplified!)

#### One-Click Auto-Generate (Recommended)
1. Click the **"+ Create Monthly Report"** button
2. Fill in the simple form:
   - **Class**: Select the class for the report
   - **Start Date**: First day of the period (defaults to start of current month)
   - **End Date**: Last day of the period (defaults to today)
   - **Monthly Theme (今月のテーマ)**: Optional theme or summary
   - **Status**: Draft or Published
3. Click **"Create Report"**
4. The system automatically:
   - Finds all teacher comment sheets in the date range
   - Creates weekly entries for each lesson
   - Populates all fields (Target, Vocabulary, Phrase, Others)
   - Saves the report immediately

**Note**: This replaces the old multi-step process. No more manual week entry!

### 2. Viewing Monthly Reports

#### List View
- Use the filter controls to find specific reports:
  - **Class**: Filter by specific class or view all
  - **Year**: Filter by year
  - **Month**: Filter by month
  - **Status**: Filter by draft or published
- Click **"Filter"** to load reports
- The table shows:
  - Class name
  - Month/Year
  - Status (Draft/Published badge)
  - Created date
  - Action buttons

#### View Details
1. Click the **"View"** button on any report
2. A modal will display:
   - Class and month information
   - Date range covered
   - Status
   - All lesson data organized by actual lesson dates (e.g., "Feb. 7, 2026")
   - Monthly theme

**New**: Lessons are now shown with their actual dates instead of generic "Week 1, Week 2" labels, making it easier to identify specific lessons.

### 3. Editing a Monthly Report

1. Click the **"Edit"** button on the report you want to modify
2. Update any fields:
   - Weekly lesson data (dates, targets, vocabulary, phrases, others)
   - Monthly theme
   - Status
3. Add or remove weeks as needed
4. Click **"Update Report"**

### 4. Generating PDFs

#### Generate PDF
1. Click the **"Generate PDF"** button on any report
2. The system will create a professional PDF including:
   - Header with "Monthly Report" title
   - Class name and schedule
   - Month and year
   - Lesson progress table with columns for each lesson date
   - All fields displayed with both English and Japanese labels (日付, 目標, 単語, 文, その他)
   - Monthly theme section with Japanese heading support
   - Vitamin English School branding
3. The PDF will open in a new tab
4. The PDF is stored securely and can be downloaded later

**Important**: All Japanese text now renders correctly in PDFs using the Noto Sans JP font. No more garbled characters!

#### Download Existing PDF
- If a PDF has already been generated, a **"Download PDF"** button will appear
- Click it to get a fresh download link (valid for 1 hour)

### 5. Deleting a Monthly Report

1. Click the **"Delete"** button on the report
2. Confirm the deletion
3. **Warning**: This action cannot be undone and will delete all associated weekly data

## PDF Report Format

The generated PDF includes:

### Header Section
- **Title**: "Monthly Report" (large, bold)
- **Month/Year**: e.g., "Feb. 2026"
- **Class Info**: e.g., "Elementary, Tue 4PM"

### Lesson Progress Table (Landscape Layout)
A clean table with:
- **Columns**: One column for each lesson date (e.g., "Feb. 7", "Feb. 14", etc.)
- **Rows**: Each row represents a category with bilingual labels:
  - **Target (目標)**: Learning objectives
  - **Vocabulary (単語)**: Words learned
  - **Phrase (文)**: Sentence patterns
  - **Others (その他)**: Additional activities

All Japanese characters are rendered using the Noto Sans JP font for crystal-clear display.

### Monthly Theme Section
- **Header**: "Monthly Theme (今月のテーマ)" in Japanese font
- **Content**: Teacher's summary and reflections in a bordered box

### Footer
- Vitamin English School branding with green outline

## Best Practices

### For Teachers
1. **Use One-Click Creation**: Simply select class and date range - the system does the rest!
2. **Flexible Date Ranges**: Not limited to calendar months - can create reports for any date range
3. **Regular Updates**: Create monthly reports at the end of each month
4. **Meaningful Themes**: Write thoughtful monthly theme summaries that highlight student progress
5. **Draft First**: Create reports as drafts, review them, then publish when ready
6. **Japanese Text**: All Japanese characters are fully supported in both the web view and PDFs

### For Administrators
1. **Auto-Load**: Reports load automatically when the page opens
2. **Review Process**: Check draft reports before they're published
3. **Consistency**: Ensure all classes have monthly reports for tracking purposes
4. **PDF Generation**: Generate PDFs for published reports - Japanese text will render perfectly
5. **Filtering**: Use the date range filters to find specific reports

## Workflow Example

### Simplified Monthly Report Creation Workflow
1. **End of Month**: Click "Monthly Reports" in navigation
2. **Create Report**: Click "+ Create Monthly Report"
3. **Fill Simple Form**: Select class, start date, end date, add optional theme
4. **Click Create**: System automatically pulls all teacher comment sheets
5. **Done!**: Report is created with all lesson data populated
6. **Generate PDF**: Click "Generate PDF" to create shareable document

**Time saved**: What used to take 10-15 minutes now takes less than 1 minute!

## Integration with Teacher Comment Sheets

Monthly Reports work seamlessly with the Teacher Comment Sheets feature:
- Auto-generate pulls data from `target_topic`, `vocabulary`, `mistakes`, `strengths`, and `comments` fields
- Each lesson entry can be linked to its source teacher comment sheet
- Changes to teacher comment sheets after auto-generation do not affect the monthly report (they are independent)

## Technical Notes

### Recent Technical Improvements
- **Japanese Font**: Noto Sans JP font embedded in PDFs for proper Japanese character rendering
- **Timezone Handling**: All dates use Asia/Tokyo timezone consistently
- **Date Formatters**: Centralized date formatting utilities for consistency
- **Defensive Logging**: Added logging for empty weeks to help with debugging

### Database Schema
- `monthly_reports` table stores main report metadata (includes `start_date` and `end_date` columns)
- `monthly_report_weeks` table stores lesson data (linked via `teacher_comment_sheet_id`)
- Unique constraint prevents duplicate reports for same class/month
- Cascade delete ensures data consistency

### Security
- All endpoints require authentication
- Parameterized queries prevent SQL injection
- Input validation on both server and client side
- PDFs stored securely with time-limited signed URLs
- Japanese text sanitized for PDF security

### Limitations
- Maximum 6 lessons per report (expandable if needed)
- One report per class per calendar month (based on start_date month)
- PDF URLs expire after 1 hour (new links can be generated anytime)

## Troubleshooting

### "A monthly report for this class and month already exists"
- Each class can only have one report per calendar month
- Edit the existing report instead of creating a new one
- Or delete the existing report first (if appropriate)

### "No teacher comment sheets found for this class and date range"
- Auto-generate requires existing teacher comment sheets for that class and date range
- Create teacher comment sheets first, then use auto-generate
- Or manually edit the report after creation

### "PDF not available. Please generate it first"
- PDFs are not created automatically
- Click "Generate PDF" to create one
- PDF generation may take a few seconds

### PDF Japanese characters not displaying correctly
- **This issue has been fixed!** All PDFs now use Noto Sans JP font
- If you see old PDFs with garbled text, regenerate them
- New PDFs will display all Japanese characters (今月のテーマ, 日付, 目標, etc.) correctly

### Dates showing wrong timezone or GMT strings
- **This issue has been fixed!** All dates now use Asia/Tokyo timezone
- Dates are formatted as "Feb. 7, 2026" instead of long GMT strings
- Both web view and PDFs use consistent Japan time

## Support

For issues, questions, or feature requests related to Monthly Reports, contact your system administrator or refer to the main application documentation.

---
**Feature Version**: 2.0.0
**Last Updated**: 2026-02-07
**Recent Updates**:
- Fixed Japanese text rendering in PDFs with Noto Sans JP font
- Simplified creation flow to one-click auto-generate
- Improved date display (actual dates vs. "Week 1/2/3...")
- Centralized timezone handling (Asia/Tokyo)
- Added auto-load for better UX
