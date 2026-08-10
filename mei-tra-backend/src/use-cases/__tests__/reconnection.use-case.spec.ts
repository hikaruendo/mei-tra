import { ReconnectionUseCase } from '../reconnection.use-case';
import { IRoomService } from '../../services/interfaces/room-service.interface';
import { IGameStateService } from '../../services/interfaces/game-state-service.interface';
import { RoomStatus } from '../../types/room.types';
import { UserProfile } from '../../types/user.types';
import { RoomMembershipService } from '../../services/room-membership.service';

const createRoomMembershipService = (): RoomMembershipService =>
  ({
    claim: jest
      .fn()
      .mockImplementation((userId: string, roomId: string, playerId: string) =>
        Promise.resolve({
          result: 'reconnected',
          membership: {
            userId,
            roomId,
            playerId,
            status: 'active',
            membershipVersion: 2,
            transitionId: 'transition-1',
            createdAt: new Date(),
            updatedAt: new Date(),
            lastSeenAt: new Date(),
          },
        }),
      ),
  }) as unknown as RoomMembershipService;

describe('ReconnectionUseCase', () => {
  it('does not load game state after the room has been deleted', async () => {
    const roomService = {
      getRoom: jest.fn().mockResolvedValue(null),
      getRoomGameState: jest.fn(),
    } as Partial<IRoomService> as IRoomService;
    const gameState = {
      upsertSessionUser: jest.fn(),
    } as Partial<IGameStateService> as IGameStateService;
    const useCase = new ReconnectionUseCase(
      roomService,
      gameState,
      createRoomMembershipService(),
    );

    const result = await useCase.execute({
      roomId: 'deleted-room',
      socketId: 'socket-1',
      authenticatedUser: {
        id: 'user-1',
        email: 'user@example.com',
        profile: {} as UserProfile,
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        code: 'roomUnavailable',
      }),
    );
    expect(roomService.getRoomGameState).not.toHaveBeenCalled();
  });

  it('does not load an active snapshot after the room has been deleted', async () => {
    const roomService = {
      getRoom: jest.fn().mockResolvedValue(null),
      getRoomGameState: jest.fn(),
    } as Partial<IRoomService> as IRoomService;
    const gameState = {
      upsertSessionUser: jest.fn(),
    } as Partial<IGameStateService> as IGameStateService;
    const useCase = new ReconnectionUseCase(
      roomService,
      gameState,
      createRoomMembershipService(),
    );

    const snapshot = await useCase.getActiveGameSnapshot({
      roomId: 'deleted-room',
      authenticatedUser: {
        id: 'user-1',
        email: 'user@example.com',
        profile: {} as UserProfile,
      },
    });

    expect(snapshot).toBeNull();
    expect(roomService.getRoomGameState).not.toHaveBeenCalled();
  });

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
        settings: { teamNames: undefined },
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
    const useCase = new ReconnectionUseCase(
      roomService,
      gameState,
      createRoomMembershipService(),
    );
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
      'User 1',
    );
    expect(gameState.upsertSessionUser).toHaveBeenCalledWith(
      expect.objectContaining({
        socketId: 'socket-1',
        playerId: 'seat-1',
        userId: 'user-1',
      }),
    );
  });

  it('reclaims a persisted timeout COM after an active-game restart', async () => {
    const roomGameState = {
      findSessionUserByUserId: jest.fn().mockReturnValue(null),
      findSessionUserByPlayerId: jest.fn().mockReturnValue(null),
      findPlayerByActorId: jest.fn().mockReturnValue(null),
      getState: () => ({
        players: [
          {
            playerId: 'seat-1',
            name: 'COM',
            team: 0,
            hand: ['A♠'],
            isCOM: true,
            isPasser: false,
            hasBroken: false,
            hasRequiredBroken: false,
          },
        ],
        gamePhase: 'play',
        currentPlayerIndex: 0,
        currentPlayerId: 'seat-1',
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
    const room = {
      id: 'room-1',
      hostId: 'seat-1',
      status: RoomStatus.PLAYING,
      settings: { teamNames: undefined },
      players: [
        {
          playerId: 'seat-1',
          socketId: '',
          userId: 'user-1',
          isAuthenticated: true,
          name: 'COM',
          hand: ['A♠'],
          team: 0,
          isCOM: true,
          isReady: true,
          isHost: true,
          isPasser: false,
          hasBroken: false,
          hasRequiredBroken: false,
          joinedAt: new Date(),
        },
      ],
    };
    const reconnectedRoom = {
      ...room,
      players: [
        {
          ...room.players[0],
          socketId: 'socket-new',
          name: 'Restored User',
          isCOM: false,
        },
      ],
    };
    const roomService = {
      getRoomGameState: jest.fn().mockResolvedValue(roomGameState),
      getRoom: jest
        .fn()
        .mockResolvedValueOnce(room)
        .mockResolvedValue(reconnectedRoom),
      handlePlayerReconnection: jest.fn().mockResolvedValue({ success: true }),
      listRooms: jest.fn().mockResolvedValue([]),
    } as Partial<IRoomService> as IRoomService;
    const useCase = new ReconnectionUseCase(
      roomService,
      { upsertSessionUser: jest.fn() } as unknown as IGameStateService,
      createRoomMembershipService(),
    );

    const result = await useCase.execute({
      roomId: 'room-1',
      socketId: 'socket-new',
      authenticatedUser: {
        id: 'user-1',
        email: 'user@example.com',
        profile: { displayName: 'Restored User' } as UserProfile,
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        mode: 'active-game',
        selfPlayerId: 'seat-1',
      }),
    );
    if (!result.success || result.mode !== 'active-game') {
      throw new Error('Expected an active-game reconnection result');
    }
    expect(result.room.players[0]?.name).toBe('Restored User');
    expect(result.room.players[0]?.isCOM).toBe(false);
    expect(roomService.handlePlayerReconnection).toHaveBeenCalledWith(
      'room-1',
      'seat-1',
      'socket-new',
      'user-1',
      'Restored User',
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
        gamePhase: 'play',
        currentPlayerIndex: 1,
        blowState: {
          declarations: [],
          actionHistory: [],
          currentTrump: null,
          currentHighestDeclaration: {
            playerId: 'seat-1',
            trumpType: 'zuppe',
            numberOfPairs: 7,
            timestamp: 1,
          },
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
        agari: 'J♠',
        pointsToWin: 10,
      }),
    };
    const roomService = {
      getRoomGameState: jest.fn().mockResolvedValue(roomGameState),
      getRoom: jest.fn().mockResolvedValue({
        id: 'room-1',
        hostId: 'seat-1',
        status: RoomStatus.PLAYING,
        settings: { teamNames: undefined },
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
    const useCase = new ReconnectionUseCase(
      roomService,
      gameState,
      createRoomMembershipService(),
    );

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

    expect(snapshot?.selfPlayerId).toBe('seat-1');
    expect(snapshot?.reconnectToken).toBe('seat-1');
    expect(snapshot?.currentTurnPlayerId).toBe('player-2');
    expect(snapshot?.gameState.currentTurn).toBe('player-2');
    expect(snapshot?.gameState.you).toBe('seat-1');
    expect(snapshot?.gameState.revealedAgari).toBe('J♠');
    expect(snapshot?.gameState.players).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ playerId: 'seat-1', hand: ['A♠'] }),
        expect.objectContaining({ playerId: 'player-2', hand: [] }),
      ]),
    );
    expect(roomService.handlePlayerReconnection).not.toHaveBeenCalled();
    expect(roomService.listRooms).not.toHaveBeenCalled();
    expect(gameState.upsertSessionUser).not.toHaveBeenCalled();
  });

  it('prefers currentPlayerId over a stale currentPlayerIndex in active snapshots', async () => {
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
        currentPlayerId: 'seat-1',
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
    };
    const roomService = {
      getRoomGameState: jest.fn().mockResolvedValue(roomGameState),
      getRoom: jest.fn().mockResolvedValue({
        id: 'room-1',
        hostId: 'seat-1',
        status: RoomStatus.PLAYING,
        settings: { teamNames: undefined },
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
    const useCase = new ReconnectionUseCase(
      roomService,
      gameState,
      createRoomMembershipService(),
    );

    const snapshot = await useCase.getActiveGameSnapshot({
      roomId: 'room-1',
      authenticatedUser: {
        id: 'user-1',
        email: 'user@example.com',
        profile: {} as UserProfile,
      },
    });

    expect(snapshot?.currentTurnPlayerId).toBe('seat-1');
    expect(snapshot?.gameState.currentTurn).toBe('seat-1');
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
        })
        .mockResolvedValue({
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

    const useCase = new ReconnectionUseCase(
      roomService,
      gameState,
      createRoomMembershipService(),
    );

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
      'User 1',
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

  it('prefers the unique authenticated room seat over a stale waiting-room session', async () => {
    const roomPlayers = [
      {
        playerId: 'seat-1',
        socketId: 'stale-socket',
        userId: 'user-1',
        isAuthenticated: true,
        name: 'User 1',
        hand: [],
        team: 0 as const,
        isReady: true,
        isHost: true,
        isPasser: false,
        joinedAt: new Date(),
      },
      {
        playerId: 'seat-2',
        socketId: 'other-socket',
        userId: 'user-2',
        isAuthenticated: true,
        name: 'User 2',
        hand: [],
        team: 1 as const,
        isReady: true,
        isHost: false,
        isPasser: false,
        joinedAt: new Date(),
      },
    ];
    const roomGameState = {
      findSessionUserByUserId: jest.fn().mockReturnValue({
        playerId: 'seat-2',
      }),
      findSessionUserByPlayerId: jest.fn().mockReturnValue(null),
      reconcileWaitingRoomPlayers: jest.fn().mockResolvedValue(undefined),
      getState: () => ({ players: [], gamePhase: 'waiting' }),
    };
    const roomService = {
      getRoomGameState: jest.fn().mockResolvedValue(roomGameState),
      getRoom: jest.fn().mockResolvedValue({
        id: 'room-1',
        hostId: 'seat-1',
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
    const useCase = new ReconnectionUseCase(
      roomService,
      gameState,
      createRoomMembershipService(),
    );

    const result = await useCase.execute({
      roomId: 'room-1',
      socketId: 'socket-new',
      authenticatedUser: {
        id: 'user-1',
        email: 'user@example.com',
        profile: {} as UserProfile,
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        mode: 'waiting-room',
        selfPlayerId: 'seat-1',
      }),
    );
    expect(roomService.handlePlayerReconnection).toHaveBeenCalledWith(
      'room-1',
      'seat-1',
      'socket-new',
      'user-1',
      'user@example.com',
    );
  });

  it('rejects a stale room reconnect when membership belongs to another room', async () => {
    const roomGameState = {
      getState: jest.fn(() => ({
        players: [
          {
            playerId: 'seat-1',
            name: 'User 1',
            team: 0,
            hand: [],
          },
        ],
        gamePhase: 'play',
        currentPlayerIndex: 0,
      })),
    };
    const roomService = {
      getRoom: jest.fn().mockResolvedValue({
        id: 'room-stale',
        hostId: 'seat-1',
        status: RoomStatus.PLAYING,
        players: [
          {
            playerId: 'seat-1',
            userId: 'user-1',
            isAuthenticated: true,
          },
        ],
      }),
      getRoomGameState: jest.fn().mockResolvedValue(roomGameState),
      handlePlayerReconnection: jest.fn(),
    } as Partial<IRoomService> as IRoomService;
    const membershipService = {
      claim: jest.fn().mockResolvedValue({
        result: 'conflict',
        membership: {
          userId: 'user-1',
          roomId: 'room-current',
          playerId: 'seat-current',
          status: 'active',
          membershipVersion: 4,
          transitionId: 'transition-current',
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSeenAt: new Date(),
        },
      }),
    } as unknown as RoomMembershipService;
    const useCase = new ReconnectionUseCase(
      roomService,
      { upsertSessionUser: jest.fn() } as unknown as IGameStateService,
      membershipService,
    );

    const result = await useCase.execute({
      roomId: 'room-stale',
      socketId: 'socket-1',
      authenticatedUser: {
        id: 'user-1',
        email: 'user@example.com',
        profile: {} as UserProfile,
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        code: 'sessionInvalid',
      }),
    );
    expect(roomService.handlePlayerReconnection).not.toHaveBeenCalled();
  });
});
