import type {
  TransportTheme,
  TransportUserPreferences,
  UpdateUserProfileRequestDto,
  UserProfileDto,
} from '@contracts/profile';
import {
  createProfileApiClient,
  isRetryableProfileError,
  ProfileApiError,
} from '@meitra/api-client/profile';
import { UserPreferences, UserProfile } from '@/types/user.types';
import { normalizeUserPreferences } from '@/lib/preferences';

export interface UpdateUserProfilePayload {
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  preferences?: Partial<UserPreferences>;
}

export type UserProfileApiResponse = UserProfileDto;

export { ProfileApiError as UserProfileApiError };
export const isRetryableUserProfileError = isRetryableProfileError;

const profileApi = createProfileApiClient({ baseUrl: '/api/user-profile' });

function resolveTransportTheme(
  theme: UserPreferences['theme'] | undefined,
): TransportTheme | undefined {
  if (theme === 'light' || theme === 'dark') {
    return theme;
  }

  if (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark';
  }

  return theme === 'system' ? 'light' : undefined;
}

function mapPreferencesForTransport(
  preferences: Partial<UserPreferences> | undefined,
): Partial<TransportUserPreferences> | undefined {
  if (!preferences) {
    return undefined;
  }

  const mapped: Partial<TransportUserPreferences> = {
    notifications: preferences.notifications,
    sound: preferences.sound,
    fontSize: preferences.fontSize,
    startPlayerAnimation: preferences.startPlayerAnimation,
  };

  const theme = resolveTransportTheme(preferences.theme);
  if (theme) {
    mapped.theme = theme;
  }

  return mapped;
}

export function mapUserProfileResponse(
  profile: UserProfileApiResponse,
): UserProfile {
  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    createdAt: new Date(profile.createdAt),
    updatedAt: new Date(profile.updatedAt),
    lastSeenAt: new Date(profile.lastSeenAt),
    gamesPlayed: profile.gamesPlayed,
    gamesWon: profile.gamesWon,
    totalScore: profile.totalScore,
    preferences: normalizeUserPreferences(profile.preferences),
  };
}

export async function fetchUserProfileViaApi(
  userId: string,
  signal?: AbortSignal,
): Promise<UserProfile> {
  return mapUserProfileResponse(
    await profileApi.fetchProfile(userId, { signal }),
  );
}

export async function updateUserProfileViaApi(
  userId: string,
  accessToken: string,
  payload: UpdateUserProfilePayload,
): Promise<UserProfile> {
  const transportPayload: UpdateUserProfileRequestDto = {
    username: payload.username,
    displayName: payload.displayName,
    avatarUrl: payload.avatarUrl,
    preferences: mapPreferencesForTransport(payload.preferences),
  };

  const result = await profileApi.updateProfile(
    userId,
    accessToken,
    transportPayload,
  );
  return mapUserProfileResponse(result);
}
