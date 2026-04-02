-- Migration 015: Create attendance_makeup_students junction table
-- This table tracks temporary/makeup visitors in a class for attendance purposes.
-- A student's permanent class_id is never changed; this table only controls
-- which extra students are visible in the attendance view for a given class+date.

CREATE TABLE IF NOT EXISTS attendance_makeup_students (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id),
    class_id INTEGER NOT NULL REFERENCES classes(id),
    date VARCHAR(50) NOT NULL,
    source_class_id INTEGER REFERENCES classes(id),  -- the student's "home" class
    reason TEXT,
    makeup_lesson_id INTEGER REFERENCES makeup_lessons(id),  -- optional link to makeup_lessons record
    added_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT attendance_makeup_unique UNIQUE(student_id, class_id, date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_makeup_class_date ON attendance_makeup_students(class_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_makeup_student ON attendance_makeup_students(student_id);
