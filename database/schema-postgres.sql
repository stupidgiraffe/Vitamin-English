-- Users table (teachers/staff)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK(role IN ('admin', 'teacher')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Classes table
CREATE TABLE IF NOT EXISTS classes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    teacher_id INTEGER,
    schedule TEXT,
    color VARCHAR(50) DEFAULT '#4A90E2',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES users(id)
);

-- Students table
CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    class_id INTEGER,
    student_type VARCHAR(50) DEFAULT 'regular' CHECK(student_type IN ('regular', 'trial')),
    color_code VARCHAR(50) DEFAULT '',
    active BOOLEAN DEFAULT true,
    notes TEXT,
    email VARCHAR(255),
    phone VARCHAR(50),
    parent_name VARCHAR(255),
    parent_phone VARCHAR(50),
    parent_email VARCHAR(255),
    enrollment_date VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(id)
);

-- Attendance table
CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL,
    class_id INTEGER NOT NULL,
    date VARCHAR(50) NOT NULL,
    time VARCHAR(20) CHECK (time IS NULL OR time ~ '^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$'),
    status VARCHAR(10) DEFAULT '' CHECK(status IN ('O', 'X', '/', '')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, date),
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (class_id) REFERENCES classes(id)
);

-- Lesson Reports table
CREATE TABLE IF NOT EXISTS lesson_reports (
    id SERIAL PRIMARY KEY,
    class_id INTEGER NOT NULL,
    teacher_id INTEGER NOT NULL,
    date VARCHAR(50) NOT NULL,
    target_topic TEXT,
    vocabulary TEXT,
    mistakes TEXT,
    strengths TEXT,
    comments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(class_id, date),
    FOREIGN KEY (class_id) REFERENCES classes(id),
    FOREIGN KEY (teacher_id) REFERENCES users(id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_class ON attendance(class_id);
CREATE INDEX IF NOT EXISTS idx_reports_date ON lesson_reports(date);
CREATE INDEX IF NOT EXISTS idx_reports_class ON lesson_reports(class_id);
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);

-- Make-up lessons table
CREATE TABLE IF NOT EXISTS makeup_lessons (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL,
    class_id INTEGER NOT NULL,
    scheduled_date VARCHAR(50) NOT NULL,
    scheduled_time VARCHAR(50),
    reason TEXT,
    status VARCHAR(50) DEFAULT 'scheduled',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (class_id) REFERENCES classes(id)
);

CREATE INDEX IF NOT EXISTS idx_makeup_date ON makeup_lessons(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_makeup_student ON makeup_lessons(student_id);
CREATE INDEX IF NOT EXISTS idx_makeup_status ON makeup_lessons(status);

-- PDF history table
CREATE TABLE IF NOT EXISTS pdf_history (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    student_id INTEGER REFERENCES students(id),
    class_id INTEGER REFERENCES classes(id),
    report_id INTEGER REFERENCES lesson_reports(id),
    r2_key VARCHAR(500) NOT NULL,
    r2_url TEXT NOT NULL,
    file_size INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_pdf_history_type ON pdf_history(type);
CREATE INDEX IF NOT EXISTS idx_pdf_history_student ON pdf_history(student_id);
CREATE INDEX IF NOT EXISTS idx_pdf_history_class ON pdf_history(class_id);
CREATE INDEX IF NOT EXISTS idx_pdf_history_created_at ON pdf_history(created_at);
