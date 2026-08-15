import { asSeatId } from '../../types/identity.types';
import { UpdateTeamNamesUseCase } from '../update-team-names.use-case';
import { IRoomService } from '../../services/interfaces/room-service.interface';
import { RoomStatus } from '../../types/room.types';

describe('UpdateTeamNamesUseCase', () => {
  const waitingRoom = {
    id: 'room-1',
    hostSeatId: asSeatId('host'),
    status: RoomStatus.WAITING,
    settings: {
      maxPlayers: 4,
      isPrivate: false,
      password: null,
      teamAssignmentMethod: 'random',
      pointsToWin: 5,
      allowSpectators: true,
    },
    players: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    lastActivityAt: new Date(),
  };

  it('updates normalized team names while waiting', async () => {
    const updatedRoom = {
      ...waitingRoom,
      settings: {
        ...waitingRoom.settings,
        teamNames: { 0: '東軍', 1: '西軍' },
      },
    };
    const roomService = {
      getRoom: jest.fn().mockResolvedValue(waitingRoom),
      updateRoom: jest.fn().mockResolvedValue(updatedRoom),
    } as Partial<IRoomService> as IRoomService;
    const useCase = new UpdateTeamNamesUseCase(roomService);

    const result = await useCase.execute({
      roomId: 'room-1',
      actorSeatId: asSeatId('host'),
      teamNames: {
        0: '  東軍  ',
        1: '西軍',
      },
    });

    expect(result).toEqual({ success: true, updatedRoom });
    expect(roomService.updateRoom).toHaveBeenCalledWith('room-1', {
      settings: {
        ...waitingRoom.settings,
        teamNames: { 0: '東軍', 1: '西軍' },
      },
    });
  });

  it('rejects non-host updates', async () => {
    const roomService = {
      getRoom: jest.fn().mockResolvedValue(waitingRoom),
      updateRoom: jest.fn(),
    } as Partial<IRoomService> as IRoomService;
    const useCase = new UpdateTeamNamesUseCase(roomService);

    const result = await useCase.execute({
      roomId: 'room-1',
      actorSeatId: asSeatId('guest'),
      teamNames: { 0: '東軍', 1: '西軍' },
    });

    expect(result).toEqual({
      success: false,
      error: 'Only the host can change team names',
    });
    expect(roomService.updateRoom).not.toHaveBeenCalled();
  });

  it('rejects updates after the game starts', async () => {
    const roomService = {
      getRoom: jest.fn().mockResolvedValue({
        ...waitingRoom,
        status: RoomStatus.PLAYING,
      }),
      updateRoom: jest.fn(),
    } as Partial<IRoomService> as IRoomService;
    const useCase = new UpdateTeamNamesUseCase(roomService);

    const result = await useCase.execute({
      roomId: 'room-1',
      actorSeatId: asSeatId('host'),
      teamNames: { 0: '東軍', 1: '西軍' },
    });

    expect(result).toEqual({
      success: false,
      error: 'Team names can only be changed while waiting',
    });
    expect(roomService.updateRoom).not.toHaveBeenCalled();
  });
});
