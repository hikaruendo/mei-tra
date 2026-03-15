import { Player } from '../../types/game.types';

/**
 * Returns 4 entries in waiting-room order, grouped by team and rotated so the
 * current player is at index 0 (bottom position).
 * Positions mapping: [0]=bottom, [1]=left, [2]=top, [3]=right
 */
export function getConsistentTableOrderWithSelfBottom(
  players: Player[],
  currentPlayerId: string,
): (Player | undefined)[] {
  const team0 = players.filter((p) => p.team === 0);
  const team1 = players.filter((p) => p.team === 1);

  const order: (Player | undefined)[] = [];
  const maxLen = Math.max(team0.length, team1.length, 1);
  for (let i = 0; i < maxLen; i++) {
    if (team0[i]) order.push(team0[i]);
    if (team1[i]) order.push(team1[i]);
  }
  while (order.length < 4) order.push(undefined);

  const selfIdx = order.findIndex((p) => p?.playerId === currentPlayerId);
  if (selfIdx > 0) {
    const rotated = [...order.slice(selfIdx), ...order.slice(0, selfIdx)];
    return [rotated[0], rotated[3], rotated[2], rotated[1]];
  }
  return [order[0], order[3], order[2], order[1]];
}

/**
 * Returns 4 entries in persisted seat order, rotated so the current player is
 * at index 0 (bottom position).
 *
 * Game play should trust the server's seat order so COM replacement/rejoin
 * does not drift from the authoritative turn order.
 */
export function getSeatOrderWithSelfBottom(
  players: Player[],
  currentPlayerId: string,
): (Player | undefined)[] {
  const order: (Player | undefined)[] = [...players.slice(0, 4)];
  while (order.length < 4) {
    order.push(undefined);
  }

  const selfIdx = order.findIndex((p) => p?.playerId === currentPlayerId);
  if (selfIdx > 0) {
    const rotated = [...order.slice(selfIdx), ...order.slice(0, selfIdx)];
    return [rotated[0], rotated[3], rotated[2], rotated[1]];
  }
  return [order[0], order[3], order[2], order[1]];
}
