export type FontSizePreset = 'standard' | 'large' | 'xlarge' | 'xxlarge';

export type TransportTheme = 'light' | 'dark';

export interface TransportUserPreferences {
  notifications: boolean;
  sound: boolean;
  theme: TransportTheme;
  fontSize: FontSizePreset;
}

export interface UserProfileDto {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string;
  gamesPlayed: number;
  gamesWon: number;
  totalScore: number;
  preferences: TransportUserPreferences;
}

export interface UpdateUserProfileRequestDto {
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  preferences?: Partial<TransportUserPreferences>;
}

export interface AvatarUploadResponseDto {
  message: string;
  avatarUrl: string;
  profile: UserProfileDto;
}
