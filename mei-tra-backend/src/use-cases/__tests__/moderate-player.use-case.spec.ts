import { ModeratePlayerUseCase } from '../moderate-player.use-case';
import { IRoomService } from '../../services/interfaces/room-service.interface';
import { ILeaveRoomUseCase } from '../interfaces/leave-room.use-case.interface';
import { RoomStatus } from '../../types/room.types';

describe('ModeratePlayerUseCase', () => {
  const createRoom = () => ({
    id: 'room-1',
    hostId: 'host',
    status: RoomStatus.PLAYING,
    players: [
      {
        playerId: 'host',
        isCOM: false,
        socketId: 'host-socket',
        name: 'Host',
        hand: [],
        team: 0,
        isPasser: false,
      },
      {
        playerId: 'target',
        isCOM: false,
        socketId: '',
        name: 'Target',
        hand: [],
        team: 1,
        isPasser: false,
      },
    ],
  });

  it('replaces idle or disconnected players with COM', async () => {
    const roomService = {
      getRoom: jest.fn().mockResolvedValue(createRoom()),
      getRoomGameState: jest.fn().mockResolvedValue({
        getState: () => ({
          players: [
            {
              playerId: 'target',
              name: 'Target',
              hand: [],
              team: 1,
              isPasser: false,
            },
          ],
        }),
        getPlayerConnectionState: () => ({ socketId: '' }),
      }),
      convertPlayerToCOM: jest.fn().mockResolvedValue(true),
      listRooms: jest.fn().mockResolvedValue([]),
    } as Partial<IRoomService> as IRoomService;
    const leaveRoomUseCase = {
      execute: jest.fn(),
    } as unknown as ILeaveRoomUseCase;
    const useCase = new ModeratePlayerUseCase(roomService, leaveRoomUseCase);

    const result = await useCase.execute({
      roomId: 'room-1',
      requesterPlayerId: 'host',
      targetPlayerId: 'target',
      action: 'replace-with-com',
      isPlayerIdle: false,
    });

    expect(result).toEqual(
      expect.objectContaining({ success: true, mode: 'replace-with-com' }),
    );
    expect(roomService.convertPlayerToCOM).toHaveBeenCalledWith(
      'room-1',
      'target',
    );
  });
});
