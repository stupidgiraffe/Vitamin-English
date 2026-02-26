-- Migration: Drop uniqueness constraint on (class_id, start_date, end_date) from monthly_reports
-- Date: 2026-02-26
-- Purpose: Allow users to create multiple monthly reports with overlapping or identical date ranges.
--          The old UNIQUE(class_id, start_date, end_date) constraint prevented this.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'monthly_reports'::regclass
          AND conname = 'monthly_reports_class_date_range_unique'
    ) THEN
        ALTER TABLE monthly_reports DROP CONSTRAINT monthly_reports_class_date_range_unique;
        RAISE NOTICE 'Dropped uniqueness constraint: monthly_reports_class_date_range_unique';
    ELSE
        RAISE NOTICE 'Constraint monthly_reports_class_date_range_unique not found, skipping';
    END IF;
END $$;
