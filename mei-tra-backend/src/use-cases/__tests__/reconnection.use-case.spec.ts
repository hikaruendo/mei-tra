import { ReconnectionUseCase } from '../reconnection.use-case';
import { IRoomService } from '../../services/interfaces/room-service.interface';
import { IGameStateService } from '../../services/interfaces/game-state-service.interface';
import { RoomStatus } from '../../types/room.types';
import { UserProfile } from '../../types/user.types';

describe('ReconnectionUseCase', () => {
  it('returns active game payload for authenticated reconnection', async () => {
    const roomService = {
      getRoomGameState: jest.fn().mockResolvedValue({
        findSessionUserByUserId: jest.fn().mockReturnValue(null),
        findSessionUserByPlayerId: jest.fn().mockReturnValue(null),
        findPlayerByActorId: jest.fn().mockReturnValue({ playerId: 'p1' }),
        findPlayerByUserId: jest.fn().mockReturnValue({ playerId: 'p1' }),
        getState: () => ({
          players: [
            { playerId: 'p1', hand: ['A♠'], socketId: '', userId: 'user-1' },
            {
              playerId: 'p2',
              hand: ['K♠'],
              socketId: 'socket-2',
              userId: 'user-2',
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
      }),
      getRoom: jest.fn().mockResolvedValue({
        id: 'room-1',
        hostId: 'p1',
        status: RoomStatus.PLAYING,
        players: [],
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
        reconnectToken: 'p1',
      }),
    );
  });

  it('uses session mapping first when reconnecting to a waiting room', async () => {
    const roomPlayers = [
      {
        playerId: 'p1',
        socketId: 'stale-socket',
        userId: undefined,
        isAuthenticated: false,
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
      findSessionUserByUserId: jest.fn().mockReturnValue({
        playerId: 'p1',
        socketId: 'stale-socket',
        userId: 'user-1',
        isAuthenticated: true,
        name: 'User 1',
      }),
      findSessionUserByPlayerId: jest.fn().mockReturnValue(null),
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
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        mode: 'waiting-room',
        selfPlayerId: 'p1',
      }),
    );
  });
});
