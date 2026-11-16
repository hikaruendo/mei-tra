import type { LeaderboardResponse } from '@meitra/contracts/leaderboard';
import type { GameMode } from '@meitra/contracts/room';

export class LeaderboardApiError extends Error {
  constructor(readonly status: number) {
    super(`Leaderboard request failed: ${status}`);
    this.name = 'LeaderboardApiError';
  }
}

export interface LeaderboardApiClient {
  fetchLeaderboard(
    mode: GameMode,
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

/**
 * Loads one mode's leaderboard for the signed-in viewer and reports the
 * outcome, unless cancelled first. Returns the cancel function.
 */
export function loadLeaderboard({
  client,
  mode,
  getAccessToken,
  onLoaded,
  onFailed,
}: {
  client: LeaderboardApiClient;
  mode: GameMode;
  getAccessToken: () => Promise<string | null>;
  onLoaded: (leaderboard: LeaderboardResponse) => void;
  onFailed: () => void;
}): () => void {
  const controller = new AbortController();
  void (async () => {
    try {
      const token = await getAccessToken();
      if (!token) throw new LeaderboardApiError(401);
      const leaderboard = await client.fetchLeaderboard(mode, token, {
        signal: controller.signal,
      });
      if (!controller.signal.aborted) onLoaded(leaderboard);
    } catch {
      if (!controller.signal.aborted) onFailed();
    }
  })();
  return () => controller.abort();
}
