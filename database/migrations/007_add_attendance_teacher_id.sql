-- Migration 007: Add teacher_id to attendance table
-- This allows tracking which teacher conducted the lesson

-- Add teacher_id column (nullable for backward compatibility)
ALTER TABLE attendance 
ADD COLUMN IF NOT EXISTS teacher_id INTEGER;

-- Add foreign key constraint to users table
ALTER TABLE attendance 
ADD CONSTRAINT IF NOT EXISTS fk_attendance_teacher 
FOREIGN KEY (teacher_id) REFERENCES users(id);

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_attendance_teacher ON attendance(teacher_id);

-- Note: teacher_id is nullable to maintain backward compatibility
-- with existing attendance records that don't have teacher information
