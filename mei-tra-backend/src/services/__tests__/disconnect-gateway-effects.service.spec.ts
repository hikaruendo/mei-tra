import { DisconnectGatewayEffectsService } from '../disconnect-gateway-effects.service';
import { IRoomService } from '../interfaces/room-service.interface';

describe('DisconnectGatewayEffectsService', () => {
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
      getTransportPlayers: jest.fn(() => [{ playerId: 'player-1' }]),
      setDisconnectTimeout: jest.fn(),
    };
    const initialRoom = {
      id: 'room-1',
      name: 'Room 1',
      status: 'playing',
      hostId: 'player-1',
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
      hostId: 'player-2',
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
      hostId: 'player-2',
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
          playerId: 'player-1',
          playerName: 'Host Display',
          roomId: 'room-1',
        },
      }),
    );
  });

  it('removes lobby players on disconnect timeout', async () => {
    const roomGameState = {
      removePlayer: jest.fn(),
      getTransportPlayers: jest.fn(() => [{ playerId: 'player-1' }]),
    };
    const roomService = {
      getRoomGameState: jest.fn().mockResolvedValue(roomGameState),
    } as unknown as IRoomService;
    const roomUpdateGatewayEffectsService = {
      buildRoomEvents: jest.fn(),
      buildRoomsListEvent: jest.fn(),
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
    );

    const events = await service.buildTimeoutEvents({
      roomId: 'room-1',
      playerId: 'player-1',
      playerName: 'Player 1',
      timeoutMode: 'remove-player',
    });

    expect(roomGameState.removePlayer).toHaveBeenCalledWith('player-1');
    expect(events).toEqual([
      {
        scope: 'room',
        roomId: 'room-1',
        event: 'update-players',
        payload: [{ playerId: 'player-1' }],
      },
    ]);
  });
});
