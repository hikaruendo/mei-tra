CREATE TABLE public.push_receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expo_receipt_id TEXT NOT NULL UNIQUE,
    push_token_id UUID REFERENCES public.push_tokens(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    expo_push_token TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    attempt_count INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
    worker_id TEXT,
    locked_until TIMESTAMP WITH TIME ZONE,
    provider_error_code TEXT,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT push_receipts_platform_check CHECK (platform IN ('ios', 'android')),
    CONSTRAINT push_receipts_status_check CHECK (
        status IN ('pending', 'processing', 'delivered', 'failed', 'expired')
    ),
    CONSTRAINT push_receipts_attempt_count_check CHECK (attempt_count >= 0),
    CONSTRAINT push_receipts_device_id_check CHECK (char_length(device_id) BETWEEN 1 AND 255),
    CONSTRAINT push_receipts_token_check CHECK (
        expo_push_token ~ '^(Expo|Exponent)PushToken\[[^]]+\]$'
    ),
    CONSTRAINT push_receipts_worker_id_check CHECK (
        worker_id IS NULL OR char_length(worker_id) BETWEEN 1 AND 128
    ),
    CONSTRAINT push_receipts_provider_error_check CHECK (
        provider_error_code IS NULL OR char_length(provider_error_code) BETWEEN 1 AND 100
    )
);

CREATE INDEX idx_push_receipts_pending
    ON public.push_receipts (next_attempt_at, created_at)
    WHERE status = 'pending';

CREATE INDEX idx_push_receipts_processing_lock
    ON public.push_receipts (locked_until)
    WHERE status = 'processing';

CREATE INDEX idx_push_receipts_user_id ON public.push_receipts(user_id);

CREATE TRIGGER update_push_receipts_updated_at
    BEFORE UPDATE ON public.push_receipts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.push_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access on push_receipts"
    ON public.push_receipts
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

REVOKE ALL ON TABLE public.push_receipts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.push_receipts TO service_role;

CREATE OR REPLACE FUNCTION public.claim_push_receipts(
    p_limit INTEGER,
    p_worker_id TEXT,
    p_lock_seconds INTEGER
)
RETURNS SETOF public.push_receipts
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    IF p_limit IS NULL OR p_limit < 1 OR p_worker_id IS NULL
       OR char_length(trim(p_worker_id)) = 0 OR char_length(p_worker_id) > 128
       OR p_lock_seconds IS NULL OR p_lock_seconds NOT BETWEEN 10 AND 600
    THEN
        RAISE EXCEPTION 'Invalid push receipt claim parameters';
    END IF;

    RETURN QUERY
    WITH candidates AS (
        SELECT id
        FROM public.push_receipts
        WHERE (
            (status = 'pending' AND next_attempt_at <= NOW())
            OR (
                status = 'processing'
                AND locked_until IS NOT NULL
                AND locked_until <= NOW()
            )
        )
        ORDER BY next_attempt_at, created_at
        FOR UPDATE SKIP LOCKED
        LIMIT LEAST(p_limit, 100)
    )
    UPDATE public.push_receipts AS receipt
    SET
        status = 'processing',
        attempt_count = receipt.attempt_count + 1,
        worker_id = trim(p_worker_id),
        locked_until = NOW() + (p_lock_seconds * INTERVAL '1 second'),
        updated_at = NOW()
    FROM candidates
    WHERE receipt.id = candidates.id
    RETURNING receipt.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.reschedule_push_receipt(
    p_receipt_row_id UUID,
    p_worker_id TEXT,
    p_next_attempt_at TIMESTAMP WITH TIME ZONE,
    p_provider_error_code TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    IF p_receipt_row_id IS NULL OR p_worker_id IS NULL
       OR char_length(trim(p_worker_id)) = 0 OR char_length(p_worker_id) > 128
       OR p_next_attempt_at IS NULL
       OR p_provider_error_code IS NOT NULL
          AND (char_length(p_provider_error_code) < 1 OR char_length(p_provider_error_code) > 100)
    THEN
        RAISE EXCEPTION 'Invalid push receipt reschedule parameters';
    END IF;

    UPDATE public.push_receipts
    SET
        status = 'pending',
        next_attempt_at = p_next_attempt_at,
        worker_id = NULL,
        locked_until = NULL,
        provider_error_code = p_provider_error_code,
        updated_at = NOW()
    WHERE id = p_receipt_row_id
      AND status = 'processing'
      AND worker_id = trim(p_worker_id);

    RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_push_receipt(
    p_receipt_row_id UUID,
    p_worker_id TEXT,
    p_status TEXT,
    p_provider_error_code TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    receipt public.push_receipts%ROWTYPE;
BEGIN
    IF p_receipt_row_id IS NULL OR p_worker_id IS NULL
       OR char_length(trim(p_worker_id)) = 0 OR char_length(p_worker_id) > 128
       OR p_status NOT IN ('delivered', 'failed', 'expired')
       OR p_provider_error_code IS NOT NULL
          AND (char_length(p_provider_error_code) < 1 OR char_length(p_provider_error_code) > 100)
    THEN
        RAISE EXCEPTION 'Invalid push receipt completion parameters';
    END IF;

    SELECT *
    INTO receipt
    FROM public.push_receipts
    WHERE id = p_receipt_row_id
      AND status = 'processing'
      AND worker_id = trim(p_worker_id)
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    UPDATE public.push_receipts
    SET
        status = p_status,
        worker_id = NULL,
        locked_until = NULL,
        provider_error_code = p_provider_error_code,
        processed_at = NOW(),
        updated_at = NOW()
    WHERE id = receipt.id;

    IF p_status = 'failed' AND p_provider_error_code = 'DeviceNotRegistered' THEN
        DELETE FROM public.push_tokens
        WHERE expo_push_token = receipt.expo_push_token;
    END IF;

    RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_push_receipts(INTEGER, TEXT, INTEGER)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reschedule_push_receipt(UUID, TEXT, TIMESTAMP WITH TIME ZONE, TEXT)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_push_receipt(UUID, TEXT, TEXT, TEXT)
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_push_receipts(INTEGER, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.reschedule_push_receipt(UUID, TEXT, TIMESTAMP WITH TIME ZONE, TEXT)
    TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_push_receipt(UUID, TEXT, TEXT, TEXT)
    TO service_role;
