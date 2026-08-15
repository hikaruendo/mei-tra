import { RoomStatus } from '../../types/room.types';
import { DomainPlayer } from '../../types/game.types';
import { TransportPlayer } from '../../adapters/player-adapters';
import { IRoomService } from '../interfaces/room-service.interface';
import { JoinRoomGatewayEffectsService } from '../join-room-gateway-effects.service';
import { asSeatId } from '../../types/identity.types';

describe('JoinRoomGatewayEffectsService', () => {
  let service: JoinRoomGatewayEffectsService;
  let roomService: jest.Mocked<IRoomService>;
  let roomUpdateGatewayEffectsService: {
    buildRoomEvents: jest.Mock;
    buildRoomsListEvent: jest.Mock;
  };

  beforeEach(() => {
    roomService = {
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
          seatId: asSeatId('player-1'),
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
          seatId: asSeatId('com-1'),
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
          seatId: player.seatId,
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
              socketId: player.seatId === 'player-1' ? 'socket-1' : '',
              seatId: asSeatId(player.seatId),
              name: player.name,
              hand: [...player.hand],
              team: player.team,
              isPasser: player.isPasser,
              isCOM: player.isCOM,
              isHost: updatedRoom.players.find(
                (roomPlayer) => roomPlayer.seatId === player.seatId,
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
          players: [{ seatId: 'player-1' }],
        },
      },
    ]);

    const result = await service.buildEffects({
      clientId: 'socket-1',
      roomId: 'room-1',
      normalizedUser: {
        socketId: 'socket-1',
        seatId: asSeatId('player-1'),
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
        (event) => event.event === 'room-sync' && event.roomId === 'room-1',
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
          seatId: asSeatId('player-1'),
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
              socketId: player.seatId === 'player-1' ? 'socket-1' : '',
              seatId: asSeatId(player.seatId),
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
        seatId: asSeatId('player-1'),
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
                seatId: asSeatId('player-1'),
                name: 'Host',
                hand: ['A'],
                team: 0 as const,
                isPasser: false,
              },
              {
                seatId: asSeatId('player-2'),
                name: 'Other',
                hand: ['B'],
                team: 1 as const,
                isPasser: false,
              },
            ],
            gamePhase: 'play',
            currentField: null,
            currentTurnSeatId: asSeatId('player-1'),
            blowState: {
              currentTrump: null,
              currentHighestDeclaration: {
                seatId: asSeatId('player-1'),
                trumpType: 'daiya',
                numberOfPairs: 6,
                timestamp: 1,
              },
              declarations: [
                {
                  seatId: asSeatId('player-1'),
                  trumpType: 'daiya',
                  numberOfPairs: 6,
                  timestamp: 1,
                },
              ],
              actionHistory: [
                {
                  type: 'declare',
                  seatId: asSeatId('player-1'),
                  trumpType: 'daiya',
                  numberOfPairs: 6,
                  timestamp: 1,
                },
              ],
              lastPasserSeatId: null,
              isRoundCancelled: false,
              currentBlowIndex: 0,
            },
            teamScores: {
              0: { play: 0, total: 0 },
              1: { play: 0, total: 0 },
            },
            negriCard: null,
            negriSeatId: null,
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
    expect(result.events).toContainEqual({
      scope: 'room',
      roomId: 'room-1',
      event: 'blow-updated',
      payload: {
        declarations: [
          {
            seatId: asSeatId('player-1'),
            trumpType: 'daiya',
            numberOfPairs: 6,
            timestamp: 1,
          },
        ],
        actionHistory: [
          {
            type: 'declare',
            seatId: asSeatId('player-1'),
            trumpType: 'daiya',
            numberOfPairs: 6,
            timestamp: 1,
          },
        ],
        currentHighest: {
          seatId: asSeatId('player-1'),
          trumpType: 'daiya',
          numberOfPairs: 6,
          timestamp: 1,
        },
        lastPasserSeatId: null,
      },
    });
    expect(result.events).toContainEqual({
      scope: 'room',
      roomId: 'room-1',
      event: 'update-turn',
      payload: 'player-1',
    });
  });

  it('uses the authenticated room player id for self join events', async () => {
    const room = {
      id: 'room-1',
      name: 'Room',
      hostId: 'actual-seat',
      status: RoomStatus.WAITING,
      players: [
        {
          socketId: 'socket-1',
          seatId: asSeatId('actual-seat'),
          userId: 'user-1',
          name: 'User 1',
          hand: [],
          team: 0 as const,
          isPasser: false,
          isReady: true,
          isHost: true,
          isCOM: false,
          joinedAt: new Date(),
        },
        {
          socketId: 'com-1',
          seatId: asSeatId('com-1'),
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

    const result = await service.buildEffects({
      clientId: 'socket-1',
      roomId: 'room-1',
      normalizedUser: {
        socketId: 'socket-1',
        seatId: asSeatId('stale-player'),
        userId: 'user-1',
        name: 'User 1',
        isAuthenticated: true,
      },
      joinData: {
        room: room as never,
        isHost: true,
        roomStatus: RoomStatus.WAITING,
        roomsList: [room] as never,
      },
    });

    const selfJoinedEvent = result.events.find(
      (event) =>
        event.scope === 'socket' && event.event === 'game-player-joined',
    );
    expect(selfJoinedEvent).toMatchObject({
      socketId: 'socket-1',
      payload: {
        seatId: asSeatId('actual-seat'),
        isSelf: true,
      },
    });
    const roomPlayerJoinedEvent = result.events.find(
      (event) => event.event === 'room-player-joined',
    );
    expect(roomPlayerJoinedEvent).toMatchObject({
      scope: 'room',
      roomId: 'room-1',
      payload: { seatId: asSeatId('actual-seat') },
    });
  });

  it('uses the authenticated room player id when masking active resume hands', async () => {
    const room = {
      id: 'room-1',
      name: 'Room',
      hostId: 'actual-seat',
      status: RoomStatus.PLAYING,
      players: [
        {
          socketId: 'socket-1',
          seatId: asSeatId('actual-seat'),
          userId: 'user-1',
          name: 'User 1',
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
              socketId: player.seatId === 'actual-seat' ? 'socket-1' : '',
              seatId: asSeatId(player.seatId),
              name: player.name,
              hand: [...player.hand],
              team: player.team,
              isPasser: player.isPasser,
              userId: player.seatId === 'actual-seat' ? 'user-1' : undefined,
            }),
          ),
      ),
    } as never);

    const result = await service.buildEffects({
      clientId: 'socket-1',
      roomId: 'room-1',
      normalizedUser: {
        socketId: 'socket-1',
        seatId: asSeatId('stale-player'),
        userId: 'user-1',
        name: 'User 1',
        isAuthenticated: true,
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
                seatId: asSeatId('actual-seat'),
                name: 'User 1',
                hand: ['A'],
                team: 0 as const,
                isPasser: false,
              },
              {
                seatId: asSeatId('other-seat'),
                name: 'Other',
                hand: ['B'],
                team: 1 as const,
                isPasser: false,
              },
            ],
            gamePhase: 'play',
            currentField: null,
            currentTurnSeatId: asSeatId('actual-seat'),
            blowState: {
              currentTrump: null,
              currentHighestDeclaration: null,
              declarations: [],
              actionHistory: [],
              lastPasserSeatId: null,
              isRoundCancelled: false,
              currentBlowIndex: 0,
            },
            teamScores: {
              0: { play: 0, total: 0 },
              1: { play: 0, total: 0 },
            },
            negriCard: null,
            negriSeatId: null,
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

    expect((gameStateEvent?.payload as any).youSeatId).toBe('actual-seat');
    expect((gameStateEvent?.payload as any).players).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          seatId: asSeatId('actual-seat'),
          hand: ['A'],
        }),
        expect.objectContaining({ seatId: asSeatId('other-seat'), hand: [] }),
      ]),
    );
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
          seatId: asSeatId('player-1'),
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
        event: 'room-sync',
        payload: { room, players: room.players },
      },
    ]);

    const events = await service.buildRoomEntryEvents({
      clientId: 'socket-1',
      room: room as never,
      selfPlayer: {
        seatId: asSeatId('player-1'),
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
          seatId: asSeatId('player-1'),
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
          players: [{ seatId: 'player-1' }],
        },
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
        currentTurnSeatId: asSeatId('player-1'),
        blowState: {
          currentTrump: null,
          currentHighestDeclaration: null,
          declarations: [],
          actionHistory: [],
          lastPasserSeatId: null,
          isRoundCancelled: false,
          currentBlowIndex: 0,
        },
        teamScores: {
          0: { play: 0, total: 0 },
          1: { play: 0, total: 0 },
        },
        youSeatId: asSeatId('player-1'),
        negriCard: null,
        negriSeatId: null,
        fields: [],
        roomId: 'room-1',
        hostSeatId: asSeatId('player-1'),
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
    ]);
  });
});
