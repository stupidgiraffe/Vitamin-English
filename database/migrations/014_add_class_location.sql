-- Add optional location column to classes table
-- Values: 'nanakuma', 'torikai', or NULL (no location assigned)
ALTER TABLE classes ADD COLUMN IF NOT EXISTS location VARCHAR(50) DEFAULT NULL
  CHECK (location IS NULL OR location IN ('nanakuma', 'torikai'));

-- Add index for filtering by location
CREATE INDEX IF NOT EXISTS idx_classes_location ON classes(location);
