import { BlowService } from '../../services/blow.service';
import { ScoreService } from '../../services/score.service';
import { OpenDeclarationService } from '../../services/open-declaration.service';
import { DeclareOpenUseCase } from '../declare-open.use-case';
import { RevealBrokenHandUseCase } from '../reveal-broken-hand.use-case';
import { DeclareBlowUseCase } from '../declare-blow.use-case';
import { PassBlowUseCase } from '../pass-blow.use-case';
import { SelectNegriUseCase } from '../select-negri.use-case';
import type { DomainPlayer } from '../../types/game.types';
import { Test } from '@nestjs/testing';
import { PlayCardUseCase } from '../play-card.use-case';
import { CompleteFieldUseCase } from '../complete-field.use-case';
import { ReportChomboUseCase } from '../report-chombo.use-case';
import { CardService } from '../../services/card.service';
import { PlayService } from '../../services/play.service';
import { ChomboService } from '../../services/chombo.service';
import { GameStateService } from '../../services/game-state.service';
import { IGameStateRepository } from '../../repositories/interfaces/game-state.repository.interface';
import type { LogGameEventInput } from '../../services/interfaces/game-event-log.service.interface';
import { asSeatId } from '../../types/identity.types';

export async function createGame(
  hand: string[],
  otherPlayers?: DomainPlayer[],
) {
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
  let persistedState = state;
  repository.update.mockImplementation((_roomId, patch) => {
    persistedState = {
      ...persistedState,
      ...patch,
      version: (persistedState.version ?? 0) + 1,
    };
    return Promise.resolve(persistedState);
  });
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
  if (otherPlayers) {
    state.players = [state.players[0], ...otherPlayers];
  }
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
  const updateRoomStatus = jest.fn(() => Promise.resolve(true));
  const loggedEvents: LogGameEventInput[] = [];
  const gameEventLog = {
    log: jest.fn((input: LogGameEventInput) => {
      loggedEvents.push(input);
      return Promise.resolve();
    }),
  };
  const room: { settings: { gameMode: 'pro' | 'normal' } } = {
    settings: { gameMode: 'pro' },
  };
  const roomService = {
    getRoom: () => Promise.resolve(room),
    getRoomGameState: () => Promise.resolve(game),
    updateRoomStatus,
  };
  const module = await Test.createTestingModule({
    providers: [
      PlayCardUseCase,
      CompleteFieldUseCase,
      ReportChomboUseCase,
      DeclareOpenUseCase,
      RevealBrokenHandUseCase,
      DeclareBlowUseCase,
      PassBlowUseCase,
      SelectNegriUseCase,
      {
        provide: OpenDeclarationService,
        useValue: new OpenDeclarationService(play),
      },
      { provide: ChomboService, useValue: chombo },
      { provide: 'IScoreService', useValue: new ScoreService() },
      { provide: 'ICardService', useValue: cards },
      { provide: 'IBlowService', useValue: new BlowService(cards) },
      {
        provide: 'IRoomService',
        useValue: roomService,
      },
      { provide: 'IPlayService', useValue: play },
      { provide: 'IChomboService', useValue: chombo },
      { provide: 'IGameEventLogService', useValue: gameEventLog },
    ],
  }).compile();
  return {
    game,
    chombo,
    cards,
    gameEventLog,
    loggedEvents,
    open: module.get(DeclareOpenUseCase),
    broken: module.get(RevealBrokenHandUseCase),
    declare: module.get(DeclareBlowUseCase),
    pass: module.get(PassBlowUseCase),
    negri: module.get(SelectNegriUseCase),
    updateRoomStatus,
    room,
    roomService,
    module,
    play: module.get(PlayCardUseCase),
    completeField: module.get(CompleteFieldUseCase),
    report: module.get(ReportChomboUseCase),
  };
}
