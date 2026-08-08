CREATE TABLE public.push_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    expo_push_token TEXT NOT NULL,
    app_version TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT push_tokens_platform_check CHECK (platform IN ('ios', 'android')),
    CONSTRAINT push_tokens_token_format_check CHECK (
        expo_push_token ~ '^(Expo|Exponent)PushToken\[[^]]+\]$'
    ),
    CONSTRAINT push_tokens_device_platform_unique
        UNIQUE (user_id, device_id, platform),
    CONSTRAINT push_tokens_token_unique UNIQUE (expo_push_token)
);

CREATE INDEX idx_push_tokens_user_id ON public.push_tokens(user_id);
CREATE INDEX idx_push_tokens_last_seen_at ON public.push_tokens(last_seen_at);

CREATE TRIGGER update_push_tokens_updated_at
    BEFORE UPDATE ON public.push_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access on push_tokens" ON public.push_tokens
    FOR ALL USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

REVOKE ALL ON TABLE public.push_tokens FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.push_tokens TO service_role;

CREATE OR REPLACE FUNCTION public.upsert_push_token(
    p_user_id UUID,
    p_device_id TEXT,
    p_platform TEXT,
    p_expo_push_token TEXT,
    p_app_version TEXT DEFAULT NULL
)
RETURNS public.push_tokens
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    result public.push_tokens;
BEGIN
    IF p_user_id IS NULL
       OR p_device_id IS NULL
       OR char_length(trim(p_device_id)) = 0
       OR char_length(p_device_id) > 255
       OR p_platform NOT IN ('ios', 'android')
       OR p_expo_push_token IS NULL
       OR p_expo_push_token !~ '^(Expo|Exponent)PushToken\[[^]]+\]$'
    THEN
        RAISE EXCEPTION 'Invalid push token registration';
    END IF;

    DELETE FROM public.push_tokens
    WHERE expo_push_token = p_expo_push_token
      AND NOT (
          user_id = p_user_id
          AND device_id = trim(p_device_id)
          AND platform = p_platform
      );

    INSERT INTO public.push_tokens (
        user_id,
        device_id,
        platform,
        expo_push_token,
        app_version,
        last_seen_at
    )
    VALUES (
        p_user_id,
        trim(p_device_id),
        p_platform,
        p_expo_push_token,
        NULLIF(trim(p_app_version), ''),
        NOW()
    )
    ON CONFLICT (user_id, device_id, platform)
    DO UPDATE SET
        expo_push_token = EXCLUDED.expo_push_token,
        app_version = EXCLUDED.app_version,
        last_seen_at = NOW()
    RETURNING * INTO result;

    RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_push_token(UUID, TEXT, TEXT, TEXT, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_push_token(UUID, TEXT, TEXT, TEXT, TEXT)
    TO service_role;
