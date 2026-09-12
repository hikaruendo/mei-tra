import { Test } from '@nestjs/testing';
import { PlayCardUseCase } from '../play-card.use-case';
import { ReportChomboUseCase } from '../report-chombo.use-case';
import { CardService } from '../../services/card.service';
import { PlayService } from '../../services/play.service';
import { ChomboService } from '../../services/chombo.service';
import { GameStateService } from '../../services/game-state.service';
import { IGameStateRepository } from '../../repositories/interfaces/game-state.repository.interface';
import { asSeatId } from '../../types/identity.types';

async function createGame(hand: string[]) {
  const repository: jest.Mocked<IGameStateRepository> = {
    create: jest.fn(),
    findByRoomId: jest.fn(),
    update: jest.fn(),
    persistRoomRoster: jest.fn(),
    delete: jest.fn(),
    updatePlayers: jest.fn(),
    updateGamePhase: jest.fn(),
    bulkUpdate: jest.fn(),
    deleteExpiredGameStates: jest.fn(),
  };
  const cards = new CardService();
  const play = new PlayService(cards);
  const chombo = new ChomboService(play);
  const game = new GameStateService(cards, chombo, repository);
  game.setRoomId('room-1');
  const state = game.getState();
  repository.update.mockImplementation(async () => ({
    ...state,
    version: (state.version ?? 0) + 1,
  }));
  state.gamePhase = 'play';
  state.pointsToWin = 30;
  state.currentSeatId = asSeatId('winner');
  state.players = [
    {
      seatId: asSeatId('winner'),
      name: 'Winner',
      team: 0,
      hand,
      isPasser: false,
    },
    {
      seatId: asSeatId('opponent'),
      name: 'Opponent',
      team: 1,
      hand: ['A♥'],
      isPasser: false,
    },
  ];
  for (const player of state.players) {
    game.upsertSessionUser({
      seatId: player.seatId,
      userId: player.seatId,
      socketId: player.seatId,
      name: player.name,
    });
  }
  state.blowState.currentHighestDeclaration = {
    seatId: asSeatId('winner'),
    trumpType: 'club',
    numberOfPairs: 7,
    timestamp: 1,
  };
  const module = await Test.createTestingModule({
    providers: [
      PlayCardUseCase,
      ReportChomboUseCase,
      {
        provide: 'IRoomService',
        useValue: {
          getRoom: async () => ({ settings: { gameMode: 'pro' } }),
          getRoomGameState: async () => game,
        },
      },
      { provide: 'IPlayService', useValue: play },
      { provide: 'IChomboService', useValue: chombo },
    ],
  }).compile();
  return {
    game,
    module,
    play: module.get(PlayCardUseCase),
    report: module.get(ReportChomboUseCase),
  };
}

describe('Pro card play and chombo reporting', () => {
  it('does not create a chombo candidate for a COM player', async () => {
    const fixture = await createGame(['A♠', 'K♠']);
    try {
      fixture.game.getState().players[0].isCOM = true;
      const played = await fixture.play.execute({
        roomId: 'room-1',
        actorId: 'winner',
        card: 'A♠',
      });
      expect(played.success).toBe(true);
      const result = await fixture.report.execute({
        roomId: 'room-1',
        actorId: 'opponent',
        violatorSeatId: asSeatId('winner'),
        violationType: 'negri-forget',
      });
      expect(result.events).toContainEqual(
        expect.objectContaining({
          event: 'chombo-resolved',
          payload: expect.objectContaining({
            isCorrect: false,
            awardedTeam: 0,
          }),
        }),
      );
    } finally {
      await fixture.module.close();
    }
  });

  it('still awards a Negri-forget report after the winner skips Negri', async () => {
    const fixture = await createGame(['A♠', 'K♠']);
    try {
      const played = await fixture.play.execute({
        roomId: 'room-1',
        actorId: 'winner',
        card: 'A♠',
      });
      expect(played.success).toBe(true);
      const result = await fixture.report.execute({
        roomId: 'room-1',
        actorId: 'opponent',
        violatorSeatId: asSeatId('winner'),
        violationType: 'negri-forget',
      });
      expect(result.success).toBe(true);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          event: 'chombo-resolved',
          payload: expect.objectContaining({
            isCorrect: true,
            awardedTeam: 1,
            scores: { 0: { play: 0, total: 0 }, 1: { play: 5, total: 5 } },
          }),
        }),
      );
    } finally {
      await fixture.module.close();
    }
  });

  it('records a four-jack candidate before a report', async () => {
    const fixture = await createGame(['J♠', 'J♥', 'J♦', 'J♣']);
    try {
      const played = await fixture.play.execute({
        roomId: 'room-1',
        actorId: 'winner',
        card: 'J♠',
      });
      expect(played.success).toBe(true);
      const result = await fixture.report.execute({
        roomId: 'room-1',
        actorId: 'opponent',
        violatorSeatId: asSeatId('winner'),
        violationType: 'four-jack',
      });
      expect(result.success).toBe(true);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          event: 'chombo-resolved',
          payload: expect.objectContaining({ isCorrect: true, awardedTeam: 1 }),
        }),
      );
    } finally {
      await fixture.module.close();
    }
  });

  it('awards a last-Tanzen report after the last Joker leaves the hand', async () => {
    const fixture = await createGame(['JOKER']);
    try {
      const played = await fixture.play.execute({
        roomId: 'room-1',
        actorId: 'winner',
        card: 'JOKER',
      });
      expect(played.success).toBe(true);
      const result = await fixture.report.execute({
        roomId: 'room-1',
        actorId: 'opponent',
        violatorSeatId: asSeatId('winner'),
        violationType: 'last-tanzen',
      });
      expect(result.success).toBe(true);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          event: 'chombo-resolved',
          payload: expect.objectContaining({ isCorrect: true, awardedTeam: 1 }),
        }),
      );
    } finally {
      await fixture.module.close();
    }
  });
});
