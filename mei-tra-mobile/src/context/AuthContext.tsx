import type { Session, User } from '@supabase/supabase-js';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  AccountDeletionError,
  deleteAccountRequest,
} from '@/lib/account-api';
import {
  completeOAuthCallback,
  createLatestAccessTokenGetter,
} from '@/lib/auth-session';
import { subscribeAppLifecycle } from '@/lib/app-lifecycle';
import {
  clearLocalNotificationRegistration,
  unregisterPushToken,
} from '@/lib/notifications';
import { roomStorage } from '@/lib/room-storage';
import {
  cleanupAfterAccountDeletion,
  cleanupBeforeLocalSignOut,
} from '@/lib/session-cleanup';
import { clearLocalAuthSession, supabase } from '@/lib/supabase';
import type { MobileAuthUser, MobileUserProfile } from '@/types/auth';

WebBrowser.maybeCompleteAuthSession();

interface AuthResult {
  error: string | null;
  emailConfirmationRequired?: boolean;
}

interface AuthContextValue {
  user: MobileAuthUser | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<{ error: AccountDeletionError | null }>;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const mapProfile = (record: Record<string, unknown>): MobileUserProfile => ({
  displayName:
    typeof record.display_name === 'string' ? record.display_name : '',
  username: typeof record.username === 'string' ? record.username : '',
  avatarUrl:
    typeof record.avatar_url === 'string' ? record.avatar_url : undefined,
});

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<MobileAuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const profileRequestRef = useRef(0);

  const loadProfile = useCallback(async (authUser: User) => {
    const requestId = ++profileRequestRef.current;
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('display_name, username, avatar_url')
        .eq('id', authUser.id)
        .maybeSingle();

      if (error) {
        console.warn('[Auth] Failed to load profile:', error.message);
      }

      if (!mountedRef.current || requestId !== profileRequestRef.current) {
        return;
      }

      setUser({
        id: authUser.id,
        email: authUser.email,
        profile: data ? mapProfile(data) : null,
      });
    } catch (error) {
      if (mountedRef.current && requestId === profileRequestRef.current) {
        console.warn('[Auth] Failed to load profile:', error);
      }
    }
  }, []);

  const getAccessToken = useMemo(
    () =>
      createLatestAccessTokenGetter(supabase.auth, (nextSession) => {
        if (mountedRef.current) setSession(nextSession);
      }),
    [],
  );

  useEffect(() => {
    let active = true;
    mountedRef.current = true;

    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.warn('[Auth] Failed to restore session:', error.message);
        }

        setSession(data.session);
        if (data.session?.user) {
          setUser({
            id: data.session.user.id,
            email: data.session.user.email,
            profile: null,
          });
          void loadProfile(data.session.user);
        } else {
          setUser(null);
        }
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.warn('[Auth] Failed to restore session:', error);
        setSession(null);
        setUser(null);
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);

      if (nextSession?.user) {
        setUser((current) => ({
          id: nextSession.user.id,
          email: nextSession.user.email,
          profile:
            current?.id === nextSession.user.id ? current.profile : null,
        }));
        void loadProfile(nextSession.user);
      } else {
        profileRequestRef.current += 1;
        setUser(null);
      }

      setLoading(false);
    });

    return () => {
      active = false;
      mountedRef.current = false;
      profileRequestRef.current += 1;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  useEffect(
    () =>
      subscribeAppLifecycle((snapshot, previous) => {
        const becameAvailable =
          snapshot.appState === 'active' &&
          snapshot.isOnline &&
          (previous.appState !== 'active' || !previous.isOnline);
        if (becameAvailable) void getAccessToken();
      }),
    [getAccessToken],
  );

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    return { error: error?.message ?? null };
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, displayName: string) => {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            display_name: displayName.trim(),
            locale: 'ja',
          },
        },
      });

      return {
        error: error?.message ?? null,
        emailConfirmationRequired: Boolean(data.user && !data.session),
      };
    },
    [],
  );

  const signInWithGoogle = useCallback(async () => {
    const redirectTo = makeRedirectUri({
      scheme: 'meitra',
      path: 'auth/callback',
    });
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        scopes: 'openid email profile',
      },
    });

    if (error || !data.url) {
      return { error: error?.message ?? 'Googleログインを開始できませんでした' };
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success') {
      return {
        error: result.type === 'cancel' ? null : 'Googleログインを完了できませんでした',
      };
    }

    const callback = await completeOAuthCallback(result.url, supabase.auth);
    return { error: callback.error };
  }, []);

  const signOut = useCallback(async () => {
    try {
      await cleanupBeforeLocalSignOut({
        getAccessToken,
        unregisterPushToken,
        clearRoom: roomStorage.clear,
        signOut: () => supabase.auth.signOut({ scope: 'local' }).then(() => undefined),
      });
    } finally {
      profileRequestRef.current += 1;
      setSession(null);
      setUser(null);
    }
  }, [getAccessToken]);

  const deleteAccount = useCallback(async () => {
    if (!user) {
      return {
        error: new AccountDeletionError(
          'unauthorized',
          'ログインセッションが切れています。もう一度ログインしてください。',
          401,
        ),
      };
    }

    try {
      await deleteAccountRequest(user.id, await getAccessToken());
      await cleanupAfterAccountDeletion({
        clearLocalNotificationRegistration,
        clearRoom: roomStorage.clear,
        clearLocalSession: clearLocalAuthSession,
      });
      profileRequestRef.current += 1;
      setSession(null);
      setUser(null);
      return { error: null };
    } catch (error) {
      if (error instanceof AccountDeletionError) return { error };
      return {
        error: new AccountDeletionError(
          'server',
          'アカウントを削除できませんでした。時間をおいて再試行してください。',
        ),
      };
    }
  }, [getAccessToken, user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      loading,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      deleteAccount,
      getAccessToken,
    }),
    [
      getAccessToken,
      loading,
      session,
      signIn,
      signInWithGoogle,
      signOut,
      signUp,
      user,
      deleteAccount,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return value;
}
