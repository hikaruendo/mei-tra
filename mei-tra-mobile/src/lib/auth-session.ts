import type { Session } from '@supabase/supabase-js';
import { t } from '@/i18n';

export const TOKEN_REFRESH_SKEW_SECONDS = 60;
export const SUPABASE_AUTH_STORAGE_KEY = 'supabase.auth.token';
const MAX_COMPLETED_OAUTH_CALLBACKS = 32;

export interface AuthSessionStorage {
  removeItem: (key: string) => Promise<void>;
}

export const clearPersistedAuthSession = async (
  storage: AuthSessionStorage,
  storageKey = SUPABASE_AUTH_STORAGE_KEY,
): Promise<void> => {
  await Promise.all(
    [storageKey, `${storageKey}-code-verifier`, `${storageKey}-user`].map(
      async (key) => {
        await storage.removeItem(key).catch(() => undefined);
      },
    ),
  );
};

interface SessionResponse {
  data: { session: Session | null };
  error: unknown | null;
}

export interface SessionAuthApi {
  getSession: () => Promise<SessionResponse>;
  refreshSession: () => Promise<SessionResponse>;
}

interface OAuthAuthResponse {
  data: { session: Session | null };
  error: { message?: string } | null;
}

export interface OAuthCallbackAuthApi {
  exchangeCodeForSession: (code: string) => Promise<OAuthAuthResponse>;
  setSession: (session: {
    access_token: string;
    refresh_token: string;
  }) => Promise<OAuthAuthResponse>;
  getSession: () => Promise<SessionResponse>;
}

export interface OAuthCallbackPayload {
  code: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  error: string | null;
}

export interface OAuthCallbackCompletionResult {
  error: string | null;
  session: Session | null;
  alreadyCompleted: boolean;
}

const inflightOAuthCallbacks = new Map<
  string,
  Promise<OAuthCallbackCompletionResult>
>();
const completedOAuthCallbacks = new Set<string>();

const firstParam = (
  query: URLSearchParams,
  fragment: URLSearchParams,
  key: string,
): string | null => query.get(key) ?? fragment.get(key);

export const parseOAuthCallback = (url: string): OAuthCallbackPayload => {
  try {
    const parsed = new URL(url);
    const fragment = new URLSearchParams(parsed.hash.replace(/^#/, ''));

    return {
      code: firstParam(parsed.searchParams, fragment, 'code'),
      accessToken: firstParam(parsed.searchParams, fragment, 'access_token'),
      refreshToken: firstParam(parsed.searchParams, fragment, 'refresh_token'),
      error:
        firstParam(parsed.searchParams, fragment, 'error_description') ??
        firstParam(parsed.searchParams, fragment, 'error'),
    };
  } catch {
    return {
      code: null,
      accessToken: null,
      refreshToken: null,
      error: t('auth.callbackUrlUnreadable'),
    };
  }
};

const getOAuthCallbackKey = ({
  code,
  accessToken,
  refreshToken,
}: OAuthCallbackPayload): string | null => {
  if (code) return `code:${code}`;
  if (accessToken && refreshToken) return `tokens:${accessToken}:${refreshToken}`;
  return null;
};

const rememberCompletedOAuthCallback = (key: string): void => {
  completedOAuthCallbacks.add(key);

  if (completedOAuthCallbacks.size <= MAX_COMPLETED_OAUTH_CALLBACKS) return;

  const oldestKey = completedOAuthCallbacks.values().next().value;
  if (oldestKey) completedOAuthCallbacks.delete(oldestKey);
};

const getCurrentSession = async (
  auth: OAuthCallbackAuthApi,
): Promise<Session | null> => {
  try {
    const { data, error } = await auth.getSession();
    if (error) return null;
    return data.session;
  } catch {
    return null;
  }
};

export const completeOAuthCallback = async (
  url: string,
  auth: OAuthCallbackAuthApi,
): Promise<OAuthCallbackCompletionResult> => {
  const callback = parseOAuthCallback(url);
  if (callback.error) {
    return {
      error: callback.error,
      session: await getCurrentSession(auth),
      alreadyCompleted: false,
    };
  }

  const key = getOAuthCallbackKey(callback);
  if (!key) {
    return {
      error: t('auth.credentialsMissing'),
      session: await getCurrentSession(auth),
      alreadyCompleted: false,
    };
  }

  if (completedOAuthCallbacks.has(key)) {
    return {
      error: null,
      session: await getCurrentSession(auth),
      alreadyCompleted: true,
    };
  }

  const inflight = inflightOAuthCallbacks.get(key);
  if (inflight) return inflight;

  const completion = (async () => {
    const { data, error } = callback.code
      ? await auth.exchangeCodeForSession(callback.code)
      : await auth.setSession({
          access_token: callback.accessToken ?? '',
          refresh_token: callback.refreshToken ?? '',
        });

    if (error) {
      const currentSession = await getCurrentSession(auth);
      if (currentSession) {
        rememberCompletedOAuthCallback(key);
        return {
          error: null,
          session: currentSession,
          alreadyCompleted: true,
        };
      }

      return {
        error: error.message ?? t('auth.googleFailed'),
        session: null,
        alreadyCompleted: false,
      };
    }

    rememberCompletedOAuthCallback(key);
    return {
      error: null,
      session: data.session ?? (await getCurrentSession(auth)),
      alreadyCompleted: false,
    };
  })().finally(() => {
    inflightOAuthCallbacks.delete(key);
  });

  inflightOAuthCallbacks.set(key, completion);
  return completion;
};

export const resetOAuthCallbackCompletionStateForTests = (): void => {
  inflightOAuthCallbacks.clear();
  completedOAuthCallbacks.clear();
};

export const createLatestAccessTokenGetter = (
  auth: SessionAuthApi,
  onSessionRefreshed?: (session: Session) => void,
) => {
  let refreshPromise: Promise<Session | null> | null = null;

  const refresh = async (): Promise<Session | null> => {
    if (!refreshPromise) {
      refreshPromise = auth
        .refreshSession()
        .then(({ data, error }) => {
          if (error || !data.session) return null;
          onSessionRefreshed?.(data.session);
          return data.session;
        })
        .catch(() => null)
        .finally(() => {
          refreshPromise = null;
        });
    }

    return refreshPromise;
  };

  return async (): Promise<string | null> => {
    const { data, error } = await auth.getSession();
    if (error || !data.session) return null;

    const expiresAt = data.session.expires_at;
    const now = Math.floor(Date.now() / 1000);
    if (
      !expiresAt ||
      expiresAt - TOKEN_REFRESH_SKEW_SECONDS > now
    ) {
      return data.session.access_token;
    }

    const refreshedSession = await refresh();
    return refreshedSession?.access_token ?? null;
  };
};
