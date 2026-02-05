# Monthly Reports Feature - User Guide

## Overview
The Monthly Reports feature allows teachers and administrators to create comprehensive monthly progress reports for each class. These reports track weekly lesson content throughout the month and can be exported as professional PDFs.

## Accessing Monthly Reports

1. Log in to the Vitamin English School Management System
2. Click on **"Monthly Reports"** in the navigation menu
3. The Monthly Reports page will display with filtering options

## Features

### 1. Creating a New Monthly Report

#### Manual Creation
1. Click the **"+ Create Monthly Report"** button
2. Fill in the required information:
   - **Class**: Select the class for the report
   - **Year**: Select the year
   - **Month**: Select the month
3. Add weekly lesson data:
   - **Date**: Lesson date
   - **Target (目標)**: Learning objectives for the week
   - **Vocabulary (単語)**: Words and vocabulary learned
   - **Phrase (文)**: Sentence patterns practiced
   - **Others (その他)**: Additional activities (reading practice, make-up lessons, etc.)
4. Click **"+ Add Week"** to add more weeks (up to 6 weeks)
5. Enter the **Monthly Theme (今月のテーマ)**: A summary paragraph about the month's theme and overall progress
6. Select the **Status**:
   - **Draft**: Work in progress, not yet finalized
   - **Published**: Finalized and ready to share
7. Click **"Create Report"**

#### Auto-Generate from Lesson Reports
1. Click **"+ Create Monthly Report"**
2. Select the **Class**, **Year**, and **Month**
3. Click **"Auto-Generate from Lesson Reports"**
4. The system will:
   - Find all lesson reports for that class and month
   - Create weekly entries automatically
   - You can then edit and add the monthly theme

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
   - Status
   - All weekly lesson data
   - Monthly theme

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
   - Weekly progress table with all lesson data
   - Monthly theme section
   - Vitamin English School branding
3. The PDF will open in a new tab
4. The PDF is stored securely and can be downloaded later

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
- **Title**: "Monthly Report" (large, green)
- **Month/Year**: e.g., "January 2026"
- **Class Info**: e.g., "Elementary, Tue 4PM"

### Weekly Progress Table
A clean grid table with columns:
- **Week**: Week number (1-6)
- **Date (日付)**: Lesson date
- **Target (目標)**: Learning objectives
- **Vocabulary (単語)**: Words learned
- **Phrase (文)**: Sentence patterns
- **Others (その他)**: Additional activities

### Monthly Theme Section
- **Header**: "Monthly Theme (今月のテーマ)"
- **Content**: Teacher's summary and reflections

### Footer
- Vitamin English School branding with green outline

## Best Practices

### For Teachers
1. **Regular Updates**: Create or update monthly reports at the end of each month
2. **Use Auto-Generate**: If you've been creating lesson reports throughout the month, use the auto-generate feature to save time
3. **Meaningful Themes**: Write thoughtful monthly theme summaries that highlight student progress and achievements
4. **Draft First**: Create reports as drafts, review them, then publish when ready
5. **Japanese Text**: Feel free to use Japanese characters in any field - they are fully supported

### For Administrators
1. **Review Process**: Check draft reports before they're published
2. **Consistency**: Ensure all classes have monthly reports for tracking purposes
3. **PDF Generation**: Generate PDFs for published reports to share with parents or for records
4. **Filtering**: Use filters to quickly check which classes need reports

## Workflow Example

### Monthly Report Creation Workflow
1. **End of Month**: Teacher reviews the month's lesson reports
2. **Auto-Generate**: Click auto-generate to pull in lesson data
3. **Review & Edit**: Review auto-generated content, make adjustments
4. **Add Theme**: Write a comprehensive monthly theme paragraph
5. **Save as Draft**: Save the report as a draft for review
6. **Admin Review**: Administrator reviews the draft
7. **Publish**: Teacher publishes the finalized report
8. **Generate PDF**: Generate PDF for sharing or archiving

## Integration with Lesson Reports

Monthly Reports work seamlessly with the existing Lesson Reports feature:
- Auto-generate pulls data from `target_topic`, `vocabulary`, and `comments` fields
- Each weekly entry can be linked to its source lesson report
- Changes to lesson reports after auto-generation do not affect the monthly report (they are independent)

## Technical Notes

### Database Schema
- `monthly_reports` table stores main report metadata
- `monthly_report_weeks` table stores weekly lesson data
- Unique constraint prevents duplicate reports for same class/month
- Cascade delete ensures data consistency

### Security
- All endpoints require authentication
- Parameterized queries prevent SQL injection
- Input validation on both server and client side
- PDFs stored securely with time-limited signed URLs

### Limitations
- Maximum 6 weeks per report
- One report per class per month
- PDF URLs expire after 1 hour (new links can be generated)

## Troubleshooting

### "A monthly report for this class and month already exists"
- Each class can only have one report per month
- Edit the existing report instead of creating a new one
- Or delete the existing report first (if appropriate)

### "No lesson reports found for this class and month"
- Auto-generate requires existing lesson reports for that class and month
- Create the monthly report manually instead
- Or create lesson reports first, then use auto-generate

### "PDF not available. Please generate it first"
- PDFs are not created automatically
- Click "Generate PDF" to create one
- PDF generation may take a few seconds for reports with lots of data

### PDF Japanese characters not displaying
- This should not occur as the PDF generator supports Japanese
- If you encounter this, report it as a bug

## Support

For issues, questions, or feature requests related to Monthly Reports, contact your system administrator or refer to the main application documentation.

---
**Feature Version**: 1.0.0
**Last Updated**: 2026-02-05
