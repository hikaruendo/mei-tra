import type { LeaderboardMode, LeaderboardResponse } from '@meitra/contracts/leaderboard';
import { config } from '@/lib/config';

export async function fetchLeaderboard(mode: LeaderboardMode, token: string): Promise<LeaderboardResponse> {
  const response = await fetch(`${config.backendUrl}/api/leaderboard?mode=${mode}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Leaderboard request failed: ${response.status}`);
  return response.json() as Promise<LeaderboardResponse>;
}
