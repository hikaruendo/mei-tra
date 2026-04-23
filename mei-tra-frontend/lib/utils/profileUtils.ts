import type { Player } from '@/types/game.types';

export interface PlayerProfile {
  displayName: string;
  avatarUrl?: string;
  isAuthenticated: boolean;
}

/**
 * プレイヤーのプロフィール情報を取得
 */
type PlayerProfileInput = Pick<
  Player,
  'name' | 'userId' | 'isAuthenticated'
>;

const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;
const profileCache = new Map<
  string,
  { profile: PlayerProfile; expiresAt: number }
>();
const inFlightProfileRequests = new Map<string, Promise<PlayerProfile>>();

export const clearPlayerProfileCache = (userId?: string): void => {
  if (userId) {
    profileCache.delete(userId);
    inFlightProfileRequests.delete(userId);
    return;
  }

  profileCache.clear();
  inFlightProfileRequests.clear();
};

const createFallbackProfile = (name: string): PlayerProfile => ({
  displayName: name,
  avatarUrl: undefined,
  isAuthenticated: false,
});

export const getPlayerProfile = async (
  player: PlayerProfileInput,
): Promise<PlayerProfile> => {
  // 認証済みユーザーの場合、プロフィールAPIからデータを取得
  if (player.userId && player.isAuthenticated) {
    const userId = player.userId;
    const cached = profileCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.profile;
    }

    const inFlight = inFlightProfileRequests.get(userId);
    if (inFlight) {
      return inFlight;
    }

    const request = (async () => {
      try {
        const response = await fetch(`/api/user-profile/${userId}`);
        if (response.ok) {
          const profileData = await response.json();
          const profile = {
            displayName: profileData.displayName || player.name,
            avatarUrl: profileData.avatarUrl,
            isAuthenticated: true,
          };

          profileCache.set(userId, {
            profile,
            expiresAt: Date.now() + PROFILE_CACHE_TTL_MS,
          });

          return profile;
        }
      } catch (error) {
        console.warn('Failed to fetch user profile:', error);
      } finally {
        inFlightProfileRequests.delete(userId);
      }

      return createFallbackProfile(player.name);
    })();

    inFlightProfileRequests.set(userId, request);
    return request;
  }

  // ゲストユーザーまたはAPI取得失敗時のフォールバック
  return createFallbackProfile(player.name);
};

/**
 * デフォルトアバターのURLを取得
 */
export const getDefaultAvatarUrl = (): string => {
  return '/default-avatar.svg';
};
