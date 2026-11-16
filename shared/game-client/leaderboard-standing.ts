import type { LeaderboardResponse } from '@meitra/contracts/leaderboard';
import type { GameMode } from '@meitra/contracts/room';

/** Translation keys under `leaderboard.` for each mode tab. */
export const LEADERBOARD_MODE_LABEL_KEYS = {
  normal: 'modeNormal',
  pro: 'modePro',
} as const satisfies Record<GameMode, string>;

/** What the viewer is told about their own standing: a key under `leaderboard.` and its values. */
export type LeaderboardStandingMessage =
  | { key: 'myRank'; values: { rank: number; wins: number; games: number } }
  | { key: 'progress'; values: { games: number; remaining: number } }
  | { key: 'unlisted'; values: { games: number } }
  | { key: 'guestNote'; values: { minimumGames: number } }
  | { key: 'guestProgress'; values: { games: number; remaining: number } };

export function describeLeaderboardStanding(
  leaderboard: LeaderboardResponse,
  isGuest: boolean,
): LeaderboardStandingMessage {
  const games = leaderboard.me?.gamesPlayed ?? 0;
  const remaining = Math.max(0, leaderboard.minimumGames - games);
  if (isGuest) {
    return remaining === 0
      ? { key: 'guestNote', values: { minimumGames: leaderboard.minimumGames } }
      : { key: 'guestProgress', values: { games, remaining } };
  }
  if (leaderboard.me?.rank) {
    return {
      key: 'myRank',
      values: {
        rank: leaderboard.me.rank,
        wins: leaderboard.me.gamesWon,
        games,
      },
    };
  }
  return remaining === 0
    ? { key: 'unlisted', values: { games } }
    : { key: 'progress', values: { games, remaining } };
}
