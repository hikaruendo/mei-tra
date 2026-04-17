import { ShuffleTeamsUseCase } from '../shuffle-teams.use-case';
import { IRoomService } from '../../services/interfaces/room-service.interface';
import { IFillWithComUseCase } from '../interfaces/fill-with-com.use-case.interface';
import { RoomStatus } from '../../types/room.types';

describe('ShuffleTeamsUseCase', () => {
  it('fills empty seats before shuffling and persists the updated room', async () => {
    const room = {
      id: 'room-1',
      hostId: 'host',
      status: RoomStatus.WAITING,
      players: [
        { playerId: 'host', team: 0 },
        { playerId: 'guest', team: 1 },
      ],
      updatedAt: new Date(),
    };
    const updatedRoom = {
      ...room,
      players: [
        { playerId: 'host', team: 0 },
        { playerId: 'guest', team: 1 },
        { playerId: 'com-1', team: 0 },
        { playerId: 'com-2', team: 1 },
      ],
    };
    const roomService = {
      getRoom: jest
        .fn()
        .mockResolvedValueOnce(room)
        .mockResolvedValueOnce(updatedRoom),
      updateRoom: jest.fn().mockResolvedValue(updatedRoom),
    } as Partial<IRoomService> as IRoomService;
    const fillWithComUseCase = {
      execute: jest.fn().mockResolvedValue({ success: true, updatedRoom }),
    } as unknown as IFillWithComUseCase;
    const useCase = new ShuffleTeamsUseCase(roomService, fillWithComUseCase);

    const result = await useCase.execute({
      roomId: 'room-1',
      playerId: 'host',
    });

    expect(result.success).toBe(true);
    expect(fillWithComUseCase.execute).toHaveBeenCalled();
    expect(roomService.updateRoom).toHaveBeenCalled();
  });
});
