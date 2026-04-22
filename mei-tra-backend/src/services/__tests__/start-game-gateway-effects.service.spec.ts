import { StartGameGatewayEffectsService } from '../start-game-gateway-effects.service';
import { IRoomService } from '../interfaces/room-service.interface';
import { RoomUpdateGatewayEffectsService } from '../room-update-gateway-effects.service';

describe('StartGameGatewayEffectsService', () => {
  it('builds contractized start-game room events', async () => {
    const roomService = {
      getRoom: jest.fn().mockResolvedValue({
        id: 'room-1',
        players: [
          {
            playerId: 'player-1',
            socketId: 'socket-1',
            name: 'Host',
            hand: [],
            team: 0,
            isReady: true,
            isHost: true,
            joinedAt: new Date(),
          },
        ],
      }),
      getRoomGameState: jest.fn().mockResolvedValue({
        getTransportPlayers: jest.fn(() => [
          {
            socketId: 'socket-1',
            playerId: 'player-1',
            name: 'Host',
            hand: ['AS'],
            team: 0,
            isPasser: false,
            isHost: true,
          },
        ]),
      }),
    } as unknown as IRoomService;
    const roomUpdateGatewayEffectsService = {
      buildRoomEvents: jest.fn().mockResolvedValue([
        {
          scope: 'room',
          roomId: 'room-1',
          event: 'room-sync',
          payload: {
            room: { id: 'room-1' },
            players: [
              {
                playerId: 'player-1',
                team: 0,
              },
            ],
          },
        },
        {
          scope: 'room',
          roomId: 'room-1',
          event: 'room-updated',
          payload: { id: 'room-1' },
        },
        {
          scope: 'room',
          roomId: 'room-1',
          event: 'update-players',
          payload: [
            {
              playerId: 'player-1',
              team: 0,
            },
          ],
        },
      ]),
    } as unknown as RoomUpdateGatewayEffectsService;

    const service = new StartGameGatewayEffectsService(
      roomService,
      roomUpdateGatewayEffectsService,
    );

    const events = await service.buildEvents({
      roomId: 'room-1',
      players: [
        {
          playerId: 'player-1',
          name: 'Host',
          hand: ['AS'],
          team: 0,
          isPasser: false,
        },
      ],
      pointsToWin: 10,
      updatePhase: {
        phase: 'blow',
        scores: {
          0: { play: 0, total: 0 },
          1: { play: 0, total: 0 },
        },
        winner: null,
      },
      currentTurnPlayerId: 'player-1',
    });

    expect(events).toEqual([
      {
        scope: 'room',
        roomId: 'room-1',
        event: 'room-sync',
        payload: {
          room: { id: 'room-1' },
          players: [
            expect.objectContaining({
              playerId: 'player-1',
              team: 0,
            }),
          ],
        },
      },
      {
        scope: 'room',
        roomId: 'room-1',
        event: 'room-updated',
        payload: { id: 'room-1' },
      },
      {
        scope: 'room',
        roomId: 'room-1',
        event: 'update-players',
        payload: [
          expect.objectContaining({
            playerId: 'player-1',
            team: 0,
          }),
        ],
      },
      {
        scope: 'room',
        roomId: 'room-1',
        event: 'room-playing',
        payload: {
          players: [
            expect.objectContaining({
              playerId: 'player-1',
              team: 0,
            }),
          ],
        },
      },
      {
        scope: 'room',
        roomId: 'room-1',
        event: 'game-started',
        payload: {
          roomId: 'room-1',
          players: [
            expect.objectContaining({
              playerId: 'player-1',
            }),
          ],
          pointsToWin: 10,
        },
      },
      {
        scope: 'room',
        roomId: 'room-1',
        event: 'update-phase',
        payload: {
          phase: 'blow',
          scores: {
            0: { play: 0, total: 0 },
            1: { play: 0, total: 0 },
          },
          winner: null,
        },
      },
      {
        scope: 'room',
        roomId: 'room-1',
        event: 'update-turn',
        payload: 'player-1',
      },
    ]);
    const buildRoomEventsMock = jest.mocked(
      roomUpdateGatewayEffectsService.buildRoomEvents,
    );
    expect(buildRoomEventsMock).toHaveBeenCalledTimes(1);
    const [roomEventsArgs] = buildRoomEventsMock.mock.calls[0] ?? [];
    expect(roomEventsArgs).toBeDefined();
    expect(roomEventsArgs?.room.id).toBe('room-1');
    expect(roomEventsArgs?.statePlayers?.[0]?.playerId).toBe('player-1');
    expect(roomEventsArgs?.scope).toBe('room');
    expect(roomEventsArgs?.roomId).toBe('room-1');
  });
});
