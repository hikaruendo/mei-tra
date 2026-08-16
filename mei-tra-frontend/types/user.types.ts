import type { FontSizePreset as ContractFontSizePreset } from '@contracts/profile';

export type FontSizePreset = ContractFontSizePreset;

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
  startPlayerAnimation: boolean;
}

export interface AuthUser {
  id: string;
  email?: string;
  profile: UserProfile | null;
}

export interface SignUpData {
  email: string;
  password: string;
  // Optional: when omitted, the DB trigger auto-generates a unique @handle (user_xxxx).
  username?: string;
  displayName: string;
  locale?: 'ja' | 'en';
}

export interface SignInData {
  email: string;
  password: string;
}
