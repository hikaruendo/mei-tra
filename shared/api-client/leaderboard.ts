import type {
  LeaderboardMode,
  LeaderboardResponse,
} from '@meitra/contracts/leaderboard';

export class LeaderboardApiError extends Error {
  constructor(readonly status: number) {
    super(`Leaderboard request failed: ${status}`);
    this.name = 'LeaderboardApiError';
  }
}

export interface LeaderboardApiClient {
  fetchLeaderboard(
    mode: LeaderboardMode,
    token: string,
    options?: { signal?: AbortSignal },
  ): Promise<LeaderboardResponse>;
}

export function createLeaderboardApiClient({
  baseUrl,
  fetchImpl,
}: {
  baseUrl: string;
  fetchImpl?: typeof fetch;
}): LeaderboardApiClient {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  const request =
    fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));

  return {
    async fetchLeaderboard(mode, token, options = {}) {
      const response = await request(
        `${normalizedBaseUrl}?mode=${encodeURIComponent(mode)}`,
        {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
          signal: options.signal,
        },
      );
      if (!response.ok) throw new LeaderboardApiError(response.status);
      return response.json() as Promise<LeaderboardResponse>;
    },
  };
}

/** What the viewer is told about their own standing, before translation. */
export type LeaderboardStanding =
  | { kind: 'ranked'; rank: number; gamesWon: number; gamesPlayed: number }
  | { kind: 'progress'; gamesPlayed: number; remaining: number }
  | { kind: 'guestQualified'; minimumGames: number }
  | { kind: 'guestProgress'; gamesPlayed: number; remaining: number };

export function describeLeaderboardStanding(
  leaderboard: LeaderboardResponse,
  isGuest: boolean,
): LeaderboardStanding {
  const gamesPlayed = leaderboard.me?.gamesPlayed ?? 0;
  const remaining = Math.max(0, leaderboard.minimumGames - gamesPlayed);
  if (isGuest) {
    return remaining === 0
      ? { kind: 'guestQualified', minimumGames: leaderboard.minimumGames }
      : { kind: 'guestProgress', gamesPlayed, remaining };
  }
  if (leaderboard.me?.rank) {
    return {
      kind: 'ranked',
      rank: leaderboard.me.rank,
      gamesWon: leaderboard.me.gamesWon,
      gamesPlayed,
    };
  }
  return { kind: 'progress', gamesPlayed, remaining };
}
