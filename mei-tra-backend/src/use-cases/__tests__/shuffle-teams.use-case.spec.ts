import { asSeatId } from '../../types/identity.types';
import { ShuffleTeamsUseCase } from '../shuffle-teams.use-case';
import { IRoomService } from '../../services/interfaces/room-service.interface';
import { IFillWithComUseCase } from '../interfaces/fill-with-com.use-case.interface';
import { RoomPlayer, RoomStatus } from '../../types/room.types';

describe('ShuffleTeamsUseCase', () => {
  it('fills empty seats and atomically persists shuffled seats and teams', async () => {
    const room = {
      id: 'room-1',
      hostSeatId: asSeatId('host'),
      status: RoomStatus.WAITING,
      players: [
        { seatId: asSeatId('host'), team: 0 },
        { seatId: asSeatId('guest'), team: 1 },
      ],
      updatedAt: new Date(),
    };
    const updatedRoom = {
      ...room,
      players: [
        { seatId: asSeatId('host'), team: 0 },
        { seatId: asSeatId('guest'), team: 1 },
        { seatId: asSeatId('com-1'), team: 0 },
        { seatId: asSeatId('com-2'), team: 1 },
      ],
    };
    const roomGameState = {
      reconcileWaitingRoomPlayers: jest.fn().mockResolvedValue(undefined),
    };
    const roomService = {
      getRoom: jest
        .fn()
        .mockResolvedValueOnce(room)
        .mockResolvedValueOnce(updatedRoom),
      getRoomGameState: jest.fn().mockResolvedValue(roomGameState),
    } as Partial<IRoomService> as IRoomService;
    const fillWithComUseCase = {
      execute: jest.fn().mockResolvedValue({ success: true, updatedRoom }),
    } as unknown as IFillWithComUseCase;
    const useCase = new ShuffleTeamsUseCase(roomService, fillWithComUseCase);

    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
    const result = await useCase.execute({
      roomId: 'room-1',
      actorSeatId: asSeatId('host'),
    });
    randomSpy.mockRestore();

    expect(result.success).toBe(true);
    expect(fillWithComUseCase.execute).toHaveBeenCalled();
    expect(roomGameState.reconcileWaitingRoomPlayers).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ seatId: 'host', team: 1, seatIndex: 3 }),
      ]),
    );
    const [shuffledPlayers] = roomGameState.reconcileWaitingRoomPlayers.mock
      .calls[0] as [RoomPlayer[]];
    expect(
      shuffledPlayers.map((player: RoomPlayer) => player.seatIndex),
    ).toEqual([0, 1, 2, 3]);
  });

  it('returns failure when empty seats cannot be filled', async () => {
    const room = {
      id: 'room-1',
      hostSeatId: asSeatId('host'),
      status: RoomStatus.WAITING,
      players: [{ seatId: asSeatId('host'), team: 0 }],
      updatedAt: new Date(),
    };
    const roomService = {
      getRoom: jest.fn().mockResolvedValue(room),
      getRoomGameState: jest.fn(),
    } as Partial<IRoomService> as IRoomService;
    const fillWithComUseCase = {
      execute: jest
        .fn()
        .mockResolvedValue({ success: false, error: 'fill failed' }),
    } as unknown as IFillWithComUseCase;
    const useCase = new ShuffleTeamsUseCase(roomService, fillWithComUseCase);

    const result = await useCase.execute({
      roomId: 'room-1',
      actorSeatId: asSeatId('host'),
    });

    expect(result).toEqual({ success: false, error: 'fill failed' });
    expect(roomService.getRoomGameState).not.toHaveBeenCalled();
  });

  it('rejects shuffling after the game has started', async () => {
    const room = {
      id: 'room-1',
      hostSeatId: asSeatId('host'),
      status: RoomStatus.PLAYING,
      players: [
        { seatId: asSeatId('host'), team: 0 },
        { seatId: asSeatId('player-2'), team: 1 },
        { seatId: asSeatId('player-3'), team: 0 },
        { seatId: asSeatId('player-4'), team: 1 },
      ],
      updatedAt: new Date(),
    };
    const roomService = {
      getRoom: jest.fn().mockResolvedValue(room),
      getRoomGameState: jest.fn(),
    } as Partial<IRoomService> as IRoomService;
    const fillWithComUseCase = {
      execute: jest.fn(),
    } as unknown as IFillWithComUseCase;
    const useCase = new ShuffleTeamsUseCase(roomService, fillWithComUseCase);

    const result = await useCase.execute({
      roomId: 'room-1',
      actorSeatId: asSeatId('host'),
    });

    expect(result).toEqual({
      success: false,
      error: 'Teams can only be shuffled while waiting',
    });
    expect(fillWithComUseCase.execute).not.toHaveBeenCalled();
    expect(roomService.getRoomGameState).not.toHaveBeenCalled();
  });

  it('returns failure when the atomic roster update fails', async () => {
    const room = {
      id: 'room-1',
      hostSeatId: asSeatId('host'),
      status: RoomStatus.WAITING,
      players: [
        { seatId: asSeatId('host'), team: 0 },
        { seatId: asSeatId('player-2'), team: 1 },
        { seatId: asSeatId('player-3'), team: 0 },
        { seatId: asSeatId('player-4'), team: 1 },
      ],
      updatedAt: new Date(),
    };
    const roomGameState = {
      reconcileWaitingRoomPlayers: jest.fn().mockRejectedValue(new Error('db')),
    };
    const roomService = {
      getRoom: jest.fn().mockResolvedValue(room),
      getRoomGameState: jest.fn().mockResolvedValue(roomGameState),
    } as Partial<IRoomService> as IRoomService;
    const fillWithComUseCase = {
      execute: jest.fn(),
    } as unknown as IFillWithComUseCase;
    const useCase = new ShuffleTeamsUseCase(roomService, fillWithComUseCase);

    const result = await useCase.execute({
      roomId: 'room-1',
      actorSeatId: asSeatId('host'),
    });

    expect(result).toEqual({
      success: false,
      error: 'Failed to change teams',
    });
    expect(roomGameState.reconcileWaitingRoomPlayers).toHaveBeenCalledTimes(1);
    expect(roomService.getRoom).toHaveBeenCalledTimes(1);
  });
});
