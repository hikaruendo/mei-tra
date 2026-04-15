'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { disconnectSocket } from '@/app/socket';
import { AuthUser, FontSizePreset, SignUpData, SignInData, UserProfile, UserPreferences } from '@/types/user.types';
import { updateUserProfileViaApi } from '@/lib/api/user-profile';
import {
  DEFAULT_FONT_SIZE_PRESET,
  DEFAULT_THEME_PREFERENCE,
  FONT_SIZE_STORAGE_KEY,
  THEME_STORAGE_KEY,
  normalizeUserPreferences,
  readStoredFontSizePreset,
  readStoredThemePreference,
} from '@/lib/preferences';

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  themePreference: UserPreferences['theme'];
  fontSizePreference: FontSizePreset;
  signUp: (data: SignUpData) => Promise<{ user: User | null; error: AuthError | null }>;
  signIn: (data: SignInData) => Promise<{ user: User | null; error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
  getAccessToken: () => Promise<string | null>;
  refreshSession: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
  setThemePreference: (theme: UserPreferences['theme']) => Promise<void>;
  setFontSizePreference: (fontSize: FontSizePreset) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [themePreference, setThemePreferenceState] = useState<UserPreferences['theme']>(DEFAULT_THEME_PREFERENCE);
  const [fontSizePreference, setFontSizePreferenceState] = useState<FontSizePreset>(DEFAULT_FONT_SIZE_PRESET);
  const loadingUserRef = useRef<string | null>(null);
  const initializedRef = useRef(false);

  const resolveTheme = useCallback((theme: UserPreferences['theme']) => {
    if (typeof window === 'undefined') return 'dark';

    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    return theme;
  }, []);

  const applyTheme = useCallback((theme: UserPreferences['theme']) => {
    if (typeof window === 'undefined') return;

    document.documentElement.setAttribute('data-theme', resolveTheme(theme));
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [resolveTheme]);

  const applyFontSize = useCallback((fontSize: FontSizePreset) => {
    if (typeof window === 'undefined') return;

    document.documentElement.setAttribute('data-font-size', fontSize);
    localStorage.setItem(FONT_SIZE_STORAGE_KEY, fontSize);
  }, []);

  const cacheUserProfile = useCallback((userId: string, profile: UserProfile) => {
    if (typeof window === 'undefined') return;

    try {
      sessionStorage.setItem('auth_profile_cache', JSON.stringify({
        profile,
        userId,
        timestamp: Date.now(),
      }));
    } catch (error) {
      console.warn('[AuthContext] Failed to cache profile:', error);
    }
  }, []);

  const clearClientAuthState = useCallback(() => {
    disconnectSocket();
    setSession(null);
    setUser(null);
    setLoading(false);

    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('auth_profile_cache');
      sessionStorage.removeItem('roomId');
    }
  }, []);

  const loadUserProfile = useCallback(async (supabaseUser: User, retryCount = 0) => {
    const maxRetries = 2;
    const PROFILE_TIMEOUT = 5000;

    // Prevent duplicate loading for the same user
    if (loadingUserRef.current === supabaseUser.id) {
      console.log('[AuthContext] Already loading profile for user:', supabaseUser.id);
      return;
    }

    loadingUserRef.current = supabaseUser.id;

    // Check cache first (browser only)
    if (typeof window !== 'undefined' && retryCount === 0) {
      const cacheKey = 'auth_profile_cache';
      const cached = sessionStorage.getItem(cacheKey);

      if (cached) {
        try {
          const { profile, userId, timestamp } = JSON.parse(cached);
          const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

          // Use cache if it's for the same user and not expired
          if (userId === supabaseUser.id && Date.now() - timestamp < CACHE_DURATION) {
            console.log('[AuthContext] Using cached profile');
            setUser({
              id: supabaseUser.id,
              email: supabaseUser.email,
              profile,
            });

            // Refresh profile in background (skip cache with retryCount = -1)
            loadingUserRef.current = null;
            setTimeout(() => {
              console.log('[AuthContext] Refreshing profile in background');
              loadUserProfileRef.current(supabaseUser, -1);
            }, 0);

            return;
          }
        } catch (e) {
          console.warn('[AuthContext] Failed to parse cached profile:', e);
          sessionStorage.removeItem(cacheKey);
        }
      }
    }

    const attemptLoad = async (attempt: number): Promise<void> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), PROFILE_TIMEOUT);

      try {
        if (attempt > 0) {
          console.log(`[AuthContext] Retrying profile load (${attempt}/${maxRetries}) for user:`, supabaseUser.id);
          // 指数バックオフ: 1秒, 2秒
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
        } else {
          console.log('[AuthContext] Loading profile for user:', supabaseUser.id);
        }

        const { data: profile, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', supabaseUser.id)
          .abortSignal(controller.signal)
          .single();

        clearTimeout(timeoutId);

        if (error) {
          // Network/connection errors should be retried
          if ((error.message.includes('network') ||
               error.message.includes('connection') ||
               error.message.includes('timeout')) &&
               attempt < maxRetries) {
            console.warn(`[AuthContext] Network error loading profile (attempt ${attempt + 1}/${maxRetries + 1}). Retrying:`, error.message);
            return attemptLoad(attempt + 1);
          }

          if (error.code === 'PGRST116') {
            // No profile found - this is expected for new users
            console.log('[AuthContext] No profile found, creating basic user');
          } else {
            console.warn('[AuthContext] Error loading user profile, keeping existing data:', error.message);
          }

          loadingUserRef.current = null;
          return;
        }

        if (profile) {
          console.log('[AuthContext] Profile loaded successfully');

          const preferences = normalizeUserPreferences(profile.preferences);

          const userProfile: UserProfile = {
            id: profile.id,
            username: profile.username,
            displayName: profile.display_name,
            avatarUrl: profile.avatar_url || undefined,
            createdAt: new Date(profile.created_at),
            updatedAt: new Date(profile.updated_at),
            lastSeenAt: new Date(profile.last_seen_at),
            gamesPlayed: profile.games_played || 0,
            gamesWon: profile.games_won || 0,
            totalScore: profile.total_score || 0,
            preferences,
          };

          setUser({
            id: supabaseUser.id,
            email: supabaseUser.email,
            profile: userProfile,
          });

          // Cache the profile (browser only)
          if (typeof window !== 'undefined' && retryCount >= 0) {
            cacheUserProfile(supabaseUser.id, userProfile);
          }
        } else {
          console.log('[AuthContext] No profile data returned');
        }

        loadingUserRef.current = null;
      } catch (error: unknown) {
        clearTimeout(timeoutId);

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const isAbort = error instanceof DOMException && error.name === 'AbortError';

        if (isAbort) {
          if (attempt < maxRetries) {
            console.warn(`[AuthContext] Profile loading timeout (attempt ${attempt + 1}/${maxRetries + 1}). Retrying...`);
            return attemptLoad(attempt + 1);
          }
          console.warn('[AuthContext] Profile loading timeout after all retries.');
          loadingUserRef.current = null;
          return;
        }

        // Network/connection errors should be retried
        if ((errorMessage.includes('network') ||
             errorMessage.includes('connection') ||
             errorMessage.includes('fetch')) &&
             attempt < maxRetries) {
          console.warn(`[AuthContext] Connection error loading profile (attempt ${attempt + 1}/${maxRetries + 1}). Retrying:`, errorMessage);
          return attemptLoad(attempt + 1);
        }

        console.warn('[AuthContext] Error in loadUserProfile:', error);
        loadingUserRef.current = null;
      }
    };

    await attemptLoad(retryCount);
  }, [cacheUserProfile]);

  // Ref to allow recursive calls from setTimeout without stale closures
  const loadUserProfileRef = useRef(loadUserProfile);
  loadUserProfileRef.current = loadUserProfile;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedTheme = readStoredThemePreference();
    const storedFontSize = readStoredFontSizePreset();

    setThemePreferenceState(storedTheme);
    setFontSizePreferenceState(storedFontSize);
    applyTheme(storedTheme);
    applyFontSize(storedFontSize);
  }, [applyFontSize, applyTheme]);

  useEffect(() => {
    const preferences = user?.profile?.preferences;

    if (preferences) {
      const normalizedPreferences = normalizeUserPreferences(preferences);
      setThemePreferenceState(normalizedPreferences.theme);
      setFontSizePreferenceState(normalizedPreferences.fontSize);
      applyTheme(normalizedPreferences.theme);
      applyFontSize(normalizedPreferences.fontSize);
      return;
    }

    if (!user) {
      const storedTheme = readStoredThemePreference();
      const storedFontSize = readStoredFontSizePreset();
      setThemePreferenceState(storedTheme);
      setFontSizePreferenceState(storedFontSize);
      applyTheme(storedTheme);
      applyFontSize(storedFontSize);
    }
  }, [applyFontSize, applyTheme, user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (themePreference !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => applyTheme('system');

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [applyTheme, themePreference]);

  useEffect(() => {
    // Initialize auth immediately on mount
    const initializeAuth = async () => {
      console.log('[AuthContext] Initializing auth...');
      const { data: { session } } = await supabase.auth.getSession();

      setSession(session);

      if (session?.user) {
        // Set basic user info immediately so UI can render
        setUser({
          id: session.user.id,
          email: session.user.email,
          profile: null,
        });
        setLoading(false);

        // Load profile in background (don't await)
        loadUserProfile(session.user);
      } else {
        setLoading(false);
      }

      initializedRef.current = true;
    };

    initializeAuth();

    // Listen for auth changes (skip INITIAL_SESSION as we handled it above)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Skip INITIAL_SESSION event as we already initialized
      if (event === 'INITIAL_SESSION') {
        return;
      }

      console.log('[AuthContext] Auth state changed:', event);
      setSession(session);

      if (session?.user && ['SIGNED_IN', 'TOKEN_REFRESHED'].includes(event)) {
        // Preserve existing profile if available, set loading false immediately
        setUser(prev => ({
          id: session.user.id,
          email: session.user.email,
          profile: prev?.profile || null,
        }));
        setLoading(false);

        // Load profile in background (don't await)
        loadUserProfile(session.user);
      } else if (event === 'SIGNED_OUT' || !session) {
        clearClientAuthState();
      }
    });

    return () => subscription.unsubscribe();
  }, [clearClientAuthState, loadUserProfile]);

  const signUp = async (data: SignUpData) => {
    try {
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            username: data.username,
            display_name: data.displayName,
            locale: data.locale || 'ja',
          },
        },
      });

      return { user: authData.user, error };
    } catch (error) {
      return { user: null, error: error as AuthError };
    }
  };

  const signIn = async (data: SignInData) => {
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      return { user: authData.user, error };
    } catch (error) {
      return { user: null, error: error as AuthError };
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut({ scope: 'local' });

    if (error) {
      clearClientAuthState();
      return { error: null };
    }

    clearClientAuthState();
    return { error: null };
  };

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    // Always fetch the latest session directly from Supabase
    // Don't rely on React state which may be stale during registration
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) return null;

    return data.session.access_token;
  }, []); // No dependencies - always get fresh session

  const refreshSession = useCallback(async () => {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      console.error('Error refreshing session:', error);
    } else if (data.session) {
      setSession(data.session);
    }
  }, []);

  const refreshUserProfile = useCallback(async () => {
    if (!session?.user) {
      console.warn('[AuthContext] No session available for profile refresh');
      return;
    }

    console.log('[AuthContext] Refreshing user profile...');

    // Clear cache to force fresh data
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('auth_profile_cache');
    }

    // Load fresh profile, skipping cache (retryCount = -1)
    await loadUserProfile(session.user, -1);
  }, [session, loadUserProfile]);

  const updateLocalUserPreferences = useCallback((partial: Partial<UserPreferences>) => {
    setUser((prev) => {
      if (!prev?.profile) return prev;

      const updatedProfile = {
        ...prev.profile,
        preferences: normalizeUserPreferences({
          ...prev.profile.preferences,
          ...partial,
        }),
      };

      cacheUserProfile(prev.id, updatedProfile);

      return {
        ...prev,
        profile: updatedProfile,
      };
    });
  }, [cacheUserProfile]);

  const persistUserPreferences = useCallback(async (partial: Partial<UserPreferences>) => {
    if (!user?.id) return;

    const accessToken = await getAccessToken();
    if (!accessToken) return;

    const nextPreferences = normalizeUserPreferences({
      ...user.profile?.preferences,
      theme: partial.theme ?? themePreference,
      fontSize: partial.fontSize ?? fontSizePreference,
      notifications: partial.notifications ?? user.profile?.preferences?.notifications,
      sound: partial.sound ?? user.profile?.preferences?.sound,
    });

    try {
      await updateUserProfileViaApi(user.id, accessToken, {
        preferences: nextPreferences,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.warn('[AuthContext] Failed to persist user preferences:', message);
    }
  }, [fontSizePreference, getAccessToken, themePreference, user]);

  const setThemePreference = useCallback(async (theme: UserPreferences['theme']) => {
    applyTheme(theme);
    setThemePreferenceState(theme);
    updateLocalUserPreferences({ theme });
    await persistUserPreferences({ theme });
  }, [applyTheme, persistUserPreferences, updateLocalUserPreferences]);

  const setFontSizePreference = useCallback(async (fontSize: FontSizePreset) => {
    applyFontSize(fontSize);
    setFontSizePreferenceState(fontSize);
    updateLocalUserPreferences({ fontSize });
    await persistUserPreferences({ fontSize });
  }, [applyFontSize, persistUserPreferences, updateLocalUserPreferences]);

  const value: AuthContextType = {
    user,
    session,
    loading,
    themePreference,
    fontSizePreference,
    signUp,
    signIn,
    signOut,
    getAccessToken,
    refreshSession,
    refreshUserProfile,
    setThemePreference,
    setFontSizePreference,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
