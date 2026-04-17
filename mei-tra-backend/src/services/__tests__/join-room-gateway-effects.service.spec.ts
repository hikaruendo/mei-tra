import { RoomStatus } from '../../types/room.types';
import { DomainPlayer } from '../../types/game.types';
import { TransportPlayer } from '../../types/player-adapters';
import { IRoomService } from '../interfaces/room-service.interface';
import { JoinRoomGatewayEffectsService } from '../join-room-gateway-effects.service';

describe('JoinRoomGatewayEffectsService', () => {
  let service: JoinRoomGatewayEffectsService;
  let roomService: jest.Mocked<IRoomService>;
  let roomUpdateGatewayEffectsService: {
    buildRoomEvents: jest.Mock;
    buildRoomsListEvent: jest.Mock;
  };

  beforeEach(() => {
    roomService = {
      createRoom: jest.fn(),
      getRoom: jest.fn(),
      updateRoom: jest.fn(),
      deleteRoom: jest.fn(),
      listRooms: jest.fn(),
      createNewRoom: jest.fn(),
      leaveRoom: jest.fn(),
      joinRoom: jest.fn(),
      updateRoomStatus: jest.fn(),
      updatePlayerInRoom: jest.fn(),
      canStartGame: jest.fn(),
      getRoomGameState: jest.fn(),
      convertPlayerToCOM: jest.fn(),
      restorePlayerFromVacantSeat: jest.fn(),
      handlePlayerReconnection: jest.fn(),
      updateUserGameStats: jest.fn(),
      updateUserLastSeen: jest.fn(),
      fillVacantSeatsWithCOM: jest.fn(),
      initCOMPlaceholders: jest.fn(),
    } as unknown as jest.Mocked<IRoomService>;

    roomUpdateGatewayEffectsService = {
      buildRoomEvents: jest.fn(),
      buildRoomsListEvent: jest.fn(({ rooms }: { rooms: unknown[] }) => ({
        scope: 'all',
        event: 'rooms-list',
        payload: rooms,
      })),
    };

    service = new JoinRoomGatewayEffectsService(
      roomService,
      roomUpdateGatewayEffectsService as never,
    );
  });

  it('builds waiting-room join effects and refreshes COM placeholders', async () => {
    const room = {
      id: 'room-1',
      name: 'Room',
      hostId: 'player-1',
      status: RoomStatus.WAITING,
      players: [
        {
          socketId: 'socket-1',
          playerId: 'player-1',
          name: 'Host',
          hand: [],
          team: 0 as const,
          isPasser: false,
          isReady: true,
          isHost: true,
          isCOM: false,
          joinedAt: new Date(),
        },
      ],
      settings: {
        maxPlayers: 4,
        isPrivate: false,
        password: null,
        teamAssignmentMethod: 'random' as const,
        pointsToWin: 10,
        allowSpectators: false,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      lastActivityAt: new Date(),
    };

    const updatedRoom = {
      ...room,
      players: [
        ...room.players,
        {
          socketId: 'com-1',
          playerId: 'com-1',
          name: 'COM 1',
          hand: [],
          team: 1 as const,
          isPasser: false,
          isReady: false,
          isHost: false,
          isCOM: true,
          joinedAt: new Date(),
        },
      ],
    };

    roomService.getRoom.mockResolvedValue(updatedRoom as never);
    roomService.getRoomGameState.mockResolvedValue({
      getState: jest.fn(() => ({
        players: updatedRoom.players.map((player) => ({
          playerId: player.playerId,
          name: player.name,
          hand: [],
          team: player.team,
          isPasser: player.isPasser ?? false,
          isCOM: player.isCOM,
        })),
      })),
      getTransportPlayers: jest.fn(
        (players: DomainPlayer[]): TransportPlayer[] =>
          players.map(
            (player): TransportPlayer => ({
              socketId: player.playerId === 'player-1' ? 'socket-1' : '',
              playerId: player.playerId,
              name: player.name,
              hand: [...player.hand],
              team: player.team,
              isPasser: player.isPasser,
              isCOM: player.isCOM,
              isHost: updatedRoom.players.find(
                (roomPlayer) => roomPlayer.playerId === player.playerId,
              )?.isHost,
            }),
          ),
      ),
    } as never);
    roomUpdateGatewayEffectsService.buildRoomEvents.mockResolvedValue([
      {
        scope: 'room',
        roomId: 'room-1',
        event: 'room-sync',
        payload: {
          room: { id: 'room-1' },
          players: [{ playerId: 'player-1' }],
        },
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
    ]);

    const result = await service.buildEffects({
      clientId: 'socket-1',
      roomId: 'room-1',
      normalizedUser: {
        socketId: 'socket-1',
        playerId: 'player-1',
        name: 'Host',
      },
      joinData: {
        room: room as never,
        isHost: true,
        roomStatus: RoomStatus.WAITING,
        roomsList: [room] as never,
      },
    });

    expect(roomService.initCOMPlaceholders).toHaveBeenCalledWith('room-1');
    expect(roomUpdateGatewayEffectsService.buildRoomEvents).toHaveBeenCalled();
    expect(
      roomUpdateGatewayEffectsService.buildRoomsListEvent,
    ).toHaveBeenCalledWith({
      rooms: [room],
      scope: 'all',
    });
    expect(result.room.players).toHaveLength(2);
    expect(
      result.events.some(
        (event) => event.event === 'room-updated' && event.roomId === 'room-1',
      ),
    ).toBe(true);
  });

  it('masks other player hands for resume payloads', async () => {
    const room = {
      id: 'room-1',
      name: 'Room',
      hostId: 'player-1',
      status: RoomStatus.PLAYING,
      players: [
        {
          socketId: 'socket-1',
          playerId: 'player-1',
          name: 'Host',
          hand: ['A'],
          team: 0 as const,
          isPasser: false,
          isReady: true,
          isHost: true,
          isCOM: false,
          joinedAt: new Date(),
        },
      ],
      settings: {
        maxPlayers: 4,
        isPrivate: false,
        password: null,
        teamAssignmentMethod: 'random' as const,
        pointsToWin: 10,
        allowSpectators: false,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      lastActivityAt: new Date(),
    };

    roomService.getRoomGameState.mockResolvedValue({
      getTransportPlayers: jest.fn(
        (players: DomainPlayer[]): TransportPlayer[] =>
          players.map(
            (player): TransportPlayer => ({
              socketId: player.playerId === 'player-1' ? 'socket-1' : '',
              playerId: player.playerId,
              name: player.name,
              hand: [...player.hand],
              team: player.team,
              isPasser: player.isPasser,
            }),
          ),
      ),
    } as never);

    const result = await service.buildEffects({
      clientId: 'socket-1',
      roomId: 'room-1',
      normalizedUser: {
        socketId: 'socket-1',
        playerId: 'player-1',
        name: 'Host',
      },
      joinData: {
        room: room as never,
        isHost: true,
        roomStatus: RoomStatus.PLAYING,
        roomsList: [room] as never,
        resumeGame: {
          message: 'resume',
          gameState: {
            players: [
              {
                playerId: 'player-1',
                name: 'Host',
                hand: ['A'],
                team: 0 as const,
                isPasser: false,
              },
              {
                playerId: 'player-2',
                name: 'Other',
                hand: ['B'],
                team: 1 as const,
                isPasser: false,
              },
            ],
            gamePhase: 'play',
            currentField: null,
            currentTurn: 'player-1',
            blowState: {
              currentTrump: null,
              currentHighestDeclaration: null,
              declarations: [],
              actionHistory: [],
              lastPasser: null,
              isRoundCancelled: false,
              currentBlowIndex: 0,
            },
            teamScores: {
              0: { play: 0, total: 0 },
              1: { play: 0, total: 0 },
            },
            negriCard: null,
            fields: [],
            roomId: 'room-1',
            pointsToWin: 10,
          },
        },
      },
    });

    const gameStateEvent = result.events.find(
      (event) => event.event === 'game-state',
    );
    expect(gameStateEvent).toBeDefined();
    expect((gameStateEvent?.payload as any).players[1].hand).toEqual([]);
    expect((gameStateEvent?.payload as any).players[0].hand).toEqual(['A']);
  });

  it('builds socket-scoped room entry events', async () => {
    const room = {
      id: 'room-1',
      name: 'Room',
      hostId: 'player-1',
      status: RoomStatus.WAITING,
      players: [
        {
          socketId: 'socket-1',
          playerId: 'player-1',
          name: 'Host',
          hand: [],
          team: 0 as const,
          isPasser: false,
          isReady: true,
          isHost: true,
          isCOM: false,
          joinedAt: new Date(),
        },
      ],
      settings: {
        maxPlayers: 4,
        isPrivate: false,
        password: null,
        teamAssignmentMethod: 'random' as const,
        pointsToWin: 10,
        allowSpectators: false,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      lastActivityAt: new Date(),
    };

    roomUpdateGatewayEffectsService.buildRoomEvents.mockResolvedValue([
      {
        scope: 'socket',
        socketId: 'socket-1',
        event: 'room-updated',
        payload: room,
      },
    ]);

    const events = await service.buildRoomEntryEvents({
      clientId: 'socket-1',
      room: room as never,
      selfPlayer: {
        playerId: 'player-1',
        name: 'Host',
        team: 0,
      },
      isHost: true,
      roomStatus: RoomStatus.WAITING,
      roomsList: [room] as never,
      roomsListScope: 'socket',
    });

    expect(
      roomUpdateGatewayEffectsService.buildRoomEvents,
    ).toHaveBeenCalledWith({
      room,
      scope: 'socket',
      socketId: 'socket-1',
    });
    expect(
      roomUpdateGatewayEffectsService.buildRoomsListEvent,
    ).toHaveBeenCalledWith({
      rooms: [room],
      scope: 'socket',
      socketId: 'socket-1',
    });
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'game-player-joined',
          scope: 'socket',
          socketId: 'socket-1',
        }),
        expect.objectContaining({
          event: 'set-room-id',
          scope: 'socket',
          socketId: 'socket-1',
          payload: 'room-1',
        }),
      ]),
    );
  });

  it('builds active reconnect events from room effects', async () => {
    const room = {
      id: 'room-1',
      name: 'Room',
      hostId: 'player-1',
      status: RoomStatus.PLAYING,
      players: [
        {
          socketId: 'socket-1',
          playerId: 'player-1',
          name: 'Host',
          hand: [],
          team: 0 as const,
          isPasser: false,
          isReady: true,
          isHost: true,
          isCOM: false,
          joinedAt: new Date(),
        },
      ],
      settings: {
        maxPlayers: 4,
        isPrivate: false,
        password: null,
        teamAssignmentMethod: 'random' as const,
        pointsToWin: 10,
        allowSpectators: false,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      lastActivityAt: new Date(),
    };

    roomUpdateGatewayEffectsService.buildRoomEvents.mockResolvedValue([
      {
        scope: 'room',
        roomId: 'room-1',
        event: 'room-sync',
        payload: {
          room: { id: 'room-1' },
          players: [{ playerId: 'player-1' }],
        },
      },
      {
        scope: 'room',
        roomId: 'room-1',
        event: 'room-updated',
        payload: room,
      },
      {
        scope: 'room',
        roomId: 'room-1',
        event: 'update-players',
        payload: [{ playerId: 'player-1' }],
      },
    ]);

    const events = await service.buildActiveReconnectEvents({
      clientId: 'socket-1',
      roomId: 'room-1',
      room: room as never,
      gameState: {
        players: [],
        gamePhase: 'play',
        currentField: null,
        currentTurn: 'player-1',
        blowState: {
          currentTrump: null,
          currentHighestDeclaration: null,
          declarations: [],
          actionHistory: [],
          lastPasser: null,
          isRoundCancelled: false,
          currentBlowIndex: 0,
        },
        teamScores: {
          0: { play: 0, total: 0 },
          1: { play: 0, total: 0 },
        },
        you: 'player-1',
        negriCard: null,
        fields: [],
        roomId: 'room-1',
        pointsToWin: 10,
      },
      reconnectToken: 'player-1',
    });

    expect(
      roomUpdateGatewayEffectsService.buildRoomEvents,
    ).toHaveBeenCalledWith({
      room,
      scope: 'room',
      roomId: 'room-1',
    });
    expect(events).toEqual([
      expect.objectContaining({
        scope: 'socket',
        socketId: 'socket-1',
        event: 'game-state',
      }),
      expect.objectContaining({
        scope: 'socket',
        socketId: 'socket-1',
        event: 'reconnect-token',
        payload: 'player-1',
      }),
      expect.objectContaining({
        scope: 'room',
        roomId: 'room-1',
        event: 'room-sync',
      }),
      expect.objectContaining({
        scope: 'room',
        roomId: 'room-1',
        event: 'update-players',
      }),
    ]);
  });
});
