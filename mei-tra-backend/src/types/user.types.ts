export interface UserProfile {
  id: string; // Supabase auth user ID
  username: string;
  displayName: string;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  lastSeenAt: Date;

  // Game statistics
  gamesPlayed: number;
  gamesWon: number;
  totalScore: number;

  // User preferences
  preferences: UserPreferences;
}

export interface UserPreferences {
  notifications: boolean;
  sound: boolean;
  theme: 'light' | 'dark';
}

export interface CreateUserProfileDto {
  username: string;
  displayName: string;
  avatarUrl?: string;
  preferences?: Partial<UserPreferences>;
}

export interface UpdateUserProfileDto {
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  preferences?: Partial<UserPreferences>;
}

export interface AuthenticatedUser {
  id: string; // Supabase auth user ID
  email?: string;
  profile: UserProfile;
}

// Database row type for user_profiles table
export interface UserProfileRow {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
  last_seen_at: string;
  games_played: number;
  games_won: number;
  total_score: number;
  preferences: UserPreferences;
}
