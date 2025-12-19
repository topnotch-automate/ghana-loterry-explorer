-- Migration: 005_yearly_pattern_tracking
-- Description: Add yearly pattern tracking for cross-year analysis
-- This supports the Law of Large Numbers approach where patterns from previous years
-- can inform predictions for the current year

-- Add year column to draws table for easy yearly grouping
ALTER TABLE draws
ADD COLUMN IF NOT EXISTS draw_year INTEGER GENERATED ALWAYS AS (EXTRACT(YEAR FROM draw_date)::INTEGER) STORED;

-- Create index for year-based queries
CREATE INDEX IF NOT EXISTS idx_draws_year ON draws(draw_year);
CREATE INDEX IF NOT EXISTS idx_draws_year_type ON draws(draw_year, lotto_type);

-- Yearly statistics table - stores aggregated statistics per year
CREATE TABLE IF NOT EXISTS yearly_statistics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    year INTEGER NOT NULL,
    lotto_type TEXT, -- NULL means all types combined
    total_draws INTEGER DEFAULT 0,
    
    -- Number frequency data (stored as JSONB for flexibility)
    -- Format: {"1": {"total": 50, "winning": 25, "machine": 25}, "2": {...}, ...}
    number_frequencies JSONB DEFAULT '{}',
    
    -- Hot numbers for this year (most frequent)
    hot_numbers INTEGER[] DEFAULT '{}',
    
    -- Cold numbers for this year (least frequent)
    cold_numbers INTEGER[] DEFAULT '{}',
    
    -- Common pairs that appeared together
    -- Format: [{"numbers": [1, 2], "count": 10}, ...]
    common_pairs JSONB DEFAULT '[]',
    
    -- Common triplets that appeared together
    -- Format: [{"numbers": [1, 2, 3], "count": 5}, ...]
    common_triplets JSONB DEFAULT '[]',
    
    -- Sum statistics (average sum, min, max, std deviation)
    sum_stats JSONB DEFAULT '{}',
    
    -- Even/Odd distribution stats
    even_odd_stats JSONB DEFAULT '{}',
    
    -- High/Low distribution stats (1-45 vs 46-90)
    high_low_stats JSONB DEFAULT '{}',
    
    -- Gap patterns (spacing between consecutive numbers)
    gap_patterns JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_year_type UNIQUE (year, lotto_type)
);

CREATE INDEX IF NOT EXISTS idx_yearly_stats_year ON yearly_statistics(year);
CREATE INDEX IF NOT EXISTS idx_yearly_stats_type ON yearly_statistics(lotto_type);

-- Cross-year patterns table - detects patterns that repeat across years
CREATE TABLE IF NOT EXISTS yearly_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pattern_type TEXT NOT NULL, -- 'number_emergence', 'sequence_repeat', 'frequency_shift', 'pair_recurrence', 'triplet_recurrence'
    lotto_type TEXT, -- NULL means pattern found across all types
    
    -- Years where this pattern was observed
    years_observed INTEGER[] NOT NULL,
    
    -- Pattern details (varies by pattern type)
    pattern_data JSONB NOT NULL,
    
    -- Confidence score (0-1) based on how consistently pattern appears
    confidence DECIMAL(5,4) DEFAULT 0,
    
    -- Number of years pattern has been observed
    occurrence_count INTEGER DEFAULT 1,
    
    -- Is this pattern currently active/relevant?
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Prediction: numbers likely to appear based on this pattern
    predicted_numbers INTEGER[] DEFAULT '{}',
    
    first_seen_year INTEGER,
    last_seen_year INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_yearly_patterns_type ON yearly_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_yearly_patterns_lotto ON yearly_patterns(lotto_type);
CREATE INDEX IF NOT EXISTS idx_yearly_patterns_active ON yearly_patterns(is_active);
CREATE INDEX IF NOT EXISTS idx_yearly_patterns_confidence ON yearly_patterns(confidence DESC);

-- Year-over-year comparison table
CREATE TABLE IF NOT EXISTS year_comparisons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    year1 INTEGER NOT NULL,
    year2 INTEGER NOT NULL,
    lotto_type TEXT,
    
    -- Similarity score between years (0-1)
    similarity_score DECIMAL(5,4) DEFAULT 0,
    
    -- Common hot numbers between years
    common_hot_numbers INTEGER[] DEFAULT '{}',
    
    -- Common cold numbers between years
    common_cold_numbers INTEGER[] DEFAULT '{}',
    
    -- Numbers that transitioned from cold to hot
    cold_to_hot_numbers INTEGER[] DEFAULT '{}',
    
    -- Numbers that transitioned from hot to cold
    hot_to_cold_numbers INTEGER[] DEFAULT '{}',
    
    -- Recurring pairs/triplets
    recurring_combinations JSONB DEFAULT '{}',
    
    -- Detailed comparison data
    comparison_data JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_year_comparison UNIQUE (year1, year2, lotto_type),
    CONSTRAINT year_order CHECK (year1 < year2)
);

CREATE INDEX IF NOT EXISTS idx_year_comparisons_years ON year_comparisons(year1, year2);

