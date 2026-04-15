import { UserPreferences, UserProfile } from '@/types/user.types';

export interface UserProfileApiResponse {
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
  preferences: UserPreferences;
}

export interface UpdateUserProfilePayload {
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  preferences?: Partial<UserPreferences>;
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
  const response = await fetch(`/api/user-profile/${userId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
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
