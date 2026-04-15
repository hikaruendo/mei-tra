import type {
  TransportTheme,
  TransportUserPreferences,
  UpdateUserProfileRequestDto,
  UserProfileDto,
} from '@contracts/profile';
import { UserPreferences, UserProfile } from '@/types/user.types';

export interface UpdateUserProfilePayload {
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  preferences?: Partial<UserPreferences>;
}

export type UserProfileApiResponse = UserProfileDto;

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
    preferences: profile.preferences,
  };
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

  const response = await fetch(`/api/user-profile/${userId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(transportPayload),
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => null)) as
      | { error?: string; message?: string }
      | null;

    throw new Error(
      errorData?.error ?? errorData?.message ?? 'Failed to update profile',
    );
  }

  const result = (await response.json()) as UserProfileApiResponse;
  return mapUserProfileResponse(result);
}
