import { ShuffleTeamsUseCase } from '../shuffle-teams.use-case';
import { IRoomService } from '../../services/interfaces/room-service.interface';
import { IFillWithComUseCase } from '../interfaces/fill-with-com.use-case.interface';
import { RoomPlayer, RoomStatus } from '../../types/room.types';

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
      updatePlayerInRoom: jest.fn().mockResolvedValue(true),
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
    expect(roomService.updatePlayerInRoom).toHaveBeenCalledTimes(4);
    const updateCalls = jest.mocked(roomService.updatePlayerInRoom).mock.calls;
    expect(updateCalls.every(([roomId]) => roomId === 'room-1')).toBe(true);
    expect(
      updateCalls.every(
        ([, , updates]: [string, string, Partial<RoomPlayer>]) =>
          updates.team === 0 || updates.team === 1,
      ),
    ).toBe(true);
  });

  it('returns failure when empty seats cannot be filled', async () => {
    const room = {
      id: 'room-1',
      hostId: 'host',
      status: RoomStatus.WAITING,
      players: [{ playerId: 'host', team: 0 }],
      updatedAt: new Date(),
    };
    const roomService = {
      getRoom: jest.fn().mockResolvedValue(room),
      updatePlayerInRoom: jest.fn(),
    } as Partial<IRoomService> as IRoomService;
    const fillWithComUseCase = {
      execute: jest
        .fn()
        .mockResolvedValue({ success: false, error: 'fill failed' }),
    } as unknown as IFillWithComUseCase;
    const useCase = new ShuffleTeamsUseCase(roomService, fillWithComUseCase);

    const result = await useCase.execute({
      roomId: 'room-1',
      playerId: 'host',
    });

    expect(result).toEqual({ success: false, error: 'fill failed' });
    expect(roomService.updatePlayerInRoom).not.toHaveBeenCalled();
  });

  it('returns failure when any player team update fails', async () => {
    const room = {
      id: 'room-1',
      hostId: 'host',
      status: RoomStatus.WAITING,
      players: [
        { playerId: 'host', team: 0 },
        { playerId: 'player-2', team: 1 },
        { playerId: 'player-3', team: 0 },
        { playerId: 'player-4', team: 1 },
      ],
      updatedAt: new Date(),
    };
    const roomService = {
      getRoom: jest.fn().mockResolvedValue(room),
      updatePlayerInRoom: jest
        .fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true),
    } as Partial<IRoomService> as IRoomService;
    const fillWithComUseCase = {
      execute: jest.fn(),
    } as unknown as IFillWithComUseCase;
    const useCase = new ShuffleTeamsUseCase(roomService, fillWithComUseCase);

    const result = await useCase.execute({
      roomId: 'room-1',
      playerId: 'host',
    });

    expect(result).toEqual({
      success: false,
      error: 'Failed to change teams',
    });
    expect(roomService.updatePlayerInRoom).toHaveBeenCalledTimes(4);
    expect(roomService.getRoom).toHaveBeenCalledTimes(1);
  });
});
