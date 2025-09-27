import { Player } from '../../types/game.types';

export interface PlayerProfile {
  displayName: string;
  avatarUrl?: string;
  isAuthenticated: boolean;
}

/**
 * プレイヤーのプロフィール情報を取得
 */
export const getPlayerProfile = async (player: Player): Promise<PlayerProfile> => {
  // 認証済みユーザーの場合、プロフィールAPIからデータを取得
  if (player.userId && player.isAuthenticated) {
    try {
      const response = await fetch(`/api/user-profile/${player.userId}`);
      if (response.ok) {
        const profileData = await response.json();
        return {
          displayName: profileData.displayName || player.name,
          avatarUrl: profileData.avatarUrl,
          isAuthenticated: true,
        };
      }
    } catch (error) {
      console.warn('Failed to fetch user profile:', error);
    }
  }

  // ゲストユーザーまたはAPI取得失敗時のフォールバック
  return {
    displayName: player.name,
    avatarUrl: undefined,
    isAuthenticated: false,
  };
};

/**
 * デフォルトアバターのURLを取得
 */
export const getDefaultAvatarUrl = (): string => {
  return '/default-avatar.svg';
};