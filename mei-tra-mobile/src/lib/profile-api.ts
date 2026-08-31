import type {
  AvatarUploadResponseDto,
  UpdateUserProfileRequestDto,
  UserProfileDto,
} from '@meitra/contracts/profile';
import type { RecentGameHistoryItemContract } from '@meitra/contracts/game-history';

import { config } from '@/lib/config';

const BASE = `${config.backendUrl}/api/user-profile`;

export class ProfileApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ProfileApiError';
  }
}

export function isRetryableProfileError(error: unknown): boolean {
  return (
    error instanceof TypeError ||
    (error instanceof ProfileApiError && error.status >= 500)
  );
}

export async function fetchPlayerProfile(
  userId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<UserProfileDto> {
  const res = await fetchImpl(`${BASE}/${encodeURIComponent(userId)}`);

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new ProfileApiError(
      body || `Profile request failed: ${res.status}`,
      res.status,
    );
  }

  return res.json() as Promise<UserProfileDto>;
}

interface ProfileRetryOptions {
  fetchImpl?: typeof fetch;
  maxAttempts?: number;
  wait?: (delayMs: number) => Promise<void>;
}

export async function fetchPlayerProfileWithRetry(
  userId: string,
  {
    fetchImpl = fetch,
    maxAttempts = 3,
    wait = (delayMs) =>
      new Promise((resolve) => setTimeout(resolve, delayMs)),
  }: ProfileRetryOptions = {},
): Promise<UserProfileDto> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fetchPlayerProfile(userId, fetchImpl);
    } catch (error) {
      if (!isRetryableProfileError(error) || attempt === maxAttempts) {
        throw error;
      }
      await wait(500 * 2 ** (attempt - 1));
    }
  }

  throw new Error('Profile retry loop completed unexpectedly');
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
