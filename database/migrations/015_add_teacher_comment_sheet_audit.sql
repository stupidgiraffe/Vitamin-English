CREATE TABLE IF NOT EXISTS teacher_comment_sheet_audit (
    id SERIAL PRIMARY KEY,
    sheet_id INTEGER,
    action VARCHAR(32) NOT NULL,
    performed_by INTEGER REFERENCES users(id),
    before_json JSONB,
    after_json JSONB,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tcs_audit_sheet ON teacher_comment_sheet_audit(sheet_id);
CREATE INDEX IF NOT EXISTS idx_tcs_audit_action ON teacher_comment_sheet_audit(action);
CREATE INDEX IF NOT EXISTS idx_tcs_audit_created_at ON teacher_comment_sheet_audit(created_at);
