import type { Session } from '@supabase/supabase-js';

import {
  clearPersistedAuthSession,
  completeOAuthCallback,
  createLatestAccessTokenGetter,
  parseOAuthCallback,
  resetOAuthCallbackCompletionStateForTests,
  SUPABASE_AUTH_STORAGE_KEY,
  TOKEN_REFRESH_SKEW_SECONDS,
  type OAuthCallbackAuthApi,
  type SessionAuthApi,
} from '@/lib/auth-session';

const session = (accessToken: string, expiresAt: number): Session =>
  ({
    access_token: accessToken,
    expires_at: expiresAt,
    expires_in: 3600,
    refresh_token: 'refresh-token',
    token_type: 'bearer',
    user: { id: 'user-1' },
  }) as Session;

describe('createLatestAccessTokenGetter', () => {
  it('returns the current token without refreshing when it is valid', async () => {
    const auth: SessionAuthApi = {
      getSession: jest
        .fn()
        .mockResolvedValue({
          data: { session: session('current', Math.floor(Date.now() / 1000) + 300) },
          error: null,
        }),
      refreshSession: jest.fn(),
    };

    await expect(createLatestAccessTokenGetter(auth)()).resolves.toBe('current');
    expect(auth.refreshSession).not.toHaveBeenCalled();
  });

  it('shares one refresh request between concurrent callers', async () => {
    let resolveRefresh: ((value: { data: { session: Session }; error: null }) => void) | undefined;
    const refreshed = session('refreshed', Math.floor(Date.now() / 1000) + 3600);
    const auth: SessionAuthApi = {
      getSession: jest.fn().mockResolvedValue({
        data: {
          session: session(
            'expired-soon',
            Math.floor(Date.now() / 1000) + TOKEN_REFRESH_SKEW_SECONDS - 1,
          ),
        },
        error: null,
      }),
      refreshSession: jest.fn(
        () =>
          new Promise((resolve) => {
            resolveRefresh = resolve;
          }),
      ),
    };
    const onSessionRefreshed = jest.fn();
    const getAccessToken = createLatestAccessTokenGetter(
      auth,
      onSessionRefreshed,
    );

    const first = getAccessToken();
    const second = getAccessToken();
    await Promise.resolve();
    await Promise.resolve();
    expect(auth.refreshSession).toHaveBeenCalledTimes(1);

    resolveRefresh?.({ data: { session: refreshed }, error: null });
    await expect(Promise.all([first, second])).resolves.toEqual([
      'refreshed',
      'refreshed',
    ]);
    expect(onSessionRefreshed).toHaveBeenCalledWith(refreshed);
  });

  it('returns null when no current session or refresh result exists', async () => {
    const auth: SessionAuthApi = {
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      refreshSession: jest.fn(),
    };

    await expect(createLatestAccessTokenGetter(auth)()).resolves.toBeNull();
  });
});

describe('clearPersistedAuthSession', () => {
  it('removes the session and its related auth artifacts', async () => {
    const storage = { removeItem: jest.fn().mockResolvedValue(undefined) };

    await clearPersistedAuthSession(storage);

    expect(storage.removeItem).toHaveBeenCalledTimes(3);
    expect(storage.removeItem).toHaveBeenCalledWith(SUPABASE_AUTH_STORAGE_KEY);
    expect(storage.removeItem).toHaveBeenCalledWith(
      `${SUPABASE_AUTH_STORAGE_KEY}-code-verifier`,
    );
    expect(storage.removeItem).toHaveBeenCalledWith(
      `${SUPABASE_AUTH_STORAGE_KEY}-user`,
    );
  });

  it('does not surface a storage removal failure', async () => {
    const storage = {
      removeItem: jest.fn().mockRejectedValue(new Error('storage unavailable')),
    };

    await expect(clearPersistedAuthSession(storage)).resolves.toBeUndefined();
  });
});

describe('parseOAuthCallback', () => {
  it('reads PKCE code and provider errors from query params', () => {
    expect(
      parseOAuthCallback(
        'meitra://auth/callback?code=auth-code&error_description=denied',
      ),
    ).toEqual({
      code: 'auth-code',
      accessToken: null,
      refreshToken: null,
      error: 'denied',
    });
  });

  it('reads implicit-flow tokens from URL fragments', () => {
    expect(
      parseOAuthCallback(
        'meitra://auth/callback#access_token=access&refresh_token=refresh',
      ),
    ).toEqual({
      code: null,
      accessToken: 'access',
      refreshToken: 'refresh',
      error: null,
    });
  });

  it('returns a clear error for malformed callback URLs', () => {
    expect(parseOAuthCallback('not a url')).toMatchObject({
      code: null,
      accessToken: null,
      refreshToken: null,
      error: '認証コールバックURLを読み取れませんでした',
    });
  });
});

