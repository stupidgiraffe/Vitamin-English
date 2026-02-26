DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'monthly_reports'::regclass 
          AND conname = 'monthly_reports_class_date_range_unique'
    ) THEN
        ALTER TABLE monthly_reports DROP CONSTRAINT monthly_reports_class_date_range_unique;
    END IF;
END $$;
