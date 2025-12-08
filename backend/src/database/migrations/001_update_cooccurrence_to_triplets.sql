-- Migration: Update number_cooccurrence table from pairs to triplets
-- This migration drops the old pairs table and creates a new triplets table

-- Drop the old table
DROP TABLE IF EXISTS number_cooccurrence;

-- Create new table for triplets
CREATE TABLE IF NOT EXISTS number_cooccurrence (
  number1 INTEGER NOT NULL,
  number2 INTEGER NOT NULL,
  number3 INTEGER NOT NULL,
  count INTEGER DEFAULT 0,
  winning_count INTEGER DEFAULT 0,
  machine_count INTEGER DEFAULT 0,
  last_seen DATE,
  PRIMARY KEY (number1, number2, number3),
  CHECK (number1 < number2 AND number2 < number3)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_cooccurrence_number1 ON number_cooccurrence(number1);
CREATE INDEX IF NOT EXISTS idx_cooccurrence_number2 ON number_cooccurrence(number2);
CREATE INDEX IF NOT EXISTS idx_cooccurrence_number3 ON number_cooccurrence(number3);
CREATE INDEX IF NOT EXISTS idx_cooccurrence_count ON number_cooccurrence(count DESC);
CREATE INDEX IF NOT EXISTS idx_cooccurrence_last_seen ON number_cooccurrence(last_seen DESC);

