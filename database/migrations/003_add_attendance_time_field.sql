-- Migration: Add time field to attendance table
-- Date: 2026-02-01
-- Purpose: Store class time with attendance records

-- Add time column to attendance table
ALTER TABLE attendance ADD COLUMN time TEXT;
