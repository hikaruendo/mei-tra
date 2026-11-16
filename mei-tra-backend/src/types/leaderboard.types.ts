export interface WinRateLeaderboardEntry {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  rank: number;
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
}

export interface WinRateLeaderboardSelf {
  userId: string;
  rank: number | null;
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
}

export interface WinRateLeaderboard {
  minimumGames: number;
  entries: WinRateLeaderboardEntry[];
  me: WinRateLeaderboardSelf | null;
}
