import { SupabaseService } from '../../database/supabase.service';
import { RoomMembershipService } from '../room-membership.service';

describe('RoomMembershipService', () => {
  const row = {
    user_id: 'user-1',
    room_id: 'room-1',
    player_id: 'player-1',
    status: 'active' as const,
    membership_version: 4,
    transition_id: 'transition-existing',
    created_at: '2026-08-03T00:00:00.000Z',
    updated_at: '2026-08-03T00:01:00.000Z',
    last_seen_at: '2026-08-03T00:01:00.000Z',
  };

  let rpc: jest.Mock;
  let service: RoomMembershipService;

  beforeEach(() => {
    rpc = jest.fn();
    const supabase = {
      client: { rpc },
    } as unknown as SupabaseService;
    service = new RoomMembershipService(supabase);
  });

  it('reuses the moving reservation transition when claiming a created room', async () => {
    jest.spyOn(service, 'get').mockResolvedValue({
      userId: 'user-1',
      roomId: null,
      playerId: 'player-1',
      status: 'moving',
      membershipVersion: 1,
      transitionId: 'transition-moving',
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      lastSeenAt: new Date(row.last_seen_at),
    });
    rpc.mockResolvedValue({
      data: {
        result: 'claimed',
        membership: {
          ...row,
          transition_id: 'transition-moving',
        },
      },
      error: null,
    });

    const result = await service.claim('user-1', 'room-1', 'player-1');

    expect(rpc).toHaveBeenCalledWith('claim_room_membership', {
      p_user_id: 'user-1',
      p_room_id: 'room-1',
      p_player_id: 'player-1',
      p_transition_id: 'transition-moving',
    });
    expect(result.result).toBe('claimed');
    expect(result.membership.membershipVersion).toBe(4);
  });

  it('returns the authoritative membership when a cross-room claim conflicts', async () => {
    jest.spyOn(service, 'get').mockResolvedValue(null);
    rpc.mockResolvedValue({
      data: { result: 'conflict', membership: row },
      error: null,
    });

    const result = await service.claim('user-1', 'room-2', 'player-1');

    expect(result.result).toBe('conflict');
    expect(result.membership.roomId).toBe('room-1');
    expect(result.membership.membershipVersion).toBe(4);
  });

  it('surfaces stale compare-and-set releases without deleting a newer claim', async () => {
    rpc.mockResolvedValue({
      data: { result: 'stale', membership: row },
      error: null,
    });

    await expect(service.release('user-1', 'room-1', 3)).resolves.toBe('stale');
  });

  it('marks only the current active membership as disconnected', async () => {
    jest.spyOn(service, 'get').mockResolvedValue({
      userId: 'user-1',
      roomId: 'room-1',
      playerId: 'player-1',
      status: 'active',
      membershipVersion: 4,
      transitionId: 'transition-existing',
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      lastSeenAt: new Date(row.last_seen_at),
    });
    rpc.mockResolvedValue({
      data: {
        result: 'disconnected',
        membership: {
          ...row,
          status: 'disconnected',
          membership_version: 5,
          transition_id: 'transition-disconnect',
        },
      },
      error: null,
    });

    const result = await service.markDisconnected('user-1', 'room-1');

    expect(result?.status).toBe('disconnected');
    expect(result?.membershipVersion).toBe(5);
    expect(rpc).toHaveBeenCalledWith(
      'mark_room_membership_disconnected',
      expect.objectContaining({
        p_user_id: 'user-1',
        p_room_id: 'room-1',
        p_expected_version: 4,
      }),
    );
  });

  it('holds a moving lease while a disconnect timeout mutates the room', async () => {
    rpc.mockResolvedValueOnce({
      data: {
        result: 'started',
        membership: {
          ...row,
          status: 'moving',
          membership_version: 6,
          transition_id: 'transition-timeout',
        },
      },
      error: null,
    });

    const timeoutMembership = await service.startDisconnectTimeout(
      'user-1',
      'room-1',
      5,
    );

    expect(timeoutMembership?.status).toBe('moving');
    rpc.mockResolvedValueOnce({
      data: { result: 'completed' },
      error: null,
    });
    if (!timeoutMembership) {
      throw new Error('Expected timeout membership');
    }
    await expect(
      service.finishDisconnectTimeout(timeoutMembership, true),
    ).resolves.toBe('completed');
    expect(rpc).toHaveBeenLastCalledWith('finish_room_membership_timeout', {
      p_user_id: 'user-1',
      p_room_id: 'room-1',
      p_expected_version: 6,
      p_transition_id: 'transition-timeout',
      p_succeeded: true,
    });
  });
});
