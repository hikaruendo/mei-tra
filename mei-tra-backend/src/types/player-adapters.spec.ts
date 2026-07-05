import { toRuntimePlayer } from './player-adapters';

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
});
