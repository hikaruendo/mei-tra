import { Player } from '../../types/game.types';

/**
 * Returns 4 players in consistent table order (Team0, Team1, Team0, Team1),
 * rotated so the current player is at index 0 (bottom position).
 * Positions mapping: [0]=bottom, [1]=left, [2]=top, [3]=right
 *
 * When fewer than 4 real players exist, undefined fills the missing slots
 * (callers should substitute COM placeholders for undefined entries).
 */
export function getConsistentTableOrderWithSelfBottom(
  players: Player[],
  currentPlayerId: string,
): (Player | undefined)[] {
  if (players.length < 4) {
    const result: (Player | undefined)[] = new Array(4).fill(undefined);
    players.forEach((player, index) => {
      result[index] = player;
    });
    return result;
  }

  const team0 = players.filter(p => p.team === 0);
  const team1 = players.filter(p => p.team === 1);
  const order: Player[] = [];
  for (let i = 0; i < 2; i++) {
    if (team0[i]) order.push(team0[i]);
    if (team1[i]) order.push(team1[i]);
  }

  // Rotate so self is at front (bottom), preserving counter-clockwise order
  const selfIdx = order.findIndex(p => p.playerId === currentPlayerId);
  if (selfIdx > 0) {
    const rotated = [...order.slice(selfIdx), ...order.slice(0, selfIdx)];
    return [rotated[0], rotated[3], rotated[2], rotated[1]];
  }
  return [order[0], order[3], order[2], order[1]];
}
