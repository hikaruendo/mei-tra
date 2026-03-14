import { Player } from '../../types/game.types';

/**
 * Returns 4 entries in table seat order, rotated so the current player is at
 * index 0 (bottom position).
 * Positions mapping: [0]=bottom, [1]=left, [2]=top, [3]=right
 *
 * The backend already persists players in seat order. Re-deriving layout from
 * team assignments on the client can drift when COM replacement/rejoin happens,
 * so the UI should trust the server order and only rotate it for display.
 */
export function getConsistentTableOrderWithSelfBottom(
  players: Player[],
  currentPlayerId: string,
): (Player | undefined)[] {
  const order: (Player | undefined)[] = [...players.slice(0, 4)];
  while (order.length < 4) {
    order.push(undefined);
  }

  // Rotate so self is at front (index 0 = bottom)
  const selfIdx = order.findIndex(p => p?.playerId === currentPlayerId);
  if (selfIdx > 0) {
    const rotated = [...order.slice(selfIdx), ...order.slice(0, selfIdx)];
    return [rotated[0], rotated[3], rotated[2], rotated[1]];
  }
  return [order[0], order[3], order[2], order[1]];
}
