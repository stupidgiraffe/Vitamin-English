-- Drop constraints that prevent creating duplicate monthly reports
ALTER TABLE monthly_reports DROP CONSTRAINT IF EXISTS monthly_reports_class_id_year_month_key;
ALTER TABLE monthly_reports DROP CONSTRAINT IF EXISTS monthly_reports_class_id_start_date_end_date_key;
ALTER TABLE monthly_reports DROP CONSTRAINT IF EXISTS unique_class_date_range;
ALTER TABLE monthly_reports DROP CONSTRAINT IF EXISTS monthly_reports_class_date_range_unique;

-- Allow more than 6 weekly entries in a report (auto-generated from lessons in range)
ALTER TABLE monthly_report_weeks DROP CONSTRAINT IF EXISTS monthly_report_weeks_week_number_check;
