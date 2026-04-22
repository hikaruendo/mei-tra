import type { RecentGameHistoryItemContract } from '@contracts/game-history';
import {
  fromRecentGameHistoryItemContract,
  RecentGameHistoryItem,
} from '@/types/game-history.types';

export async function fetchProfileGameHistory(
  userId: string,
  accessToken: string,
): Promise<RecentGameHistoryItem[]> {
  const response = await fetch(`/api/user-profile/${userId}/game-history`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => null)) as
      | { error?: string; message?: string }
      | null;

    throw new Error(
      errorData?.error ??
        errorData?.message ??
        'Failed to fetch recent game history',
    );
  }

  const items = (await response.json()) as RecentGameHistoryItemContract[];
  return items.map(fromRecentGameHistoryItemContract);
}
