export type FontSizePreset = 'standard' | 'large' | 'xlarge' | 'xxlarge';

export type HandSortDirection = 'strong-right' | 'strong-left';

export type CardDesign = 'standard' | 'densho';

export type TransportTheme = 'light' | 'dark';

export interface TransportUserPreferences {
  notifications: boolean;
  sound: boolean;
  theme: TransportTheme;
  fontSize: FontSizePreset;
  /** Optional: profiles created before the setting existed omit it. */
  startPlayerAnimation?: boolean;
  /** Omitted by older profiles; clients render the standard design. */
  cardDesign?: CardDesign;
  /** Rank order within each suit; omitted profiles keep stronger ranks on the right. */
  handSortDirection?: HandSortDirection;
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
