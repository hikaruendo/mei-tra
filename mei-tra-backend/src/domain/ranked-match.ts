import type { LeaderboardMode } from '@contracts/leaderboard';
import { GameState, Team } from '../types/game.types';
import { Room } from '../types/room.types';
import { RankedPlayerResult } from '../repositories/interfaces/leaderboard.repository.interface';

export interface RankedMatch {
  matchId: string;
  mode: LeaderboardMode;
  players: RankedPlayerResult[];
}

export function rankedMatchAtGameOver(
  room: Room,
  state: GameState | null,
  winningTeam: Team,
): RankedMatch | null {
  if (
    !state?.rankingMatchId ||
    state.rankingComParticipated ||
    room.players.length !== 4 ||
    room.players.some((player) => player.isCOM || !player.userId) ||
    new Set(room.players.map((player) => player.userId)).size !== 4
  )
    return null;

  return {
    matchId: state.rankingMatchId,
    mode: room.settings.gameMode ?? 'normal',
    players: room.players.map((player) => ({
      userId: player.userId as string,
      won: player.team === winningTeam,
    })),
  };
}
