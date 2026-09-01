import type { RecentGameHistoryItemContract } from '@meitra/contracts/game-history';
import type {
  AvatarUploadResponseDto,
  UpdateUserProfileRequestDto,
  UserProfileDto,
} from '@meitra/contracts/profile';

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

export interface ProfileRequestOptions {
  signal?: AbortSignal;
}

export interface ProfileRetryOptions extends ProfileRequestOptions {
  maxAttempts?: number;
  wait?: (delayMs: number) => Promise<void>;
}

export interface ProfileApiClient {
  fetchProfile(
    userId: string,
    options?: ProfileRequestOptions,
  ): Promise<UserProfileDto>;
  fetchGameHistory(
    userId: string,
    token: string,
    options?: ProfileRequestOptions,
  ): Promise<RecentGameHistoryItemContract[]>;
  updateProfile(
    userId: string,
    token: string,
    data: UpdateUserProfileRequestDto,
    options?: ProfileRequestOptions,
  ): Promise<UserProfileDto>;
  uploadAvatar(
    userId: string,
    token: string,
    body: FormData,
    options?: ProfileRequestOptions,
  ): Promise<AvatarUploadResponseDto>;
}

interface CreateProfileApiClientOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
}

async function readErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  let body = '';
  try {
    body = await response.text();
  } catch {
    // Some fetch test doubles only implement json().
  }

  if (body) {
    try {
      const parsed = JSON.parse(body) as { error?: unknown; message?: unknown };
      if (typeof parsed.error === 'string') return parsed.error;
      if (typeof parsed.message === 'string') return parsed.message;
    } catch {
      return body;
    }
  }

  try {
    const parsed = (await response.json()) as {
      error?: unknown;
      message?: unknown;
    };
    if (typeof parsed.error === 'string') return parsed.error;
    if (typeof parsed.message === 'string') return parsed.message;
  } catch {
    // Use the operation-specific fallback below.
  }

  return fallback;
}

export function createProfileApiClient({
  baseUrl,
  fetchImpl,
}: CreateProfileApiClientOptions): ProfileApiClient {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  const request = fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const userPath = (userId: string, suffix = '') =>
    `${normalizedBaseUrl}/${encodeURIComponent(userId)}${suffix}`;

  const requestJson = async <T>(
    url: string,
    init: RequestInit,
    fallback: string,
  ): Promise<T> => {
    const response = await request(url, init);
    if (!response.ok) {
      throw new ProfileApiError(
        await readErrorMessage(response, fallback),
        response.status,
      );
    }
    return response.json() as Promise<T>;
  };

  return {
    fetchProfile: (userId, options = {}) =>
      requestJson<UserProfileDto>(
        userPath(userId),
        { signal: options.signal },
        'Failed to load profile',
      ),
    fetchGameHistory: (userId, token, options = {}) =>
      requestJson<RecentGameHistoryItemContract[]>(
        userPath(userId, '/game-history'),
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: options.signal,
        },
        'Failed to load game history',
      ),
    updateProfile: (userId, token, data, options = {}) =>
      requestJson<UserProfileDto>(
        userPath(userId),
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
          signal: options.signal,
        },
        'Failed to update profile',
      ),
    uploadAvatar: (userId, token, body, options = {}) =>
      requestJson<AvatarUploadResponseDto>(
        userPath(userId, '/avatar'),
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body,
          signal: options.signal,
        },
        'Failed to upload avatar',
      ),
  };
}

export async function fetchProfileWithRetry(
  client: ProfileApiClient,
  userId: string,
  {
    maxAttempts = 3,
    wait = (delayMs) =>
      new Promise((resolve) => setTimeout(resolve, delayMs)),
    signal,
  }: ProfileRetryOptions = {},
): Promise<UserProfileDto> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await client.fetchProfile(userId, { signal });
    } catch (error) {
      if (!isRetryableProfileError(error) || attempt === maxAttempts) {
        throw error;
      }
      await wait(500 * 2 ** (attempt - 1));
    }
  }

  throw new Error('Profile retry loop completed unexpectedly');
}
