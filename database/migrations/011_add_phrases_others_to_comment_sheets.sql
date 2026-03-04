-- Add phrases column (separate from vocabulary)
ALTER TABLE teacher_comment_sheets ADD COLUMN IF NOT EXISTS phrases TEXT;

-- Add others column
ALTER TABLE teacher_comment_sheets ADD COLUMN IF NOT EXISTS others TEXT;
