import type { PlayerContract } from '@meitra/contracts/game';

export type SeatPosition = 'bottom' | 'left' | 'top' | 'right';

const SEAT_POSITIONS: SeatPosition[] = ['bottom', 'left', 'top', 'right'];

export function getSeatOrderWithSelfBottom(
  players: PlayerContract[],
  selfPlayerId: string | null,
): PlayerContract[] {
  if (players.length === 0) return players;

  const order = [...players.slice(0, 4)];
  while (order.length < 4) {
    order.push(order[0]);
  }

  const selfIndex = selfPlayerId
    ? order.findIndex((p) => p.playerId === selfPlayerId)
    : -1;

  if (selfIndex > 0) {
    const rotated = [...order.slice(selfIndex), ...order.slice(0, selfIndex)];
    return [rotated[0], rotated[3], rotated[2], rotated[1]];
  }
  return [order[0], order[3], order[2], order[1]];
}

export function getCardSeatPosition(
  playedByPlayerId: string,
  orderedPlayers: PlayerContract[],
): SeatPosition {
  const idx = orderedPlayers.findIndex(
    (p) => p.playerId === playedByPlayerId,
  );
  return idx >= 0 ? SEAT_POSITIONS[idx] : 'bottom';
}
