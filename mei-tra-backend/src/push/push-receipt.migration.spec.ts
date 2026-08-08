import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(
    __dirname,
    '../../supabase/migrations/20260806165611_push_receipt_tracking.sql',
  ),
  'utf8',
);

describe('push receipt migration security and concurrency', () => {
  it('stores only receipt/token identity and delivery metadata', () => {
    expect(migration).toContain('CREATE TABLE public.push_receipts');
    expect(migration).toContain('expo_receipt_id TEXT NOT NULL UNIQUE');
    expect(migration).toContain('push_token_id UUID');
    expect(migration).toContain('user_id UUID NOT NULL');
    expect(migration).toContain('device_id TEXT NOT NULL');
    expect(migration).toContain('expo_push_token TEXT NOT NULL');
    expect(migration).not.toMatch(/title|body|payload|data\s+JSONB/i);
  });

  it('delays the first receipt claim until approximately 15 minutes after sending', () => {
    expect(migration).toContain(
      "next_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes')",
    );
    expect(migration).toContain(
      "(status = 'pending' AND next_attempt_at <= NOW())",
    );
  });

  it('claims rows with row locks and exposes the table only to service role', () => {
    expect(migration).toContain('FOR UPDATE SKIP LOCKED');
    expect(migration).toContain(
      'REVOKE ALL ON TABLE public.push_receipts FROM PUBLIC, anon, authenticated;',
    );
    expect(migration).toContain(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.push_receipts TO service_role;',
    );
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.claim_push_receipts(INTEGER, TEXT, INTEGER) TO service_role;',
    );
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.complete_push_receipt(UUID, TEXT, TEXT, TEXT)\n    TO service_role;',
    );
  });
});
