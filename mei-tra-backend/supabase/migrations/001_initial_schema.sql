-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Room status enum
CREATE TYPE room_status AS ENUM ('waiting', 'ready', 'playing', 'finished', 'abandoned');

-- Team assignment method enum  
CREATE TYPE team_assignment_method AS ENUM ('random', 'host-choice');

-- Game phase enum
CREATE TYPE game_phase AS ENUM ('deal', 'blow', 'play', 'waiting');

-- Trump type enum
CREATE TYPE trump_type AS ENUM ('tra', 'herz', 'daiya', 'club', 'zuppe');

-- Rooms table
CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    host_id VARCHAR(255) NOT NULL,
    status room_status NOT NULL DEFAULT 'waiting',
    settings JSONB NOT NULL DEFAULT '{
        "maxPlayers": 4,
        "isPrivate": false,
        "password": null,
        "teamAssignmentMethod": "random",
        "pointsToWin": 10,
        "allowSpectators": true
    }',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Players table (for room participants)
CREATE TABLE room_players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    player_id VARCHAR(255) NOT NULL,
    socket_id VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    hand JSONB DEFAULT '[]',
    team INTEGER NOT NULL DEFAULT 0,
    is_passer BOOLEAN DEFAULT FALSE,
    has_broken BOOLEAN DEFAULT FALSE,
    has_required_broken BOOLEAN DEFAULT FALSE,
    is_ready BOOLEAN DEFAULT FALSE,
    is_host BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(room_id, player_id)
);

-- Game states table (for persistent game state)
CREATE TABLE game_states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE UNIQUE,
    state_data JSONB NOT NULL DEFAULT '{}',
    current_player_index INTEGER DEFAULT 0,
    game_phase game_phase,
    round_number INTEGER DEFAULT 1,
    points_to_win INTEGER DEFAULT 10,
    team_scores JSONB DEFAULT '{
        "0": {"play": 0, "total": 0},
        "1": {"play": 0, "total": 0}
    }',
    team_score_records JSONB DEFAULT '{
        "0": [],
        "1": []
    }',
    team_assignments JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Game history table (for analytics and debugging)
CREATE TABLE game_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    game_state_id UUID REFERENCES game_states(id) ON DELETE CASCADE,
    action_type VARCHAR(100) NOT NULL,
    player_id VARCHAR(255),
    action_data JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_rooms_status ON rooms(status);
CREATE INDEX idx_rooms_host_id ON rooms(host_id);
CREATE INDEX idx_rooms_last_activity ON rooms(last_activity_at);
CREATE INDEX idx_room_players_room_id ON room_players(room_id);
CREATE INDEX idx_room_players_player_id ON room_players(player_id);
CREATE INDEX idx_room_players_socket_id ON room_players(socket_id);
CREATE INDEX idx_game_states_room_id ON game_states(room_id);
CREATE INDEX idx_game_history_room_id ON game_history(room_id);
CREATE INDEX idx_game_history_timestamp ON game_history(timestamp);

-- Trigger to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON rooms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_game_states_updated_at BEFORE UPDATE ON game_states
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_history ENABLE ROW LEVEL SECURITY;

-- RLS policies (allow all operations for service role)
CREATE POLICY "Allow service role full access on rooms" ON rooms
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access on room_players" ON room_players
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access on game_states" ON game_states
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access on game_history" ON game_history
    FOR ALL USING (auth.role() = 'service_role');