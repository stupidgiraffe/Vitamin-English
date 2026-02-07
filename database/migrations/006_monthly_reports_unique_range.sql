-- Migration: Update monthly reports uniqueness constraint
-- Date: 2026-02-07
-- Purpose: Change uniqueness from (class_id, year, month) to (class_id, start_date, end_date)

-- Drop the old uniqueness constraint
-- Note: The constraint name may vary, so we use DO block to handle it gracefully
DO $$ 
DECLARE
    constraint_name TEXT;
BEGIN
    -- Find the constraint name for (class_id, year, month)
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'monthly_reports'::regclass
      AND contype = 'u'
      AND array_length(conkey, 1) = 3
      AND conkey @> ARRAY[
          (SELECT attnum FROM pg_attribute WHERE attrelid = 'monthly_reports'::regclass AND attname = 'class_id'),
          (SELECT attnum FROM pg_attribute WHERE attrelid = 'monthly_reports'::regclass AND attname = 'year'),
          (SELECT attnum FROM pg_attribute WHERE attrelid = 'monthly_reports'::regclass AND attname = 'month')
      ]
    LIMIT 1;
    
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE monthly_reports DROP CONSTRAINT ' || quote_ident(constraint_name);
        RAISE NOTICE 'Dropped old uniqueness constraint: %', constraint_name;
    ELSE
        RAISE NOTICE 'Old uniqueness constraint not found, skipping drop';
    END IF;
END $$;

-- Ensure start_date and end_date columns exist (should be added by migration 005)
-- Add them if they don't exist
ALTER TABLE monthly_reports ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE monthly_reports ADD COLUMN IF NOT EXISTS end_date DATE;

-- Update any existing records that don't have start_date/end_date set
-- This computes them from year/month
UPDATE monthly_reports 
SET start_date = make_date(year, month, 1),
    end_date = (make_date(year, month, 1) + interval '1 month' - interval '1 day')::date
WHERE start_date IS NULL OR end_date IS NULL;

-- Add the new uniqueness constraint on (class_id, start_date, end_date)
-- Use IF NOT EXISTS pattern by checking if constraint already exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'monthly_reports'::regclass 
          AND conname = 'monthly_reports_class_date_range_unique'
    ) THEN
        ALTER TABLE monthly_reports 
        ADD CONSTRAINT monthly_reports_class_date_range_unique 
        UNIQUE (class_id, start_date, end_date);
        RAISE NOTICE 'Added new uniqueness constraint: monthly_reports_class_date_range_unique';
    ELSE
        RAISE NOTICE 'Uniqueness constraint already exists: monthly_reports_class_date_range_unique';
    END IF;
END $$;
