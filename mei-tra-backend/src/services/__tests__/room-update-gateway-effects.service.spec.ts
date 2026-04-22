import { DomainPlayer } from '../../types/game.types';
import { RoomStatus } from '../../types/room.types';
import { TransportPlayer } from '../../types/player-adapters';
import { IRoomService } from '../interfaces/room-service.interface';
import { RoomUpdateGatewayEffectsService } from '../room-update-gateway-effects.service';

describe('RoomUpdateGatewayEffectsService', () => {
  it('builds transport players for a room update', async () => {
    const roomService = {
      getRoomGameState: jest.fn().mockResolvedValue({
        getState: jest.fn(() => ({
          players: [
            {
              playerId: 'player-1',
              name: 'Player 1',
              hand: [],
              team: 0,
              isPasser: false,
            },
          ],
        })),
        getTransportPlayers: jest.fn(
          (players?: DomainPlayer[]): TransportPlayer[] =>
            (players ?? []).map((player) => ({
              socketId:
                player.playerId === 'player-1' ? 'socket-1' : 'socket-2',
              playerId: player.playerId,
              name: player.name,
              hand: [...player.hand],
              team: player.team,
              isPasser: player.isPasser,
              isCOM: player.isCOM,
              isHost: player.playerId === 'player-1',
            })),
        ),
      }),
    } as Partial<IRoomService> as IRoomService;

    const service = new RoomUpdateGatewayEffectsService(roomService);
    const room = {
      id: 'room-1',
      name: 'Room',
      hostId: 'player-1',
      status: RoomStatus.WAITING,
      players: [
        {
          socketId: 'socket-1',
          playerId: 'player-1',
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
        hostId: room.hostId,
        status: room.status,
        createdAt: room.createdAt.toISOString(),
        updatedAt: room.updatedAt.toISOString(),
        lastActivityAt: room.lastActivityAt.toISOString(),
        players: [
          expect.objectContaining({
            playerId: 'player-1',
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
        playerId: 'player-1',
        socketId: 'socket-1',
        isHost: true,
      }),
    ]);
  });
});
