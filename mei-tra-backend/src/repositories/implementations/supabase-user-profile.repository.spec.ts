import { SupabaseUserProfileRepository } from './supabase-user-profile.repository';
import { SupabaseService } from '../../database/supabase.service';
import { RoomStatus } from '../../types/room.types';

describe('SupabaseUserProfileRepository account deletion helpers', () => {
  it('marks account deletion started durably on the profile row', async () => {
    const row = {
      id: 'user-1',
      username: 'user',
      display_name: 'User',
      avatar_url: null,
      created_at: '2026-04-01T00:00:00.000Z',
      updated_at: '2026-04-01T00:00:00.000Z',
      last_seen_at: '2026-04-01T00:00:00.000Z',
      account_deletion_started_at: '2026-04-02T00:00:00.000Z',
      games_played: 0,
      games_won: 0,
      total_score: 0,
      preferences: {
        notifications: true,
        sound: true,
        theme: 'dark',
        fontSize: 'standard',
      },
    };
    const rpc = jest.fn().mockResolvedValue({ data: row, error: null });
    const from = jest.fn();
    const repository = new SupabaseUserProfileRepository({
      client: { from, rpc },
    } as unknown as SupabaseService);

    await expect(
      repository.markAccountDeletionStarted('user-1'),
    ).resolves.toMatchObject({
      id: 'user-1',
      accountDeletionStartedAt: new Date('2026-04-02T00:00:00.000Z'),
    });
    expect(rpc).toHaveBeenCalledWith('mark_account_deletion_started', {
      p_user_id: 'user-1',
    });
    expect(from).not.toHaveBeenCalled();
  });

  it('propagates concurrent room-membership rejection from the marker RPC', async () => {
    const rpcError = {
      code: 'PT409',
      message: 'account_deletion_blocked user=user-1',
    };
    const rpc = jest.fn().mockResolvedValue({ data: null, error: rpcError });
    const repository = new SupabaseUserProfileRepository({
      client: { rpc },
    } as unknown as SupabaseService);

    await expect(repository.markAccountDeletionStarted('user-1')).rejects.toBe(
      rpcError,
    );
    expect(rpc).toHaveBeenCalledWith('mark_account_deletion_started', {
      p_user_id: 'user-1',
    });
  });

  it('checks account active status from the durable deletion marker', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({
      data: { id: 'user-1' },
      error: null,
    });
    const is = jest.fn().mockReturnValue({ maybeSingle });
    const eq = jest.fn().mockReturnValue({ is });
    const select = jest.fn().mockReturnValue({ eq });
    const from = jest.fn((table: string) => {
      if (table === 'user_profiles') {
        return { select };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
    const repository = new SupabaseUserProfileRepository({
      client: { from },
    } as unknown as SupabaseService);

    await expect(repository.isAccountActive('user-1')).resolves.toBe(true);
    expect(select).toHaveBeenCalledWith('id');
    expect(eq).toHaveBeenCalledWith('id', 'user-1');
    expect(is).toHaveBeenCalledWith('account_deletion_started_at', null);
  });

  it('finds active room participation and active hosted rooms as deletion blockers', async () => {
    const roomPlayersIn = jest.fn().mockResolvedValue({
      data: [
        {
          room_id: 'room-playing',
          rooms: { status: RoomStatus.PLAYING },
        },
      ],
      error: null,
    });
    const roomPlayersEq = jest.fn().mockReturnValue({ in: roomPlayersIn });
    const roomPlayersSelect = jest.fn().mockReturnValue({ eq: roomPlayersEq });

    const roomsIn = jest.fn().mockResolvedValue({
      data: [{ id: 'room-waiting', status: RoomStatus.WAITING }],
      error: null,
    });
    const roomsEq = jest.fn().mockReturnValue({ in: roomsIn });
    const roomsSelect = jest.fn().mockReturnValue({ eq: roomsEq });

    const from = jest.fn((table: string) => {
      if (table === 'room_players') {
        return { select: roomPlayersSelect };
      }

      if (table === 'rooms') {
        return { select: roomsSelect };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
    const repository = new SupabaseUserProfileRepository({
      client: { from },
    } as unknown as SupabaseService);

    await expect(
      repository.findAccountDeletionBlockers('user-1'),
    ).resolves.toEqual([
      {
        roomId: 'room-playing',
        status: RoomStatus.PLAYING,
        reason: 'participant',
      },
      {
        roomId: 'room-waiting',
        status: RoomStatus.WAITING,
        reason: 'host',
      },
    ]);
    expect(roomPlayersIn).toHaveBeenCalledWith('rooms.status', [
      RoomStatus.WAITING,
      RoomStatus.READY,
      RoomStatus.PLAYING,
    ]);
    expect(roomsIn).toHaveBeenCalledWith('status', [
      RoomStatus.WAITING,
      RoomStatus.READY,
      RoomStatus.PLAYING,
    ]);
  });

  it('delegates all account reference anonymization to the atomic RPC', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: {
        anonymized_room_player_count: 1,
        anonymized_room_count: 1,
        anonymized_game_state_count: 1,
        anonymized_game_history_count: 1,
      },
      error: null,
    });
    const from = jest.fn();
    const repository = new SupabaseUserProfileRepository({
      client: { from, rpc },
    } as unknown as SupabaseService);

    await expect(
      repository.anonymizeAccountReferences('user-1'),
    ).resolves.toEqual({
      anonymizedRoomPlayerCount: 1,
      anonymizedRoomCount: 1,
      anonymizedGameStateCount: 1,
      anonymizedGameHistoryCount: 1,
    });

    expect(rpc).toHaveBeenCalledWith('anonymize_account_references', {
      p_user_id: 'user-1',
    });
    expect(from).not.toHaveBeenCalled();
  });

  it('propagates an atomic RPC failure without falling back to partial writes', async () => {
    const rpcError = new Error('account anonymization transaction aborted');
    const rpc = jest.fn().mockResolvedValue({ data: null, error: rpcError });
    const from = jest.fn();
    const repository = new SupabaseUserProfileRepository({
      client: { from, rpc },
    } as unknown as SupabaseService);

    await expect(repository.anonymizeAccountReferences('user-1')).rejects.toBe(
      rpcError,
    );
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(from).not.toHaveBeenCalled();
  });

  it('maps a second idempotent RPC result without reimplementing persistence', async () => {
    const rpc = jest
      .fn()
      .mockResolvedValueOnce({
        data: {
          anonymized_room_player_count: 1,
          anonymized_room_count: 1,
          anonymized_game_state_count: 1,
          anonymized_game_history_count: 1,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          anonymized_room_player_count: 0,
          anonymized_room_count: 0,
          anonymized_game_state_count: 0,
          anonymized_game_history_count: 0,
        },
        error: null,
      });
    const repository = new SupabaseUserProfileRepository({
      client: { rpc },
    } as unknown as SupabaseService);

    await expect(
      repository.anonymizeAccountReferences('user-1'),
    ).resolves.toEqual({
      anonymizedRoomPlayerCount: 1,
      anonymizedRoomCount: 1,
      anonymizedGameStateCount: 1,
      anonymizedGameHistoryCount: 1,
    });
    await expect(
      repository.anonymizeAccountReferences('user-1'),
    ).resolves.toEqual({
      anonymizedRoomPlayerCount: 0,
      anonymizedRoomCount: 0,
      anonymizedGameStateCount: 0,
      anonymizedGameHistoryCount: 0,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, 'anonymize_account_references', {
      p_user_id: 'user-1',
    });
  });
});
