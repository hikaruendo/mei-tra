import { readFileSync } from 'fs';
import { join } from 'path';

describe('push token migration security', () => {
  const createSql = readFileSync(
    join(
      __dirname,
      '../../supabase/migrations/20260723090000_create_push_tokens.sql',
    ),
    'utf8',
  );
  const hardeningSql = readFileSync(
    join(
      __dirname,
      '../../supabase/migrations/20260723150938_harden_push_token_access.sql',
    ),
    'utf8',
  );

  it('keeps push token table access backend-only', () => {
    expect(createSql).toContain(
      'REVOKE ALL ON TABLE public.push_tokens FROM PUBLIC, anon, authenticated;',
    );
    expect(createSql).not.toMatch(
      /GRANT\s+(?:SELECT|INSERT|UPDATE|DELETE|ALL)[^;]+ON TABLE public\.push_tokens TO authenticated/i,
    );
    expect(hardeningSql).toContain(
      'REVOKE ALL ON TABLE public.push_tokens FROM PUBLIC, anon, authenticated;',
    );
    expect(hardeningSql).not.toMatch(
      /GRANT\s+(?:SELECT|INSERT|UPDATE|DELETE|ALL)[^;]+ON TABLE public\.push_tokens TO authenticated/i,
    );
  });

  it('does not expose a security-definer RPC in the public schema', () => {
    expect(createSql).toContain('SECURITY INVOKER');
    expect(createSql).not.toContain('SECURITY DEFINER');
    expect(createSql).toContain(
      'REVOKE ALL ON FUNCTION public.upsert_push_token(UUID, TEXT, TEXT, TEXT, TEXT)\n    FROM PUBLIC, anon, authenticated;',
    );
    expect(createSql).toContain(
      'GRANT EXECUTE ON FUNCTION public.upsert_push_token(UUID, TEXT, TEXT, TEXT, TEXT)\n    TO service_role;',
    );
    expect(hardeningSql).toContain('SECURITY INVOKER');
    expect(hardeningSql).not.toContain('SECURITY DEFINER');
    expect(hardeningSql).toContain(
      'REVOKE ALL ON FUNCTION public.upsert_push_token(UUID, TEXT, TEXT, TEXT, TEXT)\n    FROM PUBLIC, anon, authenticated;',
    );
    expect(hardeningSql).toContain(
      'GRANT EXECUTE ON FUNCTION public.upsert_push_token(UUID, TEXT, TEXT, TEXT, TEXT)\n    TO service_role;',
    );
  });

  it('removes legacy direct-user RLS policies in already-migrated databases', () => {
    expect(hardeningSql).toContain(
      'DROP POLICY IF EXISTS "Users can view their own push tokens" ON public.push_tokens;',
    );
    expect(hardeningSql).toContain(
      'DROP POLICY IF EXISTS "Users can register their own push tokens" ON public.push_tokens;',
    );
    expect(hardeningSql).toContain(
      'DROP POLICY IF EXISTS "Users can update their own push tokens" ON public.push_tokens;',
    );
    expect(hardeningSql).toContain(
      'DROP POLICY IF EXISTS "Users can delete their own push tokens" ON public.push_tokens;',
    );
  });
});
