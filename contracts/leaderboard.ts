export const LEADERBOARD_MODES = ['normal', 'pro'] as const;

export type LeaderboardMode = (typeof LEADERBOARD_MODES)[number];

export function isLeaderboardMode(value: unknown): value is LeaderboardMode {
  return LEADERBOARD_MODES.includes(value as LeaderboardMode);
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  rank: number;
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
}

export interface LeaderboardSelf {
  userId: string;
  rank: number | null;
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
}

export interface LeaderboardResponse {
  mode: LeaderboardMode;
  minimumGames: number;
  entries: LeaderboardEntry[];
  me: LeaderboardSelf | null;
}
