-- Betting AI Database Schema for Supabase

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Premier League Matches
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id VARCHAR(100) UNIQUE NOT NULL,
    league VARCHAR(100) DEFAULT 'Premier League',
    match_date TIMESTAMP WITH TIME ZONE NOT NULL,
    home_team VARCHAR(100) NOT NULL,
    away_team VARCHAR(100) NOT NULL,
    home_score INTEGER,
    away_score INTEGER,
    status VARCHAR(20) DEFAULT 'scheduled', -- scheduled, live, finished
    round VARCHAR(50),
    season VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- HK Horse Racing Races
CREATE TABLE races (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id VARCHAR(100) UNIQUE NOT NULL,
    venue VARCHAR(50) NOT NULL, -- 'Sha Tin' or 'Happy Valley'
    race_date DATE NOT NULL,
    race_number INTEGER NOT NULL,
    race_time TIME NOT NULL,
    distance INTEGER NOT NULL, -- meters
    going VARCHAR(50), -- 'Good', 'Fast', 'Slow', etc.
    weather VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Horses in each race
CREATE TABLE horses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    race_id UUID REFERENCES races(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    draw INTEGER, -- barrier position
    jockey VARCHAR(100),
    trainer VARCHAR(100),
    weight INTEGER, -- pounds
    last_5_runs VARCHAR(20), -- e.g., '1-2-3-4-5'
    form_rating FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Predictions
CREATE TABLE predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    race_id UUID REFERENCES races(id) ON DELETE CASCADE,
    market VARCHAR(50) NOT NULL, -- e.g., '1X2', 'Over_Under_2.5', 'Win'
    selection VARCHAR(100) NOT NULL, -- e.g., 'Home Win', 'Over 2.5', 'Horse Name'
    probability FLOAT NOT NULL, -- 0.0 to 1.0
    confidence VARCHAR(20) NOT NULL, -- 'Low', 'Medium', 'High'
    odds_value FLOAT, -- calculated odds (1/probability)
    key_factors JSONB, -- array of factors that influenced the prediction
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT chk_match_or_race CHECK (
        (match_id IS NOT NULL AND race_id IS NULL) OR
        (match_id IS NULL AND race_id IS NOT NULL)
    )
);

-- Results for tracking accuracy
CREATE TABLE results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
    race_id UUID REFERENCES races(id) ON DELETE SET NULL,
    market VARCHAR(50) NOT NULL,
    selection VARCHAR(100) NOT NULL,
    result VARCHAR(100), -- 'Win', 'Loss', etc.
    actual_value JSONB, -- e.g., {'home_score': 2, 'away_score': 1}
    settled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT chk_match_or_race_result CHECK (
        (match_id IS NOT NULL AND race_id IS NULL) OR
        (match_id IS NULL AND race_id IS NOT NULL)
    )
);

-- Indexes for performance
CREATE INDEX idx_matches_date ON matches(match_date);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_races_date ON races(race_date);
CREATE INDEX idx_races_venue ON races(venue);
CREATE INDEX idx_predictions_match ON predictions(match_id);
CREATE INDEX idx_predictions_race ON predictions(race_id);
CREATE INDEX idx_results_match ON results(match_id);
CREATE INDEX idx_results_race ON results(race_id);

-- Enable Row Level Security (for future auth)
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;

-- Functions
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_matches_updated_at
    BEFORE UPDATE ON matches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_races_updated_at
    BEFORE UPDATE ON races
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
