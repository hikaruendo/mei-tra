import { ReconnectionUseCase } from '../reconnection.use-case';
import { asSeatId } from '../../types/identity.types';
import { RoomStatus } from '../../types/room.types';
import type { UserProfile } from '../../types/user.types';
import type { GameOverPayload } from '@contracts/game';
import { createGame } from './chombo-game.fixture';

describe('pro-mode start-to-reconnect scenario', () => {
  it('keeps play, negri, reveal, chombo score, victory, and reconnect state together', async () => {
    const fixture = await createGame(['A♠', 'K♠']);
    try {
      let state = fixture.game.getState();
      state.pointsToWin = 5;
      state.playState!.currentField = {
        cards: [],
        playedBySeatIds: [],
        baseCard: '',
        dealerSeatId: asSeatId('winner'),
        isComplete: false,
      };

      const play = await fixture.play.execute({
        roomId: 'room-1',
        actorId: 'winner',
        card: 'A♠',
      });
      expect(play.success).toBe(true);

      state = fixture.game.getState();
      state.currentSeatId = asSeatId('winner');
      state.playState!.negriCard = 'K♠';
      state.playState!.negriSeatId = asSeatId('winner');
      state.players[0].hand = [];
      state.playState!.revealedHands = {
        [asSeatId('winner')]: ['K♠'],
      };
      state.playState!.openDeclared = true;
      state.playState!.openResolved = true;
      state.playState!.chomboRoundNumber = state.roundNumber;
      state.playState!.chomboViolations = [
        {
          type: 'wrong-open',
          violatorSeatId: asSeatId('winner'),
          timestamp: 1,
          reportedBySeatId: null,
          isExpired: false,
        },
      ];

      const report = await fixture.report.execute({
        roomId: 'room-1',
        actorId: 'opponent',
        violatorSeatId: asSeatId('winner'),
        violationType: 'wrong-open',
      });
      // The report event is the public scoring boundary for the scenario.
      expect(state.pointsToWin).toBe(5);
      expect(report.success).toBe(true);
      expect(state.teamScores[1].total).toBe(5);
      expect(report.events).toContainEqual(
        expect.objectContaining({ event: 'game-over' }),
      );
      state = fixture.game.getState();
      expect(state.gameOver?.winningTeam).toBe(1);

      const room = {
        id: 'room-1',
        status: RoomStatus.FINISHED,
        hostSeatId: asSeatId('winner'),
        settings: { gameMode: 'pro' as const, teamNames: undefined },
        players: state.players.map((player) => ({
          seatId: player.seatId,
          userId: player.seatId,
          name: player.name,
          team: player.team,
          hand: player.hand,
          socketId: '',
          isAuthenticated: true,
          isCOM: false,
          isPasser: false,
          isReady: true,
          isHost: player.seatId === asSeatId('winner'),
          joinedAt: new Date(),
        })),
      };
      const roomService = {
        getRoom: jest.fn().mockResolvedValue(room),
        getRoomGameState: jest.fn().mockResolvedValue(fixture.game),
        listRooms: jest.fn().mockResolvedValue([room]),
      } as never;
      const reconnection = new ReconnectionUseCase(roomService, fixture.game, {
        claim: jest.fn(),
      } as never);
      const snapshot = await reconnection.getActiveGameSnapshot({
        roomId: 'room-1',
        authenticatedUser: {
          id: 'winner',
          email: 'winner@example.com',
          isAnonymous: false,
          profile: {} as UserProfile,
        },
      });

      expect(snapshot?.gameState).toMatchObject({
        gameMode: 'pro',
        negriCard: 'K♠',
        negriSeatId: asSeatId('winner'),
        revealedHands: { [asSeatId('winner')]: ['K♠'] },
        openDeclared: true,
        openResolved: true,
        gameOver: expect.objectContaining({
          winningTeam: 1,
        }) as GameOverPayload,
        teamScores: { 0: { play: 0, total: 0 }, 1: { play: 5, total: 5 } },
      });
    } finally {
      await fixture.module.close();
    }
  });
});
