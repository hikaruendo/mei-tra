import type {
  GameHistoryReplayQueryContract,
  GameHistorySummaryContract,
  GameHistoryReplayViewContract,
} from '@contracts/game-history';
import {
  fromGameHistoryReplayViewContract,
  fromGameHistorySummaryContract,
  GameHistoryReplayQuery,
  GameHistorySummary,
  GameHistoryReplayView,
} from '@/types/game-history.types';

function buildHistoryQueryString(query?: GameHistoryReplayQuery): string {
  if (!query) {
    return '';
  }

  const searchParams = new URLSearchParams();

  const entries = Object.entries(query) as Array<
    [keyof GameHistoryReplayQueryContract, string | number | undefined]
  >;

  for (const [key, value] of entries) {
    if (value === undefined || value === null) {
      continue;
    }
    searchParams.set(key, String(value));
  }

  const serialized = searchParams.toString();
  return serialized ? `?${serialized}` : '';
}

async function fetchGameHistoryResource<TContract, TData>(
  path: string,
  fallbackMessage: string,
  mapResponse: (data: TContract) => TData,
): Promise<TData> {
  const response = await fetch(
    path,
    {
      method: 'GET',
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    const errorData = (await response.json().catch(() => null)) as
      | { error?: string; message?: string }
      | null;

    throw new Error(
      errorData?.error ??
        errorData?.message ??
        fallbackMessage,
    );
  }

  return mapResponse((await response.json()) as TContract);
}

export async function fetchGameHistoryReplay(
  roomId: string,
  query?: GameHistoryReplayQuery,
): Promise<GameHistoryReplayView> {
  return fetchGameHistoryResource<GameHistoryReplayViewContract, GameHistoryReplayView>(
    `/api/game-history/${roomId}/replay${buildHistoryQueryString(query)}`,
    'Failed to fetch game history replay',
    fromGameHistoryReplayViewContract,
  );
}

export async function fetchGameHistorySummary(
  roomId: string,
  query?: GameHistoryReplayQuery,
): Promise<GameHistorySummary> {
  return fetchGameHistoryResource<GameHistorySummaryContract, GameHistorySummary>(
    `/api/game-history/${roomId}/summary${buildHistoryQueryString(query)}`,
    'Failed to fetch game history summary',
    fromGameHistorySummaryContract,
  );
}
