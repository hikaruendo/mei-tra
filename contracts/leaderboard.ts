export type LeaderboardMode = 'normal' | 'pro';

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
  minimumGames: 10;
  entries: LeaderboardEntry[];
  me: LeaderboardSelf | null;
}
