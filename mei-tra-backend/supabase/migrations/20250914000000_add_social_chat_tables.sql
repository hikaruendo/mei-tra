-- Social Layer: Chat Tables Migration
-- This migration creates the foundational chat infrastructure with automatic message cleanup

-- ============================================================================
-- ENABLE EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================================
-- NOTE: Profiles are managed by user_profiles table (created in earlier migration)
-- This migration only creates chat-specific tables
-- ============================================================================

-- ============================================================================
-- CHAT ROOMS TABLE
-- ============================================================================
CREATE TYPE chat_room_scope AS ENUM ('global', 'lobby', 'table', 'private');
CREATE TYPE chat_room_visibility AS ENUM ('public', 'friends', 'private');

CREATE TABLE chat_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scope chat_room_scope NOT NULL,
    name VARCHAR(255),
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    visibility chat_room_visibility NOT NULL DEFAULT 'public',
    message_ttl_hours INTEGER NOT NULL DEFAULT 24,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- CHAT MEMBERS TABLE
-- ============================================================================
CREATE TYPE chat_member_role AS ENUM ('member', 'moderator');

CREATE TABLE chat_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role chat_member_role NOT NULL DEFAULT 'member',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(room_id, user_id)
);

-- ============================================================================
-- CHAT MESSAGES TABLE
-- ============================================================================
CREATE TYPE chat_content_type AS ENUM ('text', 'emoji', 'system');

CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    content_type chat_content_type NOT NULL DEFAULT 'text',
    reply_to UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX idx_chat_rooms_scope ON chat_rooms(scope);
CREATE INDEX idx_chat_rooms_visibility ON chat_rooms(visibility);
CREATE INDEX idx_chat_rooms_owner_id ON chat_rooms(owner_id);

CREATE INDEX idx_chat_members_room_id ON chat_members(room_id);
CREATE INDEX idx_chat_members_user_id ON chat_members(user_id);

CREATE INDEX idx_chat_messages_room_id ON chat_messages(room_id);
CREATE INDEX idx_chat_messages_sender_id ON chat_messages(sender_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX idx_chat_messages_room_created ON chat_messages(room_id, created_at DESC);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================
CREATE TRIGGER update_chat_rooms_updated_at BEFORE UPDATE ON chat_rooms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access on chat_rooms" ON chat_rooms
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on chat_members" ON chat_members
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on chat_messages" ON chat_messages
    FOR ALL USING (auth.role() = 'service_role');

-- Chat rooms: users can view public/friends rooms
CREATE POLICY "Users can view public rooms" ON chat_rooms
    FOR SELECT USING (visibility = 'public' OR auth.role() = 'service_role');

-- Chat messages: users can view messages in rooms they're members of
CREATE POLICY "Users can view messages in their rooms" ON chat_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM chat_members
            WHERE chat_members.room_id = chat_messages.room_id
            AND chat_members.user_id = auth.uid()
        ) OR auth.role() = 'service_role'
    );

-- ============================================================================
-- DEFAULT CHAT ROOMS
-- ============================================================================
INSERT INTO chat_rooms (scope, name, visibility, message_ttl_hours)
VALUES
    ('global', 'Global Chat', 'public', 24),
    ('lobby', 'Lobby Chat', 'public', 12);

-- ============================================================================
-- AUTOMATIC MESSAGE CLEANUP (pg_cron)
-- ============================================================================
-- Ensure cron jobs are idempotent - unschedule if exists
DO $$
BEGIN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'cleanup-old-chat-messages';
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

DO $$
BEGIN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'cleanup-abandoned-private-rooms';
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- Delete messages older than their room's TTL
-- This job runs every hour
SELECT cron.schedule(
    'cleanup-old-chat-messages',
    '0 * * * *',  -- Every hour at minute 0
    $$
    DELETE FROM chat_messages
    WHERE id IN (
        SELECT cm.id
        FROM chat_messages cm
        JOIN chat_rooms cr ON cm.room_id = cr.id
        WHERE cm.created_at < NOW() - (cr.message_ttl_hours || ' hours')::INTERVAL
    );
    $$
);

-- ============================================================================
-- CLEANUP ABANDONED ROOMS (Optional)
-- ============================================================================
-- Delete empty private rooms older than 7 days
SELECT cron.schedule(
    'cleanup-abandoned-private-rooms',
    '0 2 * * *',  -- Daily at 2 AM
    $$
    DELETE FROM chat_rooms
    WHERE scope = 'private'
    AND created_at < NOW() - INTERVAL '7 days'
    AND NOT EXISTS (
        SELECT 1 FROM chat_members WHERE chat_members.room_id = chat_rooms.id
    );
    $$
);
