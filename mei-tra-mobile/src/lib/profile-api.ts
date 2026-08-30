import type {
  AvatarUploadResponseDto,
  UpdateUserProfileRequestDto,
  UserProfileDto,
} from '@meitra/contracts/profile';
import type { RecentGameHistoryItemContract } from '@meitra/contracts/game-history';

import { config } from '@/lib/config';

const BASE = `${config.backendUrl}/api/user-profile`;

export async function fetchPlayerProfile(
  userId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<UserProfileDto> {
  const res = await fetchImpl(`${BASE}/${encodeURIComponent(userId)}`);

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(body || `Profile request failed: ${res.status}`);
  }

  return res.json() as Promise<UserProfileDto>;
}

export async function fetchProfileGameHistory(
  userId: string,
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<RecentGameHistoryItemContract[]> {
  const res = await fetchImpl(
    `${BASE}/${encodeURIComponent(userId)}/game-history`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(body || `Game history request failed: ${res.status}`);
  }

  return res.json() as Promise<RecentGameHistoryItemContract[]>;
}

export async function updateProfile(
  userId: string,
  token: string,
  data: UpdateUserProfileRequestDto,
): Promise<UserProfileDto> {
  const res = await fetch(`${BASE}/${userId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(body || `Profile update failed: ${res.status}`);
  }

  return res.json() as Promise<UserProfileDto>;
}

export async function uploadAvatar(
  userId: string,
  token: string,
  uri: string,
  mimeType: string,
): Promise<AvatarUploadResponseDto> {
  const filename = `avatar.${mimeType === 'image/png' ? 'png' : 'jpg'}`;

  const form = new FormData();
  form.append('avatar', {
    uri,
    name: filename,
    type: mimeType,
  } as unknown as Blob);

  const res = await fetch(`${BASE}/${userId}/avatar`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(body || `Avatar upload failed: ${res.status}`);
  }

  return res.json() as Promise<AvatarUploadResponseDto>;
}
