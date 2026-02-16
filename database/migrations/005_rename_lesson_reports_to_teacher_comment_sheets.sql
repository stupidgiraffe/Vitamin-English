-- Migration: Rename lesson_reports to teacher_comment_sheets
-- Date: 2026-02-05
-- Purpose: Rename lesson_reports table to teacher_comment_sheets for clarity

-- Rename the main table (if it exists as lesson_reports)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lesson_reports') THEN
        ALTER TABLE lesson_reports RENAME TO teacher_comment_sheets;
        RAISE NOTICE 'Renamed lesson_reports table to teacher_comment_sheets';
    ELSE
        RAISE NOTICE 'Table lesson_reports does not exist, skipping rename';
    END IF;
END $$;

-- Update foreign key column name in monthly_report_weeks (if it exists as lesson_report_id)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'monthly_report_weeks' 
        AND column_name = 'lesson_report_id'
    ) THEN
        ALTER TABLE monthly_report_weeks RENAME COLUMN lesson_report_id TO teacher_comment_sheet_id;
        RAISE NOTICE 'Renamed column lesson_report_id to teacher_comment_sheet_id';
    ELSE
        RAISE NOTICE 'Column lesson_report_id does not exist, skipping rename';
    END IF;
END $$;

-- Rename indexes
ALTER INDEX IF EXISTS idx_reports_date RENAME TO idx_teacher_comment_sheets_date;
ALTER INDEX IF EXISTS idx_reports_class RENAME TO idx_teacher_comment_sheets_class;

-- Add start_date and end_date columns to monthly_reports
ALTER TABLE monthly_reports ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE monthly_reports ADD COLUMN IF NOT EXISTS end_date DATE;

-- Update existing records with computed dates based on year and month
UPDATE monthly_reports 
SET start_date = make_date(year, month, 1),
    end_date = (make_date(year, month, 1) + interval '1 month' - interval '1 day')::date
WHERE start_date IS NULL OR end_date IS NULL;

-- Note: The sequence for teacher_comment_sheets is automatically renamed by PostgreSQL
