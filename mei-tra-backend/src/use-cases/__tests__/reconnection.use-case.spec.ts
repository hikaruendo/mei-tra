import { ReconnectionUseCase } from '../reconnection.use-case';
import { IRoomService } from '../../services/interfaces/room-service.interface';
import { IGameStateService } from '../../services/interfaces/game-state-service.interface';
import { RoomStatus } from '../../types/room.types';
import { UserProfile } from '../../types/user.types';

describe('ReconnectionUseCase', () => {
  it('uses the persisted room player mapping after an active-game restart', async () => {
    const roomGameState = {
      findSessionUserByUserId: jest.fn().mockReturnValue(null),
      findSessionUserByPlayerId: jest.fn().mockReturnValue(null),
      findPlayerByActorId: jest.fn().mockReturnValue(null),
      getState: () => ({
        players: [
          {
            playerId: 'seat-1',
            name: 'User 1',
            team: 0,
            hand: ['A♠'],
            isPasser: false,
            hasBroken: false,
            hasRequiredBroken: false,
          },
          {
            playerId: 'p2',
            name: 'User 2',
            team: 1,
            hand: ['K♠'],
            isPasser: false,
            hasBroken: false,
            hasRequiredBroken: false,
          },
        ],
        gamePhase: 'play',
        currentPlayerIndex: 0,
        blowState: {
          declarations: [],
          actionHistory: [],
          currentTrump: null,
          currentHighestDeclaration: null,
          lastPasser: null,
          isRoundCancelled: false,
          currentBlowIndex: 0,
        },
        playState: {
          currentField: null,
          negriCard: null,
          neguri: {},
          fields: [],
          lastWinnerId: null,
          openDeclared: false,
          openDeclarerId: null,
        },
        teamScores: { 0: { play: 0, total: 0 }, 1: { play: 0, total: 0 } },
        pointsToWin: 10,
      }),
    };
    const roomService = {
      getRoomGameState: jest.fn().mockResolvedValue(roomGameState),
      getRoom: jest.fn().mockResolvedValue({
        id: 'room-1',
        hostId: 'seat-1',
        status: RoomStatus.PLAYING,
        players: [
          {
            playerId: 'seat-1',
            socketId: 'stale-socket',
            userId: 'user-1',
            isAuthenticated: true,
            name: 'User 1',
            hand: ['A♠'],
            team: 0,
            isReady: true,
            isHost: true,
            isPasser: false,
            hasBroken: false,
            hasRequiredBroken: false,
            joinedAt: new Date(),
          },
        ],
      }),
      handlePlayerReconnection: jest.fn().mockResolvedValue({ success: true }),
      listRooms: jest.fn().mockResolvedValue([]),
      initCOMPlaceholders: jest.fn(),
    } as Partial<IRoomService> as IRoomService;
    const gameState = {
      upsertSessionUser: jest.fn(),
    } as Partial<IGameStateService> as IGameStateService;
    const useCase = new ReconnectionUseCase(roomService, gameState);
    const profile: UserProfile = {
      id: 'user-1',
      username: 'user-1',
      displayName: 'User 1',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSeenAt: new Date(),
      gamesPlayed: 0,
      gamesWon: 0,
      totalScore: 0,
      preferences: {
        notifications: true,
        sound: true,
        theme: 'light',
        fontSize: 'standard',
      },
    };

    const result = await useCase.execute({
      roomId: 'room-1',
      socketId: 'socket-1',
      authenticatedUser: {
        id: 'user-1',
        email: 'user@example.com',
        profile,
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        mode: 'active-game',
        reconnectToken: 'seat-1',
      }),
    );
    expect(roomGameState.findPlayerByActorId).not.toHaveBeenCalled();
    expect(roomService.handlePlayerReconnection).toHaveBeenCalledWith(
      'room-1',
      'seat-1',
      'socket-1',
      'user-1',
    );
  });

  it('builds an active-game snapshot without reconnecting or mutating state', async () => {
    const roomGameState = {
      findPlayerByActorId: jest.fn().mockReturnValue(null),
      getState: () => ({
        players: [
          {
            playerId: 'seat-1',
            name: 'User 1',
            team: 0,
            hand: ['A♠'],
            isPasser: false,
            hasBroken: false,
            hasRequiredBroken: false,
          },
          {
            playerId: 'player-2',
            name: 'User 2',
            team: 1,
            hand: ['K♠'],
            isPasser: false,
            hasBroken: false,
            hasRequiredBroken: false,
          },
        ],
        gamePhase: 'blow',
        currentPlayerIndex: 1,
        blowState: {
          declarations: [],
          actionHistory: [],
          currentTrump: null,
          currentHighestDeclaration: null,
          lastPasser: null,
          isRoundCancelled: false,
          currentBlowIndex: 0,
        },
        playState: {
          currentField: null,
          negriCard: null,
          neguri: {},
          fields: [],
          lastWinnerId: null,
          openDeclared: false,
          openDeclarerId: null,
        },
        teamScores: { 0: { play: 0, total: 0 }, 1: { play: 0, total: 0 } },
        pointsToWin: 10,
      }),
      getTransportPlayers: jest.fn((players) => players),
    };
    const roomService = {
      getRoomGameState: jest.fn().mockResolvedValue(roomGameState),
      getRoom: jest.fn().mockResolvedValue({
        id: 'room-1',
        hostId: 'seat-1',
        status: RoomStatus.PLAYING,
        players: [
          {
            playerId: 'seat-1',
            socketId: 'socket-1',
            userId: 'user-1',
            isAuthenticated: true,
            name: 'User 1',
            hand: ['A♠'],
            team: 0,
            isReady: true,
            isHost: true,
            isPasser: false,
            joinedAt: new Date(),
          },
        ],
      }),
      handlePlayerReconnection: jest.fn(),
      listRooms: jest.fn(),
    } as Partial<IRoomService> as IRoomService;
    const gameState = {
      upsertSessionUser: jest.fn(),
    } as Partial<IGameStateService> as IGameStateService;
    const useCase = new ReconnectionUseCase(roomService, gameState);

    const snapshot = await useCase.getActiveGameSnapshot({
      roomId: 'room-1',
      authenticatedUser: {
        id: 'user-1',
        email: 'user@example.com',
        profile: {
          id: 'user-1',
          username: 'user-1',
          displayName: 'User 1',
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSeenAt: new Date(),
          gamesPlayed: 0,
          gamesWon: 0,
          totalScore: 0,
          preferences: {
            notifications: true,
            sound: true,
            theme: 'light',
            fontSize: 'standard',
          },
        },
      },
    });

    expect(snapshot).toEqual(
      expect.objectContaining({
        selfPlayerId: 'seat-1',
        reconnectToken: 'seat-1',
        currentTurnPlayerId: 'player-2',
        gameState: expect.objectContaining({
          currentTurn: 'player-2',
          you: 'seat-1',
        }),
      }),
    );
    expect(roomService.handlePlayerReconnection).not.toHaveBeenCalled();
    expect(roomService.listRooms).not.toHaveBeenCalled();
    expect(gameState.upsertSessionUser).not.toHaveBeenCalled();
  });

  it('reconciles persisted players before reconnecting to a waiting room', async () => {
    const roomPlayers = [
      {
        playerId: 'p1',
        socketId: 'stale-socket',
        userId: 'user-1',
        isAuthenticated: true,
        name: 'User 1',
        hand: [],
        team: 0,
        isReady: true,
        isHost: true,
        isPasser: false,
        joinedAt: new Date('2026-04-16T00:00:00.000Z'),
      },
    ];
    const roomGameState = {
      findSessionUserByUserId: jest.fn().mockReturnValue(null),
      findSessionUserByPlayerId: jest.fn().mockReturnValue(null),
      reconcileWaitingRoomPlayers: jest.fn().mockResolvedValue(undefined),
      getState: () => ({
        players: [],
        gamePhase: 'waiting',
      }),
    };
    const roomService = {
      getRoomGameState: jest.fn().mockResolvedValue(roomGameState),
      getRoom: jest
        .fn()
        .mockResolvedValueOnce({
          id: 'room-1',
          hostId: 'p1',
          status: RoomStatus.WAITING,
          players: roomPlayers,
        })
        .mockResolvedValueOnce({
          id: 'room-1',
          hostId: 'p1',
          status: RoomStatus.WAITING,
          players: roomPlayers,
        }),
      handlePlayerReconnection: jest.fn().mockResolvedValue({ success: true }),
      listRooms: jest.fn().mockResolvedValue([]),
      initCOMPlaceholders: jest.fn().mockResolvedValue(undefined),
    } as Partial<IRoomService> as IRoomService;
    const gameState = {
      upsertSessionUser: jest.fn(),
    } as Partial<IGameStateService> as IGameStateService;

    const useCase = new ReconnectionUseCase(roomService, gameState);

    const result = await useCase.execute({
      roomId: 'room-1',
      socketId: 'socket-1',
      authenticatedUser: {
        id: 'user-1',
        email: 'user@example.com',
        profile: {
          id: 'user-1',
          username: 'user-1',
          displayName: 'User 1',
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSeenAt: new Date(),
          gamesPlayed: 0,
          gamesWon: 0,
          totalScore: 0,
          preferences: {
            notifications: true,
            sound: true,
            theme: 'light',
            fontSize: 'standard',
          },
        },
      },
    });

    expect(roomService.handlePlayerReconnection).toHaveBeenCalledWith(
      'room-1',
      'p1',
      'socket-1',
      'user-1',
    );
    expect(roomGameState.reconcileWaitingRoomPlayers).toHaveBeenCalledWith(
      roomPlayers,
    );
    expect(
      roomGameState.reconcileWaitingRoomPlayers.mock.invocationCallOrder[0],
    ).toBeLessThan(
      (roomService.initCOMPlaceholders as jest.Mock).mock
        .invocationCallOrder[0],
    );
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        mode: 'waiting-room',
        selfPlayerId: 'p1',
      }),
    );
  });
});
