-- Migration: Create monthly reports tables
-- Date: 2026-02-05
-- Purpose: Add monthly reports feature for tracking monthly progress per class

-- Monthly reports table (main report metadata)
CREATE TABLE IF NOT EXISTS monthly_reports (
    id SERIAL PRIMARY KEY,
    class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    monthly_theme TEXT,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    pdf_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    UNIQUE(class_id, year, month)
);

-- Monthly report weeks table (weekly lesson data)
CREATE TABLE IF NOT EXISTS monthly_report_weeks (
    id SERIAL PRIMARY KEY,
    monthly_report_id INTEGER NOT NULL REFERENCES monthly_reports(id) ON DELETE CASCADE,
    week_number INTEGER NOT NULL CHECK (week_number >= 1 AND week_number <= 6),
    lesson_date DATE,
    target TEXT,
    vocabulary TEXT,
    phrase TEXT,
    others TEXT,
    teacher_comment_sheet_id INTEGER REFERENCES teacher_comment_sheets(id),
    UNIQUE(monthly_report_id, week_number)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_monthly_reports_class ON monthly_reports(class_id);
CREATE INDEX IF NOT EXISTS idx_monthly_reports_date ON monthly_reports(year, month);
CREATE INDEX IF NOT EXISTS idx_monthly_reports_status ON monthly_reports(status);
CREATE INDEX IF NOT EXISTS idx_monthly_report_weeks_report ON monthly_report_weeks(monthly_report_id);
CREATE INDEX IF NOT EXISTS idx_monthly_report_weeks_lesson ON monthly_report_weeks(teacher_comment_sheet_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_monthly_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER monthly_reports_updated_at
    BEFORE UPDATE ON monthly_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_monthly_reports_updated_at();
