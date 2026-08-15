import type { RecentGameHistoryItemContract } from '@meitra/contracts/game-history';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { fetchProfileGameHistory } from '@/lib/profile-api';

export function useProfileGameHistory(userId: string | null) {
  const { getAccessToken } = useAuth();
  const [items, setItems] = useState<RecentGameHistoryItemContract[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('認証が切れました');
      setItems(await fetchProfileGameHistory(userId, token));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : '対局ログの取得に失敗しました',
      );
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { items, loading, error, refresh };
}
