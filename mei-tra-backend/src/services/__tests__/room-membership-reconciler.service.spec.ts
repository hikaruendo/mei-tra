import { IRoomService } from '../interfaces/room-service.interface';
import { RoomMembershipReconcilerService } from '../room-membership-reconciler.service';
import { RoomMembershipService } from '../room-membership.service';
import { ActiveRoomMembership } from '../../types/room-membership.types';

describe('RoomMembershipReconcilerService', () => {
  const membership: ActiveRoomMembership = {
    userId: 'user-1',
    roomId: 'room-authoritative',
    playerId: 'player-1',
    status: 'active',
    membershipVersion: 4,
    transitionId: 'transition-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSeenAt: new Date(),
  };

  it('removes a duplicate seat while preserving the authoritative room', async () => {
    const authoritativePlayer = {
      playerId: 'player-1',
      userId: 'user-1',
      isAuthenticated: true,
    };
    const roomService = {
      getRoom: jest.fn().mockResolvedValue({
        id: 'room-authoritative',
        players: [authoritativePlayer],
      }),
      listRooms: jest.fn().mockResolvedValue([
        { id: 'room-authoritative', players: [authoritativePlayer] },
        {
          id: 'room-duplicate',
          players: [
            {
              playerId: 'player-stale',
              userId: 'user-1',
              isAuthenticated: true,
            },
          ],
        },
      ]),
      leaveRoom: jest.fn().mockResolvedValue(true),
    } as unknown as IRoomService;
    const membershipService = {
      list: jest.fn().mockResolvedValue([membership]),
      release: jest.fn(),
      cancelReservation: jest.fn(),
    } as unknown as RoomMembershipService;
    const service = new RoomMembershipReconcilerService(
      roomService,
      membershipService,
    );

    await service.reconcile();

    expect(roomService.leaveRoom).toHaveBeenCalledTimes(1);
    expect(roomService.leaveRoom).toHaveBeenCalledWith(
      'room-duplicate',
      'player-stale',
    );
    expect(membershipService.release).not.toHaveBeenCalled();
  });

  it('releases a membership whose room no longer contains its player', async () => {
    const roomService = {
      getRoom: jest.fn().mockResolvedValue({
        id: 'room-authoritative',
        players: [],
      }),
      listRooms: jest.fn().mockResolvedValue([]),
      leaveRoom: jest.fn(),
    } as unknown as IRoomService;
    const membershipService = {
      list: jest.fn().mockResolvedValue([membership]),
      release: jest.fn().mockResolvedValue('released'),
      cancelReservation: jest.fn(),
    } as unknown as RoomMembershipService;
    const service = new RoomMembershipReconcilerService(
      roomService,
      membershipService,
    );

    await service.reconcile();

    expect(membershipService.release).toHaveBeenCalledWith(
      'user-1',
      'room-authoritative',
      4,
    );
  });

  it('cancels an expired room-creation reservation', async () => {
    const expiredReservation: ActiveRoomMembership = {
      ...membership,
      roomId: null,
      status: 'moving',
      updatedAt: new Date(Date.now() - 3 * 60 * 1000),
    };
    const roomService = {
      listRooms: jest.fn().mockResolvedValue([]),
    } as unknown as IRoomService;
    const membershipService = {
      list: jest.fn().mockResolvedValue([expiredReservation]),
      cancelReservation: jest.fn().mockResolvedValue(true),
    } as unknown as RoomMembershipService;
    const service = new RoomMembershipReconcilerService(
      roomService,
      membershipService,
    );

    await service.reconcile();

    expect(membershipService.cancelReservation).toHaveBeenCalledWith(
      'user-1',
      'transition-1',
    );
  });
});
