import { GameStateFactory } from '../game-state.factory';
import { RoomJoinService } from '../room-join.service';
import { RoomMembershipService } from '../room-membership.service';
import { RoomService } from '../room.service';
import { IRoomRepository } from '../../repositories/interfaces/room.repository.interface';
import { IUserProfileRepository } from '../../repositories/interfaces/user-profile.repository.interface';
import { IComPlayerService } from '../interfaces/com-player-service.interface';
import { ActiveRoomMembershipConflictError } from '../../types/room-membership.types';
import { Room, RoomStatus } from '../../types/room.types';
import { GameStateService } from '../game-state.service';

describe('RoomService active membership lifecycle', () => {
  const room: Room = {
    id: 'room-1',
    name: 'Room 1',
    hostId: 'user-1',
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

  const membership = {
    userId: 'user-1',
    roomId: 'room-1',
    playerId: 'user-1',
    status: 'active' as const,
    membershipVersion: 2,
    transitionId: 'transition-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSeenAt: new Date(),
  };

  let roomRepository: jest.Mocked<IRoomRepository>;
  let membershipService: {
    claim: jest.Mock;
    release: jest.Mock;
    releaseByPlayer: jest.Mock;
    releaseRoom: jest.Mock;
  };
  let roomJoinService: { joinRoom: jest.Mock };
  let service: RoomService;

  beforeEach(() => {
    roomRepository = {
      delete: jest.fn(),
      update: jest.fn(),
      updateLastActivity: jest.fn(),
    } as unknown as jest.Mocked<IRoomRepository>;
    membershipService = {
      claim: jest.fn(),
      release: jest.fn().mockResolvedValue('released'),
      releaseByPlayer: jest.fn().mockResolvedValue(true),
      releaseRoom: jest.fn().mockResolvedValue(0),
    };
    roomJoinService = { joinRoom: jest.fn() };
    service = new RoomService(
      roomRepository,
      {} as IUserProfileRepository,
      {} as GameStateFactory,
      {} as IComPlayerService,
      membershipService as unknown as RoomMembershipService,
      undefined,
      undefined,
      undefined,
      undefined,
      roomJoinService as unknown as RoomJoinService,
    );
    jest.spyOn(service, 'getRoom').mockResolvedValue(room);
    jest
      .spyOn(service, 'getRoomGameState')
      .mockResolvedValue({} as GameStateService);
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('rejects a cross-room conflict before mutating the target room', async () => {
    membershipService.claim.mockResolvedValue({
      result: 'conflict',
      membership: { ...membership, roomId: 'room-existing' },
    });

    await expect(
      service.joinRoom('room-1', {
        socketId: 'socket-1',
        playerId: 'user-1',
        userId: 'user-1',
        name: 'Player 1',
      }),
    ).rejects.toBeInstanceOf(ActiveRoomMembershipConflictError);

    expect(service.getRoomGameState).not.toHaveBeenCalled();
    expect(roomJoinService.joinRoom).not.toHaveBeenCalled();
  });

  it('rolls back a fresh claim with its membership version when joining fails', async () => {
    membershipService.claim.mockResolvedValue({
      result: 'claimed',
      membership,
    });
    roomJoinService.joinRoom.mockResolvedValue(false);

    await expect(
      service.joinRoom('room-1', {
        socketId: 'socket-1',
        playerId: 'user-1',
        userId: 'user-1',
        name: 'Player 1',
      }),
    ).resolves.toBe(false);

    expect(membershipService.release).toHaveBeenCalledWith(
      'user-1',
      'room-1',
      2,
    );
    expect(membershipService.releaseByPlayer).not.toHaveBeenCalled();
  });

  it('preserves an existing same-room membership when reconnect joining fails', async () => {
    membershipService.claim.mockResolvedValue({
      result: 'reconnected',
      membership: { ...membership, membershipVersion: 3 },
    });
    roomJoinService.joinRoom.mockResolvedValue(false);

    await service.joinRoom('room-1', {
      socketId: 'socket-2',
      playerId: 'user-1',
      userId: 'user-1',
      name: 'Player 1',
    });

    expect(membershipService.release).not.toHaveBeenCalled();
  });

  it('releases all memberships when a room becomes inactive', async () => {
    roomRepository.update.mockResolvedValue({
      ...room,
      status: RoomStatus.ABANDONED,
    });

    await expect(
      service.updateRoomStatus('room-1', RoomStatus.ABANDONED),
    ).resolves.toBe(true);

    expect(membershipService.releaseRoom).toHaveBeenCalledWith('room-1');
  });
});
