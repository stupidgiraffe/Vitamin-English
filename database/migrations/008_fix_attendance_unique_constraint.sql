-- Migration 008: Fix attendance unique constraint to include class_id
-- This allows students to attend multiple classes on the same date

-- Drop the existing constraint
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_student_id_date_key;

-- Add new constraint with class_id included
ALTER TABLE attendance ADD CONSTRAINT attendance_student_class_date_unique UNIQUE (student_id, class_id, date);
