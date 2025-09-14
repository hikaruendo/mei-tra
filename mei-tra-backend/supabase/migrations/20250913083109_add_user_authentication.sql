-- Add user authentication and profiles

-- User profiles table (extends Supabase auth.users)
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Game statistics
    games_played INTEGER DEFAULT 0,
    games_won INTEGER DEFAULT 0,
    total_score INTEGER DEFAULT 0,

    -- User preferences
    preferences JSONB DEFAULT '{
        "notifications": true,
        "sound": true,
        "theme": "light"
    }'::jsonb,

    CONSTRAINT username_length CHECK (char_length(username) >= 3),
    CONSTRAINT display_name_length CHECK (char_length(display_name) >= 1)
);

-- Update room_players to reference user_profiles
ALTER TABLE room_players ADD COLUMN user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX idx_user_profiles_username ON user_profiles(username);
CREATE INDEX idx_user_profiles_last_seen ON user_profiles(last_seen_at);
CREATE INDEX idx_room_players_user_id ON room_players(user_id);

-- Trigger to update updated_at column for user_profiles
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS policies for user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can read all profiles (for game display)
CREATE POLICY "Public profiles are viewable by everyone" ON user_profiles
    FOR SELECT USING (true);

-- Users can only update their own profile
CREATE POLICY "Users can update their own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert their own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Service role has full access
CREATE POLICY "Allow service role full access on user_profiles" ON user_profiles
    FOR ALL USING (auth.role() = 'service_role');

-- Function to handle user profile creation on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- RLSを一時的に無効化して挿入
    INSERT INTO public.user_profiles (id, username, display_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)),
        COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'username', 'Player')
    );
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- エラーが発生してもユーザー作成は継続
        RAISE WARNING 'Failed to create user profile: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create user profile on auth.users insert
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to update last_seen_at timestamp
CREATE OR REPLACE FUNCTION update_user_last_seen(user_uuid UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE user_profiles
    SET last_seen_at = NOW()
    WHERE id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;