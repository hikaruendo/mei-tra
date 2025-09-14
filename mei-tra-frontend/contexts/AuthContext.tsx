'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, Session, AuthError, PostgrestError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { AuthUser, SignUpData, SignInData, UserProfile } from '@/types/user.types';

// Database profile interface matching user_profiles table structure
interface DatabaseProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  last_seen_at: string;
  games_played: number;
  games_won: number;
  total_score: number;
  preferences: {
    notifications: boolean;
    sound: boolean;
    theme: 'light' | 'dark';
  };
}

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  signUp: (data: SignUpData) => Promise<{ user: User | null; error: AuthError | null }>;
  signIn: (data: SignInData) => Promise<{ user: User | null; error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
  getAccessToken: () => Promise<string | null>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const loadingUserRef = useRef<string | null>(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        loadUserProfile(session.user);
      } else {
        setLoading(false);
      }
    }).catch((error) => {
      console.error('[AuthContext] Error getting initial session:', error);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);

      if (event === 'SIGNED_IN' && session?.user) {
        await loadUserProfile(session.user);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setLoading(false);
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        await loadUserProfile(session.user);
      } else if (event === 'INITIAL_SESSION') {
        if (!session) {
          setLoading(false);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (supabaseUser: User) => {
    // Prevent duplicate loading for the same user
    if (loadingUserRef.current === supabaseUser.id) {
      console.log('[AuthContext] Already loading profile for user:', supabaseUser.id);
      return;
    }

    loadingUserRef.current = supabaseUser.id;

    try {
      console.log('[AuthContext] Loading profile for user:', supabaseUser.id);

      // Create a timeout promise for preventing infinite loading (warn-only)
      const TIMEOUT = 'timeout' as const;
      const timeoutPromise = new Promise<typeof TIMEOUT>((resolve) => {
        setTimeout(() => resolve(TIMEOUT), 10000);
      });

      const profilePromise = supabase
        .from('user_profiles')
        .select('*')
        .eq('id', supabaseUser.id)
        .single();

      const result = await Promise.race([
        profilePromise,
        timeoutPromise
      ]);

      // Handle timeout without throwing to avoid dev overlay errors
      if (result === TIMEOUT) {
        console.warn('[AuthContext] User profile loading timeout. Falling back to basic user.');
        setUser({
          id: supabaseUser.id,
          email: supabaseUser.email,
          profile: null,
        });
        setLoading(false);
        return;
      }

      const { data: profile, error } = result as {
        data: DatabaseProfile | null;
        error: PostgrestError | null
      };

      if (error) {
        if (error.code === 'PGRST116') {
          // No profile found - this is expected for new users
          console.log('[AuthContext] No profile found, creating basic user');
        } else {
          console.error('[AuthContext] Error loading user profile:', error);
        }

        // Create a basic user without profile
        setUser({
          id: supabaseUser.id,
          email: supabaseUser.email,
          profile: null,
        });
        setLoading(false);
        return;
      }

      if (profile) {
        console.log('[AuthContext] Profile loaded successfully:', profile);

        // Create default preferences if not exist
        const defaultPreferences = {
          notifications: true,
          sound: true,
          theme: 'light' as const
        };

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
          preferences: profile.preferences || defaultPreferences,
        };

        setUser({
          id: supabaseUser.id,
          email: supabaseUser.email,
          profile: userProfile,
        });
      } else {
        // No profile found, create basic user
        console.log('[AuthContext] No profile data, creating basic user');
        setUser({
          id: supabaseUser.id,
          email: supabaseUser.email,
          profile: null,
        });
      }
    } catch (error) {
      console.error('[AuthContext] Error in loadUserProfile:', error);

      // Always create a basic user even if profile loading fails
      setUser({
        id: supabaseUser.id,
        email: supabaseUser.email,
        profile: null,
      });
    } finally {
      loadingUserRef.current = null;
      setLoading(false);
    }
  };

  const signUp = async (data: SignUpData) => {
    try {
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            username: data.username,
            display_name: data.displayName,
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
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    if (!session) return null;

    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) return null;

    return data.session.access_token;
  }, [session]);

  const refreshSession = useCallback(async () => {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      console.error('Error refreshing session:', error);
    } else if (data.session) {
      setSession(data.session);
    }
  }, []);

  const value: AuthContextType = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    getAccessToken,
    refreshSession,
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