-- Migration: Normalize all date values in the database to ISO format (YYYY-MM-DD)
-- This script converts dates from MM/DD/YYYY and other formats to YYYY-MM-DD

-- Update attendance table dates
-- Handle MM/DD/YYYY format (e.g., 01/28/2026)
UPDATE attendance
SET date = 
    CASE 
        -- If date matches MM/DD/YYYY pattern
        WHEN date ~ '^\d{1,2}/\d{1,2}/\d{4}$' THEN
            -- Split and reformat to YYYY-MM-DD
            split_part(date, '/', 3) || '-' || 
            lpad(split_part(date, '/', 1), 2, '0') || '-' || 
            lpad(split_part(date, '/', 2), 2, '0')
        -- If date matches DD-MM-YYYY pattern
        WHEN date ~ '^\d{1,2}-\d{1,2}-\d{4}$' THEN
            split_part(date, '-', 3) || '-' || 
            lpad(split_part(date, '-', 2), 2, '0') || '-' || 
            lpad(split_part(date, '-', 1), 2, '0')
        -- Already in YYYY-MM-DD format or other, keep as is
        ELSE date
    END
WHERE date !~ '^\d{4}-\d{2}-\d{2}$';

-- Update teacher_comment_sheets table dates (try new name first)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'teacher_comment_sheets') THEN
        UPDATE teacher_comment_sheets
        SET date = 
            CASE 
                WHEN date ~ '^\d{1,2}/\d{1,2}/\d{4}$' THEN
                    split_part(date, '/', 3) || '-' || 
                    lpad(split_part(date, '/', 1), 2, '0') || '-' || 
                    lpad(split_part(date, '/', 2), 2, '0')
                WHEN date ~ '^\d{1,2}-\d{1,2}-\d{4}$' THEN
                    split_part(date, '-', 3) || '-' || 
                    lpad(split_part(date, '-', 2), 2, '0') || '-' || 
                    lpad(split_part(date, '-', 1), 2, '0')
                ELSE date
            END
        WHERE date !~ '^\d{4}-\d{2}-\d{2}$';
        RAISE NOTICE 'Updated dates in teacher_comment_sheets table';
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lesson_reports') THEN
        UPDATE lesson_reports
        SET date = 
            CASE 
                WHEN date ~ '^\d{1,2}/\d{1,2}/\d{4}$' THEN
                    split_part(date, '/', 3) || '-' || 
                    lpad(split_part(date, '/', 1), 2, '0') || '-' || 
                    lpad(split_part(date, '/', 2), 2, '0')
                WHEN date ~ '^\d{1,2}-\d{1,2}-\d{4}$' THEN
                    split_part(date, '-', 3) || '-' || 
                    lpad(split_part(date, '-', 2), 2, '0') || '-' || 
                    lpad(split_part(date, '-', 1), 2, '0')
                ELSE date
            END
        WHERE date !~ '^\d{4}-\d{2}-\d{2}$';
        RAISE NOTICE 'Updated dates in lesson_reports table (legacy name)';
    ELSE
        RAISE NOTICE 'Neither teacher_comment_sheets nor lesson_reports table exists, skipping';
    END IF;
END $$;

-- Update makeup_lessons table dates
UPDATE makeup_lessons
SET scheduled_date = 
    CASE 
        WHEN scheduled_date ~ '^\d{1,2}/\d{1,2}/\d{4}$' THEN
            split_part(scheduled_date, '/', 3) || '-' || 
            lpad(split_part(scheduled_date, '/', 1), 2, '0') || '-' || 
            lpad(split_part(scheduled_date, '/', 2), 2, '0')
        WHEN scheduled_date ~ '^\d{1,2}-\d{1,2}-\d{4}$' THEN
            split_part(scheduled_date, '-', 3) || '-' || 
            lpad(split_part(scheduled_date, '-', 2), 2, '0') || '-' || 
            lpad(split_part(scheduled_date, '-', 1), 2, '0')
        ELSE scheduled_date
    END
WHERE scheduled_date !~ '^\d{4}-\d{2}-\d{2}$';

-- Update students enrollment_date
UPDATE students
SET enrollment_date = 
    CASE 
        WHEN enrollment_date ~ '^\d{1,2}/\d{1,2}/\d{4}$' THEN
            split_part(enrollment_date, '/', 3) || '-' || 
            lpad(split_part(enrollment_date, '/', 1), 2, '0') || '-' || 
            lpad(split_part(enrollment_date, '/', 2), 2, '0')
        WHEN enrollment_date ~ '^\d{1,2}-\d{1,2}-\d{4}$' THEN
            split_part(enrollment_date, '-', 3) || '-' || 
            lpad(split_part(enrollment_date, '-', 2), 2, '0') || '-' || 
            lpad(split_part(enrollment_date, '-', 1), 2, '0')
        ELSE enrollment_date
    END
WHERE enrollment_date IS NOT NULL AND enrollment_date !~ '^\d{4}-\d{2}-\d{2}$';
