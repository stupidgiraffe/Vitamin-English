-- Migration: Add contact and enrollment fields to students table
-- Date: 2026-01-24

-- Add new columns to students table if they don't exist
-- Note: SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so this must be run only once

ALTER TABLE students ADD COLUMN email TEXT;
ALTER TABLE students ADD COLUMN phone TEXT;
ALTER TABLE students ADD COLUMN parent_name TEXT;
ALTER TABLE students ADD COLUMN parent_phone TEXT;
ALTER TABLE students ADD COLUMN parent_email TEXT;
ALTER TABLE students ADD COLUMN enrollment_date TEXT;
