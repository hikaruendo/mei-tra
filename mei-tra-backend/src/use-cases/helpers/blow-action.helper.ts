import { BlowState, DomainPlayer } from '../../types/game.types';

export function hasPlayerDeclaredInBlow(
  blowState: BlowState,
  playerId: string,
): boolean {
  return (
    blowState.declarations.some(
      (declaration) => declaration.playerId === playerId,
    ) ||
    (blowState.actionHistory ?? []).some(
      (action) => action.playerId === playerId && action.type === 'declare',
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
      (action) => action.playerId === player.playerId && action.type === 'pass',
    )
  );
}

export function countPlayersActedInBlow(
  players: DomainPlayer[],
  blowState: BlowState,
): number {
  return players.filter(
    (player) =>
      hasPlayerDeclaredInBlow(blowState, player.playerId) ||
      hasPlayerPassedInBlow(blowState, player),
  ).length;
}