describe('completeOAuthCallback', () => {
  const currentSession = session(
    'current',
    Math.floor(Date.now() / 1000) + 300,
  );

  const auth = (
    overrides: Partial<OAuthCallbackAuthApi> = {},
  ): OAuthCallbackAuthApi => ({
    exchangeCodeForSession: jest
      .fn()
      .mockResolvedValue({ data: { session: currentSession }, error: null }),
    setSession: jest
      .fn()
      .mockResolvedValue({ data: { session: currentSession }, error: null }),
    getSession: jest
      .fn()
      .mockResolvedValue({ data: { session: currentSession }, error: null }),
    ...overrides,
  });

  beforeEach(() => {
    resetOAuthCallbackCompletionStateForTests();
  });

  it('exchanges a PKCE code exactly once for concurrent callbacks', async () => {
    let resolveExchange:
      | ((value: { data: { session: Session }; error: null }) => void)
      | undefined;
    const authApi = auth({
      exchangeCodeForSession: jest.fn(
        () =>
          new Promise((resolve) => {
            resolveExchange = resolve;
          }),
      ),
    });
    const callbackUrl = 'meitra://auth/callback?code=auth-code';

    const first = completeOAuthCallback(callbackUrl, authApi);
    const second = completeOAuthCallback(callbackUrl, authApi);
    await Promise.resolve();
    expect(authApi.exchangeCodeForSession).toHaveBeenCalledTimes(1);

    resolveExchange?.({ data: { session: currentSession }, error: null });
    await expect(Promise.all([first, second])).resolves.toEqual([
      { error: null, session: currentSession, alreadyCompleted: false },
      { error: null, session: currentSession, alreadyCompleted: false },
    ]);
  });

  it('does not reuse a completed one-time code', async () => {
    const authApi = auth();
    const callbackUrl = 'meitra://auth/callback?code=auth-code';

    await expect(completeOAuthCallback(callbackUrl, authApi)).resolves.toEqual({
      error: null,
      session: currentSession,
      alreadyCompleted: false,
    });
    await expect(completeOAuthCallback(callbackUrl, authApi)).resolves.toEqual({
      error: null,
      session: currentSession,
      alreadyCompleted: true,
    });

    expect(authApi.exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(authApi.getSession).toHaveBeenCalledTimes(1);
  });

  it('treats replayed one-time code errors as completed when a session exists', async () => {
    const authApi = auth({
      exchangeCodeForSession: jest.fn().mockResolvedValue({
        data: { session: null },
        error: { message: 'invalid request: code already used' },
      }),
    });

    await expect(
      completeOAuthCallback('meitra://auth/callback?code=auth-code', authApi),
    ).resolves.toEqual({
      error: null,
      session: currentSession,
      alreadyCompleted: true,
    });
    expect(authApi.exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(authApi.getSession).toHaveBeenCalledTimes(1);
  });

  it('sets a session from access and refresh tokens', async () => {
    const authApi = auth();

    await expect(
      completeOAuthCallback(
        'meitra://auth/callback#access_token=access&refresh_token=refresh',
        authApi,
      ),
    ).resolves.toMatchObject({ error: null, session: currentSession });
    expect(authApi.setSession).toHaveBeenCalledWith({
      access_token: 'access',
      refresh_token: 'refresh',
    });
  });

  it('returns provider and missing-token errors without mutating auth state', async () => {
    const authApi = auth();

    await expect(
      completeOAuthCallback(
        'meitra://auth/callback?error_description=access_denied',
        authApi,
      ),
    ).resolves.toMatchObject({ error: 'access_denied' });
    await expect(
      completeOAuthCallback('meitra://auth/callback', authApi),
    ).resolves.toMatchObject({
      error: '認証情報を受け取れませんでした。もう一度ログインしてください。',
    });

    expect(authApi.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(authApi.setSession).not.toHaveBeenCalled();
  });
});
