import { DomainPlayer } from '../../types/game.types';
import { RoomStatus } from '../../types/room.types';
import { TransportPlayer } from '../../adapters/player-adapters';
import { asSeatId } from '../../types/identity.types';
import { IRoomService } from '../interfaces/room-service.interface';
import { RoomUpdateGatewayEffectsService } from '../room-update-gateway-effects.service';

describe('RoomUpdateGatewayEffectsService', () => {
  it('builds transport players for a room update', async () => {
    const roomService = {
      getRoomGameState: jest.fn().mockResolvedValue({
        getState: jest.fn(() => ({
          players: [
            {
              seatId: asSeatId('player-1'),
              name: 'Player 1',
              hand: [],
              team: 0,
              isPasser: false,
            },
          ],
          gamePhase: 'play',
          playState: {
            currentField: {
              cards: ['J♠'],
              playedBySeatIds: [asSeatId('com-player-1')],
              baseCard: 'J♠',
              dealerSeatId: asSeatId('com-player-1'),
              isComplete: false,
            },
          },
        })),
        getTransportPlayers: jest.fn(
          (players?: DomainPlayer[]): TransportPlayer[] =>
            (players ?? []).map((player) => ({
              socketId: player.seatId === 'player-1' ? 'socket-1' : 'socket-2',
              seatId: asSeatId(player.seatId),
              name: player.name,
              hand: [...player.hand],
              team: player.team,
              isPasser: player.isPasser,
              isCOM: player.isCOM,
              isHost: player.seatId === 'player-1',
            })),
        ),
      }),
    } as Partial<IRoomService> as IRoomService;

    const service = new RoomUpdateGatewayEffectsService(roomService);
    const room = {
      id: 'room-1',
      name: 'Room',
      hostSeatId: asSeatId('player-1'),
      status: RoomStatus.WAITING,
      players: [
        {
          socketId: 'socket-1',
          seatId: asSeatId('player-1'),
          name: 'Player 1',
          hand: [],
          team: 0 as const,
          isPasser: false,
          isReady: true,
          isHost: true,
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

    const roomView = await service.buildRoomView(room as never);

    expect(roomView.room).toEqual(
      expect.objectContaining({
        id: room.id,
        name: room.name,
        hostSeatId: room.hostSeatId,
        status: room.status,
        createdAt: room.createdAt.toISOString(),
        updatedAt: room.updatedAt.toISOString(),
        lastActivityAt: room.lastActivityAt.toISOString(),
        players: [
          expect.objectContaining({
            seatId: 'player-1',
            socketId: 'socket-1',
            isHost: true,
            isReady: true,
            joinedAt: room.players[0].joinedAt.toISOString(),
          }),
        ],
      }),
    );
    expect(roomView.players).toEqual([
      expect.objectContaining({
        seatId: 'player-1',
        socketId: 'socket-1',
        isHost: true,
      }),
    ]);
    expect(roomView.currentField).toEqual({
      cards: ['J♠'],
      playedBySeatIds: ['com-player-1'],
      baseCard: 'J♠',
      dealerSeatId: asSeatId('com-player-1'),
      declaredSuit: undefined,
      isComplete: false,
    });
  });

  it('emits the canonical field after the updated player roster', async () => {
    const currentField = {
      cards: ['J♠'],
      playedBySeatIds: [asSeatId('com-player-1')],
      baseCard: 'J♠',
      dealerSeatId: asSeatId('com-player-1'),
      isComplete: false,
    };
    const roomService = {
      getRoomGameState: jest.fn().mockResolvedValue({
        getState: jest.fn(() => ({
          players: [],
          gamePhase: 'play',
          playState: { currentField },
        })),
        getTransportPlayers: jest.fn(() => []),
      }),
    } as Partial<IRoomService> as IRoomService;
    const service = new RoomUpdateGatewayEffectsService(roomService);
    const room = {
      id: 'room-1',
      name: 'Room',
      hostId: 'host',
      status: RoomStatus.PLAYING,
      players: [],
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

    const events = await service.buildRoomEvents({
      room: room as never,
      scope: 'room',
      roomId: room.id,
    });
    const fieldEventIndex = events.findIndex(
      (event) => event.event === 'field-updated',
    );

    expect(events.map((event) => event.event)).toEqual([
      'room-sync',
      'field-updated',
    ]);
    expect(fieldEventIndex).toBe(1);
    expect(events[fieldEventIndex]).toEqual({
      scope: 'room',
      roomId: 'room-1',
      event: 'field-updated',
      payload: {
        cards: ['J♠'],
        playedBySeatIds: ['com-player-1'],
        baseCard: 'J♠',
        baseSuit: undefined,
        dealerSeatId: asSeatId('com-player-1'),
        declaredSuit: undefined,
        isComplete: false,
      },
    });
  });
});
