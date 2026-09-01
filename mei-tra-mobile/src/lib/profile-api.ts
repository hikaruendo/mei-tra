import type { RecentGameHistoryItemContract } from '@meitra/contracts/game-history';
import type {
  AvatarUploadResponseDto,
  UpdateUserProfileRequestDto,
  UserProfileDto,
} from '@meitra/contracts/profile';
import {
  createProfileApiClient,
  fetchProfileWithRetry,
  type ProfileRetryOptions as SharedProfileRetryOptions,
} from '@meitra/api-client/profile';

import { config } from '@/lib/config';

const BASE = `${config.backendUrl}/api/user-profile`;

const createClient = (fetchImpl?: typeof fetch) =>
  createProfileApiClient({ baseUrl: BASE, fetchImpl });

const profileApi = createClient();

export async function fetchPlayerProfile(
  userId: string,
  fetchImpl?: typeof fetch,
): Promise<UserProfileDto> {
  return createClient(fetchImpl).fetchProfile(userId);
}

interface ProfileRetryOptions extends SharedProfileRetryOptions {
  fetchImpl?: typeof fetch;
}

export async function fetchPlayerProfileWithRetry(
  userId: string,
  { fetchImpl, ...retryOptions }: ProfileRetryOptions = {},
): Promise<UserProfileDto> {
  return fetchProfileWithRetry(
    createClient(fetchImpl),
    userId,
    retryOptions,
  );
}

export async function fetchProfileGameHistory(
  userId: string,
  token: string,
  fetchImpl?: typeof fetch,
): Promise<RecentGameHistoryItemContract[]> {
  return createClient(fetchImpl).fetchGameHistory(userId, token);
}

export async function updateProfile(
  userId: string,
  token: string,
  data: UpdateUserProfileRequestDto,
): Promise<UserProfileDto> {
  return profileApi.updateProfile(userId, token, data);
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
  return profileApi.uploadAvatar(userId, token, form);
}
