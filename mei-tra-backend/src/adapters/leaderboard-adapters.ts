import type { LeaderboardResponse } from '@contracts/leaderboard';
import type { GameMode } from '@contracts/room';
import type { Json } from '../types/database.generated.types';
import type {
  WinRateLeaderboard,
  WinRateLeaderboardEntry,
  WinRateLeaderboardSelf,
} from '../types/leaderboard.types';

type JsonRecord = { [key: string]: Json | undefined };

function invalid(): never {
  throw new Error('Invalid leaderboard response');
}

function asRecord(value: Json | undefined): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : invalid();
}

function readString(row: JsonRecord, key: string): string {
  const value = row[key];
  return typeof value === 'string' ? value : invalid();
}

function readNumber(row: JsonRecord, key: string): number {
  const value = row[key];
  return typeof value === 'number' ? value : invalid();
}

function readNullableNumber(row: JsonRecord, key: string): number | null {
  return row[key] === null ? null : readNumber(row, key);
}

function toEntry(value: Json): WinRateLeaderboardEntry {
  const row = asRecord(value);
  const avatarUrl = row.avatar_url;
  return {
    userId: readString(row, 'user_id'),
    displayName: readString(row, 'display_name'),
    avatarUrl:
      avatarUrl === null || typeof avatarUrl === 'string'
        ? avatarUrl
        : invalid(),
    rank: readNumber(row, 'rank'),
    gamesPlayed: readNumber(row, 'games_played'),
    gamesWon: readNumber(row, 'games_won'),
    winRate: readNumber(row, 'win_rate'),
  };
}

function toSelf(value: Json | undefined): WinRateLeaderboardSelf | null {
  if (value === null) return null;
  const row = asRecord(value);
  return {
    userId: readString(row, 'user_id'),
    rank: readNullableNumber(row, 'rank'),
    gamesPlayed: readNumber(row, 'games_played'),
    gamesWon: readNumber(row, 'games_won'),
    winRate: readNumber(row, 'win_rate'),
  };
}

/** Reads the result of the `get_win_rate_leaderboard` database function. */
export function toWinRateLeaderboard(result: Json): WinRateLeaderboard {
  const row = asRecord(result);
  const entries = row.entries;
  return {
    minimumGames: readNumber(row, 'minimum_games'),
    entries: Array.isArray(entries) ? entries.map(toEntry) : invalid(),
    me: 'me' in row ? toSelf(row.me) : invalid(),
  };
}

export function toLeaderboardResponse(
  mode: GameMode,
  leaderboard: WinRateLeaderboard,
): LeaderboardResponse {
  return {
    mode,
    minimumGames: leaderboard.minimumGames,
    entries: leaderboard.entries,
    me: leaderboard.me,
  };
}
