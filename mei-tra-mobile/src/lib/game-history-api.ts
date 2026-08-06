import type {
  GameHistoryReplayQueryContract,
  GameHistoryReplayViewContract,
  GameHistorySummaryContract,
} from '@meitra/contracts/game-history';

import { config } from '@/lib/config';

function buildQueryString(query?: GameHistoryReplayQueryContract): string {
  if (!query) return '';
  const params = new URLSearchParams();
  if (query.limit != null) params.set('limit', String(query.limit));
  if (query.roundNumber != null)
    params.set('roundNumber', String(query.roundNumber));
  if (query.actionType) params.set('actionType', query.actionType);
  if (query.playerId) params.set('playerId', query.playerId);
  if (query.since) params.set('since', query.since);
  if (query.until) params.set('until', query.until);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

async function fetchJson<T>(
  path: string,
  token: string | null,
): Promise<T> {
  const res = await fetch(`${config.backendUrl}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error(`Game history API error: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function fetchGameHistoryReplay(
  roomId: string,
  token: string | null,
  query?: GameHistoryReplayQueryContract,
): Promise<GameHistoryReplayViewContract> {
  return fetchJson(
    `/api/game-history/${roomId}/replay${buildQueryString(query)}`,
    token,
  );
}

export function fetchGameHistorySummary(
  roomId: string,
  token: string | null,
  query?: GameHistoryReplayQueryContract,
): Promise<GameHistorySummaryContract> {
  return fetchJson(
    `/api/game-history/${roomId}/summary${buildQueryString(query)}`,
    token,
  );
}
