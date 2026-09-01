import type { IRoomMembershipRepository } from '../../repositories/interfaces/room-membership.repository.interface';
import { asSeatId } from '../../types/identity.types';
import type { ActiveRoomMembership } from '../../types/room-membership.types';
import { RoomMembershipService } from '../room-membership.service';

describe('RoomMembershipService', () => {
  const seatId = asSeatId('00000000-0000-0000-0000-000000000101');
  const membership: ActiveRoomMembership = {
    userId: 'user-1',
    roomId: 'room-1',
    seatId,
    status: 'active',
    membershipVersion: 4,
    transitionId: 'transition-existing',
    createdAt: new Date('2026-08-03T00:00:00.000Z'),
    updatedAt: new Date('2026-08-03T00:01:00.000Z'),
    lastSeenAt: new Date('2026-08-03T00:01:00.000Z'),
  };

  let repository: jest.Mocked<IRoomMembershipRepository>;
  let service: RoomMembershipService;

  beforeEach(() => {
    repository = {
      findByUserId: jest.fn(),
      findAll: jest.fn(),
      findReplayEventsByRoomId: jest.fn(),
      reserve: jest.fn(),
      claim: jest.fn(),
      cancelReservation: jest.fn(),
      release: jest.fn(),
      releaseBySeat: jest.fn(),
      releaseRoom: jest.fn(),
      markDisconnected: jest.fn(),
      startDisconnectTimeout: jest.fn(),
      finishDisconnectTimeout: jest.fn(),
    };
    service = new RoomMembershipService(repository);
  });

  it('reuses the moving reservation transition when claiming a created room', async () => {
    const movingMembership = {
      ...membership,
      roomId: null,
      status: 'moving' as const,
      transitionId: 'transition-moving',
    };
    repository.findByUserId.mockResolvedValue(movingMembership);
    repository.claim.mockResolvedValue({
      result: 'claimed',
      membership: { ...membership, transitionId: 'transition-moving' },
    });

    const result = await service.claim('user-1', 'room-1', seatId);

    expect(repository.claim).toHaveBeenCalledWith(
      'user-1',
      'room-1',
      seatId,
      'transition-moving',
    );
    expect(result.result).toBe('claimed');
  });

  it('returns the authoritative membership when a cross-room claim conflicts', async () => {
    repository.findByUserId.mockResolvedValue(null);
    repository.claim.mockResolvedValue({
      result: 'conflict',
      membership,
    });

    const result = await service.claim('user-1', 'room-2', seatId);

    expect(repository.claim).toHaveBeenCalledWith(
      'user-1',
      'room-2',
      seatId,
      expect.any(String),
    );
    expect(result.membership.roomId).toBe('room-1');
    expect(result.membership.membershipVersion).toBe(4);
  });

  it('surfaces stale compare-and-set releases without deleting a newer claim', async () => {
    repository.release.mockResolvedValue('stale');

    await expect(service.release('user-1', 'room-1', 3)).resolves.toBe('stale');
    expect(repository.release).toHaveBeenCalledWith(
      'user-1',
      'room-1',
      3,
      expect.any(String),
    );
  });

  it('marks only the current active membership as disconnected', async () => {
    repository.findByUserId.mockResolvedValue(membership);
    repository.markDisconnected.mockResolvedValue({
      ...membership,
      status: 'disconnected',
      membershipVersion: 5,
    });

    const result = await service.markDisconnected('user-1', 'room-1');

    expect(result?.status).toBe('disconnected');
    expect(repository.markDisconnected).toHaveBeenCalledWith(
      'user-1',
      'room-1',
      4,
      expect.any(String),
    );
  });

  it('holds a moving lease while a disconnect timeout mutates the room', async () => {
    const timeoutMembership = {
      ...membership,
      status: 'moving' as const,
      membershipVersion: 6,
      transitionId: 'transition-timeout',
    };
    repository.startDisconnectTimeout.mockResolvedValue(timeoutMembership);
    repository.finishDisconnectTimeout.mockResolvedValue('completed');

    const result = await service.startDisconnectTimeout('user-1', 'room-1', 5);
    if (!result) {
      throw new Error('Expected timeout membership');
    }
    await expect(service.finishDisconnectTimeout(result, true)).resolves.toBe(
      'completed',
    );

    expect(repository.startDisconnectTimeout).toHaveBeenCalledWith(
      'user-1',
      'room-1',
      5,
      expect.any(String),
    );
    expect(repository.finishDisconnectTimeout).toHaveBeenCalledWith(
      timeoutMembership,
      true,
    );
  });
});
