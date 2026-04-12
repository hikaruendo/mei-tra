export type FontSizePreset = 'standard' | 'large' | 'xlarge' | 'xxlarge';

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  lastSeenAt: Date;
  gamesPlayed: number;
  gamesWon: number;
  totalScore: number;
  preferences: UserPreferences;
}

export interface UserPreferences {
  notifications: boolean;
  sound: boolean;
  theme: 'system' | 'light' | 'dark';
  fontSize: FontSizePreset;
}

export interface AuthUser {
  id: string;
  email?: string;
  profile: UserProfile | null;
}

export interface SignUpData {
  email: string;
  password: string;
  username: string;
  displayName: string;
  locale?: 'ja' | 'en';
}

export interface SignInData {
  email: string;
  password: string;
}
