import { DisconnectGatewayEffectsService } from '../disconnect-gateway-effects.service';
import { IRoomService } from '../interfaces/room-service.interface';
import { RoomMembershipService } from '../room-membership.service';
import { asSeatId } from '../../types/identity.types';

const membershipServiceStub = (
  overrides: Partial<RoomMembershipService> = {},
): RoomMembershipService =>
  ({
    markDisconnected: jest.fn(),
    startDisconnectTimeout: jest.fn(),
    finishDisconnectTimeout: jest.fn(),
    ...overrides,
  }) as unknown as RoomMembershipService;

describe('DisconnectGatewayEffectsService', () => {
  it('ignores disconnect cleanup after the room has been deleted', async () => {
    const roomService = {
      getRoom: jest.fn().mockResolvedValue(null),
      getRoomGameState: jest.fn(),
    } as unknown as IRoomService;
    const service = new DisconnectGatewayEffectsService(
      roomService,
      {} as never,
      membershipServiceStub(),
    );

    const result = await service.prepareDisconnect({
      roomId: 'deleted-room',
      socketId: 'socket-1',
    });

    expect(result).toBeNull();
    expect(roomService.getRoomGameState).not.toHaveBeenCalled();
  });

  it('reassigns host and emits disconnect events', async () => {
    const state = {
      players: [
        {
          playerId: 'player-1',
          name: 'Host',
          hand: [],
          team: 0,
          isPasser: false,
        },
      ],
      teamAssignments: {} as Record<string, 0 | 1>,
      gamePhase: 'play' as const,
    };
    const roomGameState = {
      getState: jest.fn(() => state),
      saveState: jest.fn().mockResolvedValue(undefined),
      findSessionUserBySocketId: jest.fn(() => ({
        socketId: 'socket-1',
        playerId: 'player-1',
        name: 'Host',
        userId: 'user-1',
        isAuthenticated: true,
      })),
      applyPlayerConnectionState: jest.fn().mockResolvedValue(undefined),
      getPlayerConnectionState: jest.fn(() => ({
        socketId: 'socket-1',
        userId: 'user-1',
        isAuthenticated: true,
      })),
      getTransportPlayers: jest.fn(() => [{ playerId: 'player-1' }]),
      setDisconnectTimeout: jest.fn(),
    };
    const initialRoom = {
      id: 'room-1',
      name: 'Room 1',
      status: 'playing',
      hostSeatId: asSeatId('player-1'),
      maxPlayers: 4,
      players: [
        {
          playerId: 'player-1',
          name: 'Host',
          isCOM: false,
          socketId: 'socket-1',
          team: 0,
          isReady: true,
          isHost: true,
          joinedAt: new Date(),
        },
        {
          playerId: 'player-2',
          name: 'Other',
          isCOM: false,
          socketId: 'socket-2',
          team: 1,
          isReady: true,
          isHost: false,
          joinedAt: new Date(),
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
      pointsToWin: 7,
      teamAssignmentMethod: 'random' as const,
    };
    const updatedRoom = {
      ...initialRoom,
      hostSeatId: asSeatId('player-2'),
      players: initialRoom.players.map((player) => ({
        ...player,
        isHost: player.playerId === 'player-2',
      })),
    };
    const roomService = {
      getRoomGameState: jest.fn().mockResolvedValue(roomGameState),
      getRoom: jest
        .fn()
        .mockResolvedValueOnce(initialRoom)
        .mockResolvedValueOnce(updatedRoom),
      updateRoom: jest.fn().mockResolvedValue(updatedRoom),
      listRooms: jest.fn().mockResolvedValue([updatedRoom]),
    } as unknown as IRoomService;
    const roomUpdateGatewayEffectsService = {
      buildRoomEvents: jest.fn().mockResolvedValue([
        {
          scope: 'room',
          roomId: 'room-1',
          event: 'room-sync',
          payload: { room: updatedRoom, players: [{ playerId: 'player-1' }] },
        },
        {
          scope: 'room',
          roomId: 'room-1',
          event: 'room-updated',
          payload: updatedRoom,
        },
        {
          scope: 'room',
          roomId: 'room-1',
          event: 'update-players',
          payload: [{ playerId: 'player-1' }],
        },
      ]),
      buildRoomsListEvent: jest.fn(({ rooms }: { rooms: unknown[] }) => ({
        scope: 'all',
        event: 'rooms-list',
        payload: rooms,
      })),
      buildPlayersEvent: jest.fn(({ players }: { players: unknown[] }) => ({
        scope: 'room',
        roomId: 'room-1',
        event: 'update-players',
        payload: players,
      })),
    };

    const service = new DisconnectGatewayEffectsService(
      roomService,
      roomUpdateGatewayEffectsService as never,
      membershipServiceStub({
        markDisconnected: jest.fn().mockResolvedValue({
          userId: 'user-1',
          roomId: 'room-1',
          playerId: 'player-1',
          status: 'disconnected',
          membershipVersion: 3,
          transitionId: 'transition-disconnect',
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSeenAt: new Date(),
        }),
      }),
    );

    const result = await service.prepareDisconnect({
      roomId: 'room-1',
      socketId: 'socket-1',
      displayName: 'Host Display',
    });

    expect(result?.playerId).toBe('player-1');
    expect(result?.timeoutMode).toBe('convert-to-com');
    expect(roomGameState.applyPlayerConnectionState).toHaveBeenCalledWith(
      'player-1',
      { socketId: '' },
    );
    expect(roomService.updateRoom).toHaveBeenCalledWith('room-1', {
      hostSeatId: asSeatId('player-2'),
    });
    expect(result?.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'room-updated',
          payload: updatedRoom,
        }),
        expect.objectContaining({
          event: 'rooms-list',
          payload: [updatedRoom],
        }),
      ]),
    );
    expect(
      roomUpdateGatewayEffectsService.buildRoomsListEvent,
    ).toHaveBeenCalledWith({
      rooms: [updatedRoom],
      scope: 'all',
    });
    const disconnectEvent = result?.events.find(
      (event) => event.event === 'player-disconnected',
    );
    expect(disconnectEvent).toEqual(
      expect.objectContaining({
        payload: {
          seatId: 'player-1',
          playerName: 'Host Display',
          roomId: 'room-1',
        },
      }),
    );
  });

  it('converts lobby players to vacant COM seats on disconnect timeout', async () => {
    const roomGameState = {
      getPlayerConnectionState: jest.fn(() => ({ socketId: '' })),
      getState: jest.fn(() => ({ players: [] })),
    };
    const roomService = {
      getRoomGameState: jest.fn().mockResolvedValue(roomGameState),
      getRoom: jest.fn().mockResolvedValue({ id: 'room-1' }),
      leaveRoom: jest.fn().mockResolvedValue(true),
      listRooms: jest.fn().mockResolvedValue([]),
    } as unknown as IRoomService;
    const roomUpdateGatewayEffectsService = {
      buildRoomEvents: jest.fn().mockResolvedValue([]),
      buildRoomsListEvent: jest.fn(() => ({
        scope: 'all',
        event: 'rooms-list',
        payload: [],
      })),
    };

    const service = new DisconnectGatewayEffectsService(
      roomService,
      roomUpdateGatewayEffectsService as never,
      membershipServiceStub(),
    );

    const events = await service.buildTimeoutEvents({
      roomId: 'room-1',
      playerId: 'player-1',
      playerName: 'Player 1',
      timeoutMode: 'remove-player',
    });

    expect(roomService.leaveRoom).toHaveBeenCalledWith('room-1', 'player-1', {
      releaseMembership: false,
    });
    expect(events).toEqual([
      {
        scope: 'all',
        event: 'rooms-list',
        payload: [],
      },
    ]);
  });

  it('keeps a reconnected lobby player when an old timeout fires', async () => {
    const roomGameState = {
      getPlayerConnectionState: jest.fn(() => ({ socketId: 'socket-new' })),
    };
    const roomService = {
      getRoomGameState: jest.fn().mockResolvedValue(roomGameState),
      getRoom: jest.fn().mockResolvedValue({ id: 'room-1' }),
      leaveRoom: jest.fn(),
    } as unknown as IRoomService;
    const service = new DisconnectGatewayEffectsService(
      roomService,
      {} as never,
      membershipServiceStub(),
    );

    const events = await service.buildTimeoutEvents({
      roomId: 'room-1',
      playerId: 'player-1',
      playerName: 'Player 1',
      timeoutMode: 'remove-player',
    });

    expect(events).toEqual([]);
    expect(roomService.leaveRoom).not.toHaveBeenCalled();
  });

  it('requires the player to still be disconnected before timeout conversion', async () => {
    const roomService = {
      getRoom: jest.fn().mockResolvedValue({ id: 'room-1', status: 'playing' }),
      convertPlayerToCOM: jest.fn().mockResolvedValue(false),
    } as unknown as IRoomService;
    const service = new DisconnectGatewayEffectsService(
      roomService,
      {} as never,
      membershipServiceStub(),
    );

    const events = await service.buildTimeoutEvents({
      roomId: 'room-1',
      playerId: 'player-1',
      playerName: 'Player 1',
      timeoutMode: 'convert-to-com',
    });

    expect(events).toEqual([]);
    expect(roomService.convertPlayerToCOM).toHaveBeenCalledWith(
      'room-1',
      'player-1',
      { requireDisconnected: true, releaseMembership: false },
    );
  });

  it('ignores a stale socket disconnect after a newer socket reconnects', async () => {
    const roomGameState = {
      getState: jest.fn(() => ({
        players: [{ playerId: 'player-1', name: 'Player 1', team: 0 }],
        teamAssignments: {},
        gamePhase: 'play',
      })),
      findSessionUserBySocketId: jest.fn(() => ({
        socketId: 'socket-old',
        playerId: 'player-1',
        userId: 'user-1',
        name: 'Player 1',
      })),
      getPlayerConnectionState: jest.fn(() => ({
        socketId: 'socket-new',
        userId: 'user-1',
      })),
      applyPlayerConnectionState: jest.fn(),
    };
    const roomService = {
      getRoom: jest.fn().mockResolvedValue({
        id: 'room-1',
        players: [
          {
            playerId: 'player-1',
            userId: 'user-1',
            socketId: 'socket-new',
          },
        ],
      }),
      getRoomGameState: jest.fn().mockResolvedValue(roomGameState),
    } as unknown as IRoomService;
    const markDisconnected = jest.fn();
    const service = new DisconnectGatewayEffectsService(
      roomService,
      {} as never,
      membershipServiceStub({ markDisconnected }),
    );

    const result = await service.prepareDisconnect({
      roomId: 'room-1',
      socketId: 'socket-old',
    });

    expect(result).toBeNull();
    expect(markDisconnected).not.toHaveBeenCalled();
    expect(roomGameState.applyPlayerConnectionState).not.toHaveBeenCalled();
  });

  it('ignores an old timeout after membership version changes', async () => {
    const convertPlayerToCOM = jest.fn();
    const roomService = {
      getRoom: jest.fn().mockResolvedValue({ id: 'room-1', status: 'playing' }),
      convertPlayerToCOM,
    } as unknown as IRoomService;
    const startDisconnectTimeout = jest.fn().mockResolvedValue(null);
    const finishDisconnectTimeout = jest.fn();
    const service = new DisconnectGatewayEffectsService(
      roomService,
      {} as never,
      membershipServiceStub({
        startDisconnectTimeout,
        finishDisconnectTimeout,
      }),
    );

    const events = await service.buildTimeoutEvents({
      roomId: 'room-1',
      playerId: 'player-1',
      playerName: 'Player 1',
      timeoutMode: 'convert-to-com',
      membership: {
        userId: 'user-1',
        roomId: 'room-1',
        seatId: asSeatId('player-1'),
        status: 'disconnected',
        membershipVersion: 3,
        transitionId: 'disconnect-transition',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSeenAt: new Date(),
      },
    });

    expect(events).toEqual([]);
    expect(convertPlayerToCOM).not.toHaveBeenCalled();
    expect(finishDisconnectTimeout).not.toHaveBeenCalled();
  });

  it('finishes the timeout lease inside the atomic COM conversion', async () => {
    const movingMembership = {
      userId: 'user-1',
      roomId: 'room-1',
      seatId: asSeatId('player-1'),
      status: 'moving' as const,
      membershipVersion: 4,
      transitionId: 'timeout-transition',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSeenAt: new Date(),
    };
    const blowState = {
      currentTrump: null,
      currentHighestDeclaration: {
        seatId: asSeatId('com-timeout'),
        trumpType: 'herz',
        numberOfPairs: 7,
        timestamp: 1,
      },
      declarations: [],
      actionHistory: [],
      lastPasserSeatId: null,
      isRoundCancelled: false,
      currentBlowIndex: 0,
    };
    const roomGameState = {
      getState: jest.fn(() => ({ players: [], blowState })),
    };
    const roomService = {
      getRoom: jest.fn().mockResolvedValue({ id: 'room-1', status: 'playing' }),
      getRoomGameState: jest.fn().mockResolvedValue(roomGameState),
      convertPlayerToCOM: jest.fn().mockResolvedValue(true),
      listRooms: jest.fn().mockResolvedValue([]),
    } as unknown as IRoomService;
    const finishDisconnectTimeout = jest.fn().mockResolvedValue('completed');
    const service = new DisconnectGatewayEffectsService(
      roomService,
      {
        buildRoomEvents: jest.fn().mockResolvedValue([]),
        buildRoomsListEvent: jest.fn(() => ({
          scope: 'all',
          event: 'rooms-list',
          payload: [],
        })),
      } as never,
      membershipServiceStub({
        startDisconnectTimeout: jest.fn().mockResolvedValue(movingMembership),
        finishDisconnectTimeout,
      }),
    );

    const events = await service.buildTimeoutEvents({
      roomId: 'room-1',
      playerId: 'player-1',
      playerName: 'Player 1',
      timeoutMode: 'convert-to-com',
      membership: { ...movingMembership, status: 'disconnected' },
    });

    expect(roomService.convertPlayerToCOM).toHaveBeenCalledWith(
      'room-1',
      'player-1',
      {
        requireDisconnected: true,
        releaseMembership: false,
        membershipMutation: {
          type: 'complete-disconnect-timeout',
          userId: 'user-1',
          expectedVersion: 4,
          transitionId: 'timeout-transition',
        },
      },
    );
    expect(finishDisconnectTimeout).not.toHaveBeenCalled();
    expect(events).toContainEqual({
      scope: 'room',
      roomId: 'room-1',
      event: 'blow-updated',
      payload: {
        declarations: [],
        actionHistory: [],
        currentHighest: {
          seatId: 'com-timeout',
          team: undefined,
          trumpType: 'herz',
          numberOfPairs: 7,
          timestamp: 1,
        },
        lastPasserSeatId: null,
      },
    });
  });
});
