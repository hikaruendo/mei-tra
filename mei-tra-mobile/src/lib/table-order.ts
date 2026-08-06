import type { PlayerContract } from '@meitra/contracts/game';

export type SeatPosition = 'bottom' | 'left' | 'top' | 'right';

const SEAT_POSITIONS: SeatPosition[] = ['bottom', 'left', 'top', 'right'];

export function getSeatOrderWithSelfBottom(
  players: PlayerContract[],
  selfPlayerId: string | null,
): PlayerContract[] {
  if (!selfPlayerId || players.length === 0) return players;
  const selfIndex = players.findIndex((p) => p.playerId === selfPlayerId);
  if (selfIndex < 0) return players;

  const rotated = [
    ...players.slice(selfIndex),
    ...players.slice(0, selfIndex),
  ];
  if (rotated.length === 4) {
    [rotated[1], rotated[3]] = [rotated[3], rotated[1]];
  }
  return rotated;
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
