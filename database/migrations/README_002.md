# Date Format Migration Guide

## Overview
This migration normalizes all date values in the database from various formats (MM/DD/YYYY, DD-MM-YYYY) to the ISO standard format (YYYY-MM-DD).

## Why This Migration Is Needed
- The application now enforces ISO date format (YYYY-MM-DD) for all date operations
- Existing dates in non-ISO formats will not be correctly filtered or displayed
- Text-based date comparisons in PostgreSQL require consistent formatting

## Tables Affected
- `attendance` - date column
- `lesson_reports` - date column  
- `makeup_lessons` - scheduled_date column
- `students` - enrollment_date column

## How to Run

### PostgreSQL
```bash
psql -d your_database_name -f database/migrations/002_normalize_date_formats.sql
```

### Using psql with environment variable
```bash
psql $DATABASE_URL -f database/migrations/002_normalize_date_formats.sql
```

## What It Does
The migration:
1. Identifies dates not in YYYY-MM-DD format using regex patterns
2. Converts MM/DD/YYYY format to YYYY-MM-DD
3. Converts DD-MM-YYYY format to YYYY-MM-DD
4. Leaves already-formatted ISO dates unchanged
5. Updates all affected records in place

## Rollback
There is no automatic rollback. If you need to revert:
1. Restore from database backup taken before migration
2. Or manually convert dates back (not recommended)

## Safety
- The migration uses UPDATE with WHERE clauses to only affect non-ISO dates
- Always backup your database before running migrations
- Test on a staging/development database first

## Verification
After running the migration, verify all dates are in ISO format:

```sql
-- Check attendance dates
SELECT DISTINCT date FROM attendance WHERE date !~ '^\d{4}-\d{2}-\d{2}$';

-- Check lesson report dates  
SELECT DISTINCT date FROM lesson_reports WHERE date !~ '^\d{4}-\d{2}-\d{2}$';

-- Check makeup lesson dates
SELECT DISTINCT scheduled_date FROM makeup_lessons WHERE scheduled_date !~ '^\d{4}-\d{2}-\d{2}$';

-- Check student enrollment dates
SELECT DISTINCT enrollment_date FROM students WHERE enrollment_date IS NOT NULL AND enrollment_date !~ '^\d{4}-\d{2}-\d{2}$';
```

If any of these queries return rows, those dates are still in non-ISO format and need attention.
