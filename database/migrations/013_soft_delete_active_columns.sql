-- Migration 013: Soft-delete framework – ensure `active` columns exist
--
-- The application uses a soft-delete pattern (setting active = false) rather
-- than hard-deleting rows so that historical data is preserved.  The main
-- schema already defines these columns for new installations; this migration
-- adds them with a safe `ADD COLUMN IF NOT EXISTS` guard for any database
-- that was created before the columns were introduced.
--
-- Affected tables: students, classes
-- Safe to run multiple times (idempotent).

-- students ----------------------------------------------------------------
-- Step 1: add the column as nullable so the statement works on non-empty tables
ALTER TABLE students
    ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- Step 2: back-fill any NULLs that existed before the column was added
UPDATE students SET active = true WHERE active IS NULL;

-- Step 3: now that all rows have a value, enforce NOT NULL
ALTER TABLE students
    ALTER COLUMN active SET NOT NULL;

-- classes -----------------------------------------------------------------
ALTER TABLE classes
    ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

UPDATE classes SET active = true WHERE active IS NULL;

ALTER TABLE classes
    ALTER COLUMN active SET NOT NULL;