-- View for easy access to draws by year
CREATE OR REPLACE VIEW draws_by_year AS
SELECT 
    draw_year,
    lotto_type,
    COUNT(*) as draw_count,
    MIN(draw_date) as first_draw,
    MAX(draw_date) as last_draw,
    ARRAY_AGG(DISTINCT id) as draw_ids
FROM draws
GROUP BY draw_year, lotto_type
ORDER BY draw_year DESC, lotto_type;

-- View for yearly number frequency
CREATE OR REPLACE VIEW yearly_number_frequency AS
SELECT 
    EXTRACT(YEAR FROM draw_date)::INTEGER as year,
    lotto_type,
    num AS number,
    COUNT(*) AS total_count,
    COUNT(*) FILTER (WHERE panel = 'winning') AS winning_count,
    COUNT(*) FILTER (WHERE panel = 'machine') AS machine_count
FROM (
    SELECT draw_date, lotto_type, unnest(winning_numbers) AS num, 'winning' AS panel FROM draws
    UNION ALL
    SELECT draw_date, lotto_type, unnest(machine_numbers) AS num, 'machine' AS panel FROM draws
) AS all_numbers
GROUP BY EXTRACT(YEAR FROM draw_date)::INTEGER, lotto_type, num
ORDER BY year DESC, lotto_type, total_count DESC;

-- Function to update yearly statistics for a specific year
CREATE OR REPLACE FUNCTION update_yearly_statistics(p_year INTEGER, p_lotto_type TEXT DEFAULT NULL)
RETURNS void AS $$
DECLARE
    v_total_draws INTEGER;
    v_frequencies JSONB;
    v_hot_numbers INTEGER[];
    v_cold_numbers INTEGER[];
BEGIN
    -- Count total draws
    SELECT COUNT(*) INTO v_total_draws
    FROM draws
    WHERE draw_year = p_year
      AND (p_lotto_type IS NULL OR lotto_type = p_lotto_type);
    
    -- Calculate number frequencies
    SELECT jsonb_object_agg(
        number::text,
        jsonb_build_object(
            'total', total_count,
            'winning', winning_count,
            'machine', machine_count
        )
    ) INTO v_frequencies
    FROM (
        SELECT 
            num AS number,
            COUNT(*) AS total_count,
            COUNT(*) FILTER (WHERE panel = 'winning') AS winning_count,
            COUNT(*) FILTER (WHERE panel = 'machine') AS machine_count
        FROM (
            SELECT unnest(winning_numbers) AS num, 'winning' AS panel FROM draws
            WHERE draw_year = p_year AND (p_lotto_type IS NULL OR lotto_type = p_lotto_type)
            UNION ALL
            SELECT unnest(machine_numbers) AS num, 'machine' AS panel FROM draws
            WHERE draw_year = p_year AND (p_lotto_type IS NULL OR lotto_type = p_lotto_type)
        ) AS nums
        GROUP BY num
    ) AS freq;
    
    -- Get hot numbers (top 15)
    SELECT ARRAY_AGG(number ORDER BY total_count DESC) INTO v_hot_numbers
    FROM (
        SELECT num AS number, COUNT(*) AS total_count
        FROM (
            SELECT unnest(winning_numbers) AS num FROM draws
            WHERE draw_year = p_year AND (p_lotto_type IS NULL OR lotto_type = p_lotto_type)
        ) AS nums
        GROUP BY num
        ORDER BY total_count DESC
        LIMIT 15
    ) AS hot;
    
    -- Get cold numbers (bottom 15 that appeared at least once)
    SELECT ARRAY_AGG(number ORDER BY total_count ASC) INTO v_cold_numbers
    FROM (
        SELECT num AS number, COUNT(*) AS total_count
        FROM (
            SELECT unnest(winning_numbers) AS num FROM draws
            WHERE draw_year = p_year AND (p_lotto_type IS NULL OR lotto_type = p_lotto_type)
        ) AS nums
        GROUP BY num
        ORDER BY total_count ASC
        LIMIT 15
    ) AS cold;
    
    -- Upsert yearly statistics
    INSERT INTO yearly_statistics (year, lotto_type, total_draws, number_frequencies, hot_numbers, cold_numbers, updated_at)
    VALUES (p_year, p_lotto_type, v_total_draws, v_frequencies, v_hot_numbers, v_cold_numbers, NOW())
    ON CONFLICT (year, lotto_type)
    DO UPDATE SET
        total_draws = EXCLUDED.total_draws,
        number_frequencies = EXCLUDED.number_frequencies,
        hot_numbers = EXCLUDED.hot_numbers,
        cold_numbers = EXCLUDED.cold_numbers,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Trigger to update yearly statistics when new draw is added
CREATE OR REPLACE FUNCTION trigger_update_yearly_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Update stats for the year and lotto type
    PERFORM update_yearly_statistics(NEW.draw_year, NEW.lotto_type);
    -- Also update overall stats for the year
    PERFORM update_yearly_statistics(NEW.draw_year, NULL);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_yearly_stats_update ON draws;
CREATE TRIGGER trigger_yearly_stats_update
    AFTER INSERT ON draws
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_yearly_stats();
