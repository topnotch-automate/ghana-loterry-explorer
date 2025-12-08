-- Ghana Lottery Explorer Database Schema
-- Each draw: 5 winning numbers + 5 machine numbers (all from 1-90, duplicates allowed)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Main draws table
CREATE TABLE IF NOT EXISTS draws (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  draw_date DATE NOT NULL,
  lotto_type TEXT NOT NULL,
  winning_numbers INTEGER[5] NOT NULL,
  machine_numbers INTEGER[5] NOT NULL,
  source TEXT,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB,
  CONSTRAINT unique_draw_date_type UNIQUE (draw_date, lotto_type)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_draw_date ON draws(draw_date);
CREATE INDEX IF NOT EXISTS idx_lotto_type ON draws(lotto_type);
CREATE INDEX IF NOT EXISTS idx_winning_numbers_gin ON draws USING GIN (winning_numbers);
CREATE INDEX IF NOT EXISTS idx_machine_numbers_gin ON draws USING GIN (machine_numbers);
CREATE INDEX IF NOT EXISTS idx_published_at ON draws(published_at DESC);

-- Materialized view for number frequency (can be refreshed periodically)
CREATE MATERIALIZED VIEW IF NOT EXISTS number_frequency AS
SELECT 
  num AS number,
  COUNT(*) AS total_count,
  COUNT(*) FILTER (WHERE panel = 'winning') AS winning_count,
  COUNT(*) FILTER (WHERE panel = 'machine') AS machine_count
FROM (
  SELECT unnest(winning_numbers) AS num, 'winning' AS panel, draw_date FROM draws
  UNION ALL
  SELECT unnest(machine_numbers) AS num, 'machine' AS panel, draw_date FROM draws
) AS all_numbers
GROUP BY num;

CREATE INDEX IF NOT EXISTS idx_number_frequency_number ON number_frequency(number);

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_number_frequency()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY number_frequency;
END;
$$ LANGUAGE plpgsql;

-- Co-occurrence tracking (optional, for advanced analytics)
-- Tracks triplets (3 numbers) that appear together in draws
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

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_cooccurrence_number1 ON number_cooccurrence(number1);
CREATE INDEX IF NOT EXISTS idx_cooccurrence_number2 ON number_cooccurrence(number2);
CREATE INDEX IF NOT EXISTS idx_cooccurrence_number3 ON number_cooccurrence(number3);
CREATE INDEX IF NOT EXISTS idx_cooccurrence_count ON number_cooccurrence(count DESC);
CREATE INDEX IF NOT EXISTS idx_cooccurrence_last_seen ON number_cooccurrence(last_seen DESC);

-- Pattern detection cache
CREATE TABLE IF NOT EXISTS detected_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pattern_type TEXT NOT NULL, -- 'exact_match', 'partial_match', 'group_match', 'sequence'
  pattern_data JSONB NOT NULL,
  draw_ids UUID[] NOT NULL,
  first_seen DATE,
  last_seen DATE,
  occurrence_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pattern_type ON detected_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_pattern_data_gin ON detected_patterns USING GIN (pattern_data);

