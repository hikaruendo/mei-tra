import { toPersistedPlayerStates, toRuntimePlayer } from './player-adapters';

describe('player-adapters', () => {
  describe('toRuntimePlayer', () => {
    it('uses an explicit fallback team when persisted player team is missing', () => {
      const player = toRuntimePlayer(
        {
          playerId: 'player-1',
          name: 'Player 1',
          hand: [],
          isPasser: false,
        },
        1,
      );

      expect(player?.team).toBe(1);
    });

    it('rejects players without a persisted or fallback team', () => {
      const player = toRuntimePlayer({
        playerId: 'player-1',
        name: 'Player 1',
        hand: [],
        isPasser: false,
      });

      expect(player).toBeNull();
    });
  });

  describe('toPersistedPlayerStates', () => {
    it('persists gameplay fields without duplicating player identity', () => {
      const states = toPersistedPlayerStates([
        {
          playerId: 'player-1',
          name: 'Player 1',
          hand: ['S1'],
          team: 1,
          isPasser: true,
          isCOM: false,
          hasBroken: true,
          hasRequiredBroken: false,
        },
      ]);

      expect(states).toEqual({
        'player-1': {
          hand: ['S1'],
          isPasser: true,
          hasBroken: true,
          hasRequiredBroken: false,
        },
      });
      expect(states['player-1']).not.toHaveProperty('name');
      expect(states['player-1']).not.toHaveProperty('team');
      expect(states['player-1']).not.toHaveProperty('isCOM');
    });
  });
});
