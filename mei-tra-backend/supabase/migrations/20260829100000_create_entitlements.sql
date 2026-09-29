-- Paid perks (the ¥400/month membership to begin with) are granted through
-- RevenueCat webhooks and read back by the backend when a client asks what it
-- is entitled to. One row per user per entitlement; renewals and cancellations
-- update the row in place. Clients never touch this table directly — the
-- backend serves it on the service role, matching the push_tokens stance.
--
-- ON DELETE CASCADE is deliberate: when a user deletes their account the grant
-- rows go with it, and the purchase records of record stay in RevenueCat and
-- the stores. The nightly anonymous-user purge is taught to skip entitlement
-- holders separately (20260829100200) so it can never take a paying account
-- with it.

CREATE TABLE public.entitlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    entitlement TEXT NOT NULL,
    source TEXT NOT NULL,
    product_id TEXT,
    rc_app_user_id TEXT,
    will_renew BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMP WITH TIME ZONE,
    granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT entitlements_source_check CHECK (
        source IN ('app_store', 'play', 'web', 'promo')
    ),
    CONSTRAINT entitlements_entitlement_length_check CHECK (
        char_length(entitlement) BETWEEN 1 AND 64
    ),
    CONSTRAINT entitlements_user_entitlement_unique UNIQUE (user_id, entitlement)
);

CREATE INDEX idx_entitlements_user_id ON public.entitlements(user_id);

CREATE TRIGGER update_entitlements_updated_at
    BEFORE UPDATE ON public.entitlements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access on entitlements" ON public.entitlements
    FOR ALL USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

REVOKE ALL ON TABLE public.entitlements FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.entitlements TO service_role;
