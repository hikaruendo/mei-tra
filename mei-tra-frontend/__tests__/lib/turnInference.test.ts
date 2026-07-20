import { inferNextTurnAfterCardPlayed } from '@/lib/utils/turnInference';
import type { Field, Player } from '@/types/game.types';

const player = (playerId: string): Player => ({
  socketId: '',
  playerId,
  name: playerId,
  team: 0,
  hand: [],
});

describe('inferNextTurnAfterCardPlayed', () => {
  it('infers the human turn from player order after a COM first card', () => {
    const players = [
      player('com-1'),
      player('player-1'),
      player('com-2'),
      player('com-3'),
    ];
    const field: Field = {
      cards: ['J♠'],
      playedBy: ['com-1'],
      baseCard: 'J♠',
      dealerId: 'com-1',
      isComplete: false,
    };

    expect(inferNextTurnAfterCardPlayed(players, field)).toBe('player-1');
  });

  it('does not infer a turn while a joker base suit is pending', () => {
    const players = [player('com-1'), player('player-1')];
    const field: Field = {
      cards: ['JOKER'],
      playedBy: ['com-1'],
      baseCard: 'JOKER',
      dealerId: 'com-1',
      isComplete: false,
    };

    expect(inferNextTurnAfterCardPlayed(players, field)).toBeNull();
  });

  it('does not infer a turn for a completed field', () => {
    const players = [player('com-1'), player('player-1')];
    const field: Field = {
      cards: ['J♠', 'Q♠', 'K♠', 'A♠'],
      playedBy: ['com-1', 'player-1', 'com-2', 'com-3'],
      baseCard: 'J♠',
      dealerId: 'com-1',
      isComplete: true,
    };

    expect(inferNextTurnAfterCardPlayed(players, field)).toBeNull();
  });
});
