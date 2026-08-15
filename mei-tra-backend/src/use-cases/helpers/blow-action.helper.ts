import { BlowState, DomainPlayer } from '../../types/game.types';
import type { SeatId } from '../../types/identity.types';

export function hasPlayerDeclaredInBlow(
  blowState: BlowState,
  seatId: SeatId,
): boolean {
  return (
    blowState.declarations.some(
      (declaration) => declaration.seatId === seatId,
    ) ||
    (blowState.actionHistory ?? []).some(
      (action) => action.seatId === seatId && action.type === 'declare',
    )
  );
}

export function hasPlayerPassedInBlow(
  blowState: BlowState,
  player: DomainPlayer,
): boolean {
  return (
    player.isPasser ||
    (blowState.actionHistory ?? []).some(
      (action) => action.seatId === player.seatId && action.type === 'pass',
    )
  );
}

export function countPlayersActedInBlow(
  players: DomainPlayer[],
  blowState: BlowState,
): number {
  return players.filter(
    (player) =>
      hasPlayerDeclaredInBlow(blowState, player.seatId) ||
      hasPlayerPassedInBlow(blowState, player),
  ).length;
}
