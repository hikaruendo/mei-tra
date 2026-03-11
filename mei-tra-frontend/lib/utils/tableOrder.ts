import { Player } from '../../types/game.types';

/**
 * Returns 4 entries in consistent table order (Team0, Team1, Team0, Team1),
 * rotated so the current player is at index 0 (bottom position).
 * Positions mapping: [0]=bottom, [1]=left, [2]=top, [3]=right
 *
 * Works with any number of players (including <4 during waiting):
 * undefined fills missing slots — callers may substitute COM placeholders.
 */
export function getConsistentTableOrderWithSelfBottom(
  players: Player[],
  currentPlayerId: string,
): (Player | undefined)[] {
  const team0 = players.filter(p => p.team === 0);
  const team1 = players.filter(p => p.team === 1);

  // Interleave: [T0[0], T1[0], T0[1], T1[1]]
  const order: (Player | undefined)[] = [
    team0[0],
    team1[0],
    team0[1],
    team1[1],
  ];

  // Rotate so self is at front (index 0 = bottom)
  const selfIdx = order.findIndex(p => p?.playerId === currentPlayerId);
  if (selfIdx > 0) {
    const rotated = [...order.slice(selfIdx), ...order.slice(0, selfIdx)];
    return [rotated[0], rotated[3], rotated[2], rotated[1]];
  }
  return [order[0], order[3], order[2], order[1]];
}
