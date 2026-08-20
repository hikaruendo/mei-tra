import type { RecentGameHistoryItemContract } from '@meitra/contracts/game-history';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { fetchProfileGameHistory } from '@/lib/profile-api';
import { t } from '@/i18n';

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
      if (!token) throw new Error(t('settings.authExpired'));
      setItems(await fetchProfileGameHistory(userId, token));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : t('history.logFetchFailed'),
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
