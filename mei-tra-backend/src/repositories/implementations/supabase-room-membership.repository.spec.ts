import { SupabaseService } from '../../database/supabase.service';
import { asSeatId } from '../../types/identity.types';
import type { ActiveRoomMembership } from '../../types/room-membership.types';
import { SupabaseRoomMembershipRepository } from './supabase-room-membership.repository';

describe('SupabaseRoomMembershipRepository', () => {
  const seatId = asSeatId('00000000-0000-0000-0000-000000000101');
  const row = {
    user_id: 'user-1',
    room_id: 'room-1',
    seat_id: seatId,
    status: 'active' as const,
    membership_version: 4,
    transition_id: 'transition-existing',
    created_at: '2026-08-03T00:00:00.000Z',
    updated_at: '2026-08-03T00:01:00.000Z',
    last_seen_at: '2026-08-03T00:01:00.000Z',
  };

  it('maps the typed active membership table row', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({ data: row, error: null });
    const eq = jest.fn().mockReturnValue({ maybeSingle });
    const select = jest.fn().mockReturnValue({ eq });
    const from = jest.fn().mockReturnValue({ select });
    const repository = new SupabaseRoomMembershipRepository({
      client: { from },
    } as unknown as SupabaseService);

    await expect(repository.findByUserId('user-1')).resolves.toEqual({
      userId: 'user-1',
      roomId: 'room-1',
      seatId,
      status: 'active',
      membershipVersion: 4,
      transitionId: 'transition-existing',
      createdAt: new Date('2026-08-03T00:00:00.000Z'),
      updatedAt: new Date('2026-08-03T00:01:00.000Z'),
      lastSeenAt: new Date('2026-08-03T00:01:00.000Z'),
    });
    expect(from).toHaveBeenCalledWith('active_room_memberships');
    expect(eq).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('maps only joined and left replay events for the requested room', async () => {
    const query = {
      in: jest.fn(),
      or: jest.fn(),
      order: jest.fn(),
    };
    query.order.mockReturnValueOnce(query).mockResolvedValueOnce({
      data: [
        {
          id: 1,
          user_id: 'user-1',
          from_room_id: null,
          to_room_id: 'room-1',
          seat_id: seatId,
          event_type: 'room_claimed',
          created_at: '2026-08-03T00:00:00.000Z',
        },
        {
          id: 2,
          user_id: 'user-1',
          from_room_id: 'room-1',
          to_room_id: 'room-2',
          seat_id: seatId,
          event_type: 'room_released',
          created_at: '2026-08-03T00:01:00.000Z',
        },
      ],
      error: null,
    });
    query.in.mockReturnValue(query);
    query.or.mockReturnValue(query);
    const select = jest.fn().mockReturnValue(query);
    const from = jest.fn().mockReturnValue({ select });
    const repository = new SupabaseRoomMembershipRepository({
      client: { from },
    } as unknown as SupabaseService);

    await expect(
      repository.findReplayEventsByRoomId('room-1'),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'membership-1',
        eventType: 'player_joined',
        roomId: 'room-1',
      }),
      expect.objectContaining({
        id: 'membership-2',
        eventType: 'player_left',
        roomId: 'room-1',
      }),
    ]);
    expect(query.or).toHaveBeenCalledWith(
      'from_room_id.eq.room-1,to_room_id.eq.room-1',
    );
  });

  it('calls the generated claim RPC contract and maps its response', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: { result: 'claimed', membership: row },
      error: null,
    });
    const repository = new SupabaseRoomMembershipRepository({
      client: { rpc },
    } as unknown as SupabaseService);

    await expect(
      repository.claim('user-1', 'room-1', seatId, 'transition-1'),
    ).resolves.toMatchObject({
      result: 'claimed',
      membership: { userId: 'user-1', seatId },
    });
    expect(rpc).toHaveBeenCalledWith('claim_room_membership', {
      p_user_id: 'user-1',
      p_room_id: 'room-1',
      p_seat_id: seatId,
      p_transition_id: 'transition-1',
    });
  });

  it('maps stale disconnect mutations to null', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: { result: 'stale' },
      error: null,
    });
    const repository = new SupabaseRoomMembershipRepository({
      client: { rpc },
    } as unknown as SupabaseService);

    await expect(
      repository.startDisconnectTimeout(
        'user-1',
        'room-1',
        4,
        'transition-timeout',
      ),
    ).resolves.toBeNull();
  });

  it('rejects malformed JSON returned by a membership RPC', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: { result: 'claimed', membership: { user_id: 'user-1' } },
      error: null,
    });
    const repository = new SupabaseRoomMembershipRepository({
      client: { rpc },
    } as unknown as SupabaseService);

    await expect(
      repository.claim('user-1', 'room-1', seatId, 'transition-1'),
    ).rejects.toThrow('Room membership response has an invalid shape');
  });

  it('keeps the RPC error inside the Supabase implementation boundary', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'database unavailable' },
    });
    const repository = new SupabaseRoomMembershipRepository({
      client: { rpc },
    } as unknown as SupabaseService);

    await expect(
      repository.release('user-1', 'room-1', 4, 'transition-release'),
    ).rejects.toThrow(
      'Failed to release room membership: database unavailable',
    );
  });

  it('uses the existing timeout lease identity when completing a timeout', async () => {
    const membership: ActiveRoomMembership = {
      userId: 'user-1',
      roomId: 'room-1',
      seatId,
      status: 'moving',
      membershipVersion: 6,
      transitionId: 'transition-timeout',
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      lastSeenAt: new Date(row.last_seen_at),
    };
    const rpc = jest.fn().mockResolvedValue({
      data: { result: 'completed' },
      error: null,
    });
    const repository = new SupabaseRoomMembershipRepository({
      client: { rpc },
    } as unknown as SupabaseService);

    await expect(
      repository.finishDisconnectTimeout(membership, true),
    ).resolves.toBe('completed');
    expect(rpc).toHaveBeenCalledWith('finish_room_membership_timeout', {
      p_user_id: 'user-1',
      p_room_id: 'room-1',
      p_expected_version: 6,
      p_transition_id: 'transition-timeout',
      p_succeeded: true,
    });
  });
});
