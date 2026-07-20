import type { Field, Player } from '@/types/game.types';

export const inferNextTurnAfterCardPlayed = (
  players: Player[],
  field: Field,
): string | null => {
  if (
    field.isComplete ||
    field.cards.length === 0 ||
    (field.baseCard === 'JOKER' && !field.baseSuit)
  ) {
    return null;
  }

  const lastPlayerId = field.playedBy[field.playedBy.length - 1];
  if (!lastPlayerId || players.length === 0) {
    return null;
  }

  const lastPlayerIndex = players.findIndex(
    (player) => player.playerId === lastPlayerId,
  );
  if (lastPlayerIndex === -1) {
    return null;
  }

  return players[(lastPlayerIndex + 1) % players.length]?.playerId ?? null;
};
