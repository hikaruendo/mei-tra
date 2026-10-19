-- Server-owned runtime configuration the clients poll through the backend:
-- whether the membership paywall is live, which perks its copy may list, and
-- whether ads are on. Changing a row changes shipped behaviour without a
-- store release, which is what lets monetization phases roll out (and roll
-- back) as data. Same access stance as entitlements: service role only, the
-- backend serves reads.

CREATE TABLE public.app_flags (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT app_flags_key_length_check CHECK (
        char_length(key) BETWEEN 1 AND 128
    )
);

CREATE TRIGGER update_app_flags_updated_at
    BEFORE UPDATE ON public.app_flags
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.app_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access on app_flags" ON public.app_flags
    FOR ALL USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

REVOKE ALL ON TABLE public.app_flags FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.app_flags TO service_role;

-- Everything monetization-related ships dark.
INSERT INTO public.app_flags (key, value) VALUES
    ('monetization.membership_enabled', 'false'::jsonb),
    ('monetization.paywall_perks', '[]'::jsonb),
    ('ads.enabled', 'false'::jsonb);
