ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own push tokens" ON public.push_tokens;
DROP POLICY IF EXISTS "Users can register their own push tokens" ON public.push_tokens;
DROP POLICY IF EXISTS "Users can update their own push tokens" ON public.push_tokens;
DROP POLICY IF EXISTS "Users can delete their own push tokens" ON public.push_tokens;
DROP POLICY IF EXISTS "Allow service role full access on push_tokens" ON public.push_tokens;

CREATE POLICY "Allow service role full access on push_tokens" ON public.push_tokens
    FOR ALL USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

REVOKE ALL ON TABLE public.push_tokens FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.push_tokens TO service_role;

ALTER FUNCTION public.upsert_push_token(UUID, TEXT, TEXT, TEXT, TEXT)
    SECURITY INVOKER;
ALTER FUNCTION public.upsert_push_token(UUID, TEXT, TEXT, TEXT, TEXT)
    SET search_path = '';

REVOKE ALL ON FUNCTION public.upsert_push_token(UUID, TEXT, TEXT, TEXT, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_push_token(UUID, TEXT, TEXT, TEXT, TEXT)
    TO service_role;
