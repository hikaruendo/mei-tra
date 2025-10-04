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
  const initializedRef = useRef(false);

  useEffect(() => {
    // Initialize auth immediately on mount
    const initializeAuth = async () => {
      console.log('[AuthContext] Initializing auth...');
      const { data: { session } } = await supabase.auth.getSession();

      setSession(session);

      if (session?.user) {
        await loadUserProfile(session.user);
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
        await loadUserProfile(session.user);
      } else if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
        setLoading(false);
        // Clear profile cache on sign out
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('auth_profile_cache');
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (supabaseUser: User, retryCount = 0) => {
    const maxRetries = 3;

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
            setLoading(false);

            // Refresh profile in background
            setTimeout(() => {
              console.log('[AuthContext] Refreshing profile in background');
              loadUserProfile(supabaseUser, -1); // -1 to skip cache check
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
      try {
        if (attempt > 0) {
          console.log(`[AuthContext] Retrying profile load (${attempt}/${maxRetries}) for user:`, supabaseUser.id);
          // 指数バックオフ: 1秒, 2秒, 4秒
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
        } else {
          console.log('[AuthContext] Loading profile for user:', supabaseUser.id);
        }

        // Create a timeout promise for preventing infinite loading
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

        // Handle timeout
        if (result === TIMEOUT) {
          if (attempt < maxRetries) {
            console.warn(`[AuthContext] Profile loading timeout (attempt ${attempt + 1}/${maxRetries + 1}). Retrying...`);
            return attemptLoad(attempt + 1);
          }
          
          console.warn('[AuthContext] Profile loading timeout after all retries. Keeping existing profile data.');
          setUser(prevUser => ({
            id: supabaseUser.id,
            email: supabaseUser.email,
            profile: prevUser?.profile || null,
          }));
          setLoading(false);
          return;
        }

        const { data: profile, error } = result as {
          data: DatabaseProfile | null;
          error: PostgrestError | null
        };

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

          // Keep existing profile data if available
          setUser(prevUser => ({
            id: supabaseUser.id,
            email: supabaseUser.email,
            profile: prevUser?.profile || null,
          }));
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

          // Cache the profile (browser only)
          if (typeof window !== 'undefined' && retryCount >= 0) {
            try {
              sessionStorage.setItem('auth_profile_cache', JSON.stringify({
                profile: userProfile,
                userId: supabaseUser.id,
                timestamp: Date.now(),
              }));
            } catch (e) {
              console.warn('[AuthContext] Failed to cache profile:', e);
            }
          }

          // Mark loading complete on success
          loadingUserRef.current = null;
          setLoading(false);
        } else {
          // No profile found, keep existing data if available
          console.log('[AuthContext] No profile data, keeping existing profile if available');
          setUser(prevUser => ({
            id: supabaseUser.id,
            email: supabaseUser.email,
            profile: prevUser?.profile || null,
          }));
          // Mark loading complete even when profile doesn't exist (normal for new users)
          loadingUserRef.current = null;
          setLoading(false);
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        // Network/connection errors should be retried
        if ((errorMessage.includes('network') || 
             errorMessage.includes('connection') || 
             errorMessage.includes('fetch')) && 
             attempt < maxRetries) {
          console.warn(`[AuthContext] Connection error loading profile (attempt ${attempt + 1}/${maxRetries + 1}). Retrying:`, errorMessage);
          return attemptLoad(attempt + 1);
        }

        console.warn('[AuthContext] Error in loadUserProfile, keeping existing data:', error);

        // Keep existing profile data if available, otherwise create basic user
        setUser(prevUser => ({
          id: supabaseUser.id,
          email: supabaseUser.email,
          profile: prevUser?.profile || null,
        }));
      } finally {
        if (attempt === maxRetries) {
          loadingUserRef.current = null;
          setLoading(false);
        }
      }
    };

    await attemptLoad(retryCount);
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