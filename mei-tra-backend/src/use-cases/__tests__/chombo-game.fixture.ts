import { Test } from '@nestjs/testing';
import { PlayCardUseCase } from '../play-card.use-case';
import { ReportChomboUseCase } from '../report-chombo.use-case';
import { CardService } from '../../services/card.service';
import { PlayService } from '../../services/play.service';
import { ChomboService } from '../../services/chombo.service';
import { GameStateService } from '../../services/game-state.service';
import { IGameStateRepository } from '../../repositories/interfaces/game-state.repository.interface';
import { asSeatId } from '../../types/identity.types';

export async function createGame(hand: string[]) {
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
  const updateRoomStatus = jest.fn(async () => true);
  const module = await Test.createTestingModule({
    providers: [
      PlayCardUseCase,
      ReportChomboUseCase,
      {
        provide: 'IRoomService',
        useValue: {
          getRoom: async () => ({ settings: { gameMode: 'pro' } }),
          getRoomGameState: async () => game,
          updateRoomStatus,
        },
      },
      { provide: 'IPlayService', useValue: play },
      { provide: 'IChomboService', useValue: chombo },
    ],
  }).compile();
  return {
    game,
    chombo,
    updateRoomStatus,
    module,
    play: module.get(PlayCardUseCase),
    report: module.get(ReportChomboUseCase),
  };
}
