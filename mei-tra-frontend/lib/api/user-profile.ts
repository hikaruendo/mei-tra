import type {
  TransportTheme,
  TransportUserPreferences,
  UpdateUserProfileRequestDto,
  UserProfileDto,
} from '@contracts/profile';
import {
  createProfileApiClient,
} from '@meitra/api-client/profile';
import {
  fromRecentGameHistoryItemContract,
  RecentGameHistoryItem,
} from '@/types/game-history.types';
import { UserPreferences, UserProfile } from '@/types/user.types';
import { normalizeUserPreferences } from '@/lib/preferences';

interface UpdateUserProfilePayload {
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  preferences?: Partial<UserPreferences>;
}

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

function mapUserProfileResponse(profile: UserProfileDto): UserProfile {
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

export async function fetchProfileGameHistory(
  userId: string,
  accessToken: string,
): Promise<RecentGameHistoryItem[]> {
  const items = await profileApi.fetchGameHistory(userId, accessToken);
  return items.map(fromRecentGameHistoryItemContract);
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

export async function uploadUserAvatarViaApi(
  userId: string,
  accessToken: string,
  formData: FormData,
): Promise<string> {
  const result = await profileApi.uploadAvatar(
    userId,
    accessToken,
    formData,
  );
  return result.avatarUrl;
}
