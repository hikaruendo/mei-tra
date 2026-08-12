import {
  toPersistedPlayerStates,
  toRuntimePlayer,
  toTransportPlayers,
} from './player-adapters';

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

  describe('toTransportPlayers', () => {
    it('does not expose stale human profile metadata for a COM-controlled seat', () => {
      const [player] = toTransportPlayers(
        [
          {
            playerId: 'seat-1',
            name: 'Player2',
            hand: ['S1'],
            team: 0,
            isPasser: false,
            isCOM: false,
          },
        ],
        {
          getConnectionState: () => ({
            socketId: 'stale-socket',
            userId: 'user-2',
            isAuthenticated: true,
          }),
          roomPlayers: [
            {
              socketId: '',
              playerId: 'seat-1',
              participantKey: 'com-seat-1',
              name: 'COM',
              team: 0,
              hand: ['S1'],
              isPasser: false,
              isCOM: true,
              isReady: true,
              isHost: false,
              joinedAt: new Date('2026-08-11T00:00:00.000Z'),
            },
          ],
        },
      );

      expect(player).toEqual(
        expect.objectContaining({
          seatId: 'seat-1',
          name: 'COM',
          socketId: '',
          userId: undefined,
          isAuthenticated: false,
          isCOM: true,
        }),
      );
    });
  });
});
