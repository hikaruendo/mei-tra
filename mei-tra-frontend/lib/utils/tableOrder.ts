import { Player } from '../../types/game.types';

/**
 * Returns 4 entries in consistent table order (Team0, Team1, Team0, Team1),
 * rotated so the current player is at index 0 (bottom position).
 * Positions mapping: [0]=bottom, [1]=left, [2]=top, [3]=right
 *
 * Works with any number of players (including <4 during waiting):
 * undefined fills missing slots — callers may substitute COM placeholders.
 *
 * Uses loop-based interleaving (same logic as backend arrangePlayersForSeatOrder)
 * to handle any team distribution robustly without producing undefined gaps.
 */
export function getConsistentTableOrderWithSelfBottom(
  players: Player[],
  currentPlayerId: string,
): (Player | undefined)[] {
  const team0 = players.filter(p => p.team === 0);
  const team1 = players.filter(p => p.team === 1);

  // Interleave T0 and T1 using a loop, matching backend arrangePlayersForSeatOrder logic.
  // This handles any distribution (e.g. 2:2, 3:1, 1:3) without undefined gaps.
  const order: (Player | undefined)[] = [];
  const maxLen = Math.max(team0.length, team1.length, 1);
  for (let i = 0; i < maxLen; i++) {
    if (team0[i]) order.push(team0[i]);
    if (team1[i]) order.push(team1[i]);
  }
  while (order.length < 4) order.push(undefined);

  // Rotate so self is at front (index 0 = bottom)
  const selfIdx = order.findIndex(p => p?.playerId === currentPlayerId);
  if (selfIdx > 0) {
    const rotated = [...order.slice(selfIdx), ...order.slice(0, selfIdx)];
    return [rotated[0], rotated[3], rotated[2], rotated[1]];
  }
  return [order[0], order[3], order[2], order[1]];
}
