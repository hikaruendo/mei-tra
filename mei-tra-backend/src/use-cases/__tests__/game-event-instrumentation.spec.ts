import { StartGameUseCase } from '../start-game.use-case';
import { PlayCardUseCase } from '../play-card.use-case';
import { ProcessGameOverUseCase } from '../process-game-over.use-case';
import { IRoomService } from '../../services/interfaces/room-service.interface';
import { IGameEventLogService } from '../../services/interfaces/game-event-log.service.interface';

describe('Game event instrumentation', () => {
  it('logs game_started when a game begins', async () => {
    const roomService = {
      getRoom: jest.fn().mockResolvedValue({
        id: 'room-1',
        hostId: 'host-1',
        settings: { pointsToWin: 7 },
        players: [
          {
            playerId: 'host-1',
            hand: [],
            isPasser: false,
            hasBroken: false,
            hasRequiredBroken: false,
          },
        ],
      }),
      getRoomGameState: jest.fn().mockResolvedValue({
        getState: () => ({
          players: [
            {
              playerId: 'host-1',
              team: 0,
              hand: [],
              isPasser: false,
              hasBroken: false,
              hasRequiredBroken: false,
            },
          ],
          teamScores: { 0: { play: 0, total: 0 }, 1: { play: 0, total: 0 } },
          gamePhase: 'blow',
          roundNumber: 1,
          blowState: { currentBlowIndex: 0 },
        }),
        startGame: jest.fn().mockResolvedValue(undefined),
        registerPlayerToken: jest.fn(),
      }),
      canStartGame: jest.fn().mockResolvedValue({ canStart: true }),
      fillVacantSeatsWithCOM: jest.fn().mockResolvedValue(undefined),
      updateRoomStatus: jest.fn().mockResolvedValue(undefined),
    } as unknown as IRoomService;

    const gameEventLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    } as unknown as IGameEventLogService;

    const useCase = new StartGameUseCase(roomService, gameEventLogService);

    await useCase.execute({ roomId: 'room-1', playerId: 'host-1' });

    expect(gameEventLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: 'room-1',
        actionType: 'game_started',
        playerId: 'host-1',
      }),
    );
  });

  it('logs card_played when a card is played', async () => {
    const saveState = jest.fn().mockResolvedValue(undefined);
    const nextTurn = jest.fn().mockResolvedValue(undefined);
    const state = {
      players: [
        {
          playerId: 'player-1',
          userId: 'user-1',
          hand: ['AS'],
        },
        {
          playerId: 'player-2',
          userId: 'user-2',
          hand: [],
        },
      ],
      currentPlayerIndex: 0,
      gamePhase: 'play',
      roundNumber: 1,
      teamScores: { 0: { play: 0, total: 0 }, 1: { play: 0, total: 0 } },
      playState: {
        currentField: {
          cards: [],
          playedBy: [],
          baseCard: '',
          dealerId: 'player-1',
          isComplete: false,
        },
      },
    };

    const roomService = {
      getRoomGameState: jest.fn().mockResolvedValue({
        getState: () => state,
        isPlayerTurn: jest.fn().mockReturnValue(true),
        nextTurn,
        saveState,
        findPlayerByActorId: () => state.players[0],
      }),
    } as unknown as IRoomService;

    const gameEventLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    } as unknown as IGameEventLogService;

    const useCase = new PlayCardUseCase(roomService, gameEventLogService);

    await useCase.execute({ roomId: 'room-1', actorId: 'user-1', card: 'AS' });

    expect(gameEventLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: 'room-1',
        actionType: 'card_played',
        playerId: 'player-1',
      }),
    );
  });

  it('logs player_stats_updated after processing game over', async () => {
    const roomService = {
      getRoom: jest.fn().mockResolvedValue({
        id: 'room-1',
        players: [
          {
            playerId: 'player-1',
            name: 'Player 1',
            team: 0,
            hand: [],
            isPasser: false,
            socketId: 'socket-1',
            userId: 'user-1',
            isAuthenticated: true,
            isReady: true,
            isHost: true,
            joinedAt: new Date(),
          },
        ],
      }),
      updateUserGameStats: jest.fn().mockResolvedValue(undefined),
    } as unknown as IRoomService;

    const gameEventLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    } as unknown as IGameEventLogService;

    const useCase = new ProcessGameOverUseCase(
      roomService,
      gameEventLogService,
    );

    await useCase.execute({
      roomId: 'room-1',
      winningTeam: 0,
      teamScores: { 0: { play: 3, total: 10 }, 1: { play: 0, total: 6 } },
      resetDelayMs: 5000,
    });

    expect(gameEventLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: 'room-1',
        actionType: 'player_stats_updated',
      }),
    );
  });
});
