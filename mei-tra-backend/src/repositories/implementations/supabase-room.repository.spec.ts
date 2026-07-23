import { SupabaseRoomRepository } from './supabase-room.repository';
import { SupabaseService } from '../../database/supabase.service';
import { RoomStatus } from '../../types/room.types';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('SupabaseRoomRepository', () => {
  function createRoomRow(id: string, name: string, createdAt: string) {
    return {
      id,
      name,
      host_id: `${id}-host`,
      status: RoomStatus.WAITING,
      settings: {
        maxPlayers: 4,
        isPrivate: false,
        password: null,
        teamAssignmentMethod: 'random' as const,
        pointsToWin: 7,
        allowSpectators: true,
      },
      created_at: createdAt,
      updated_at: createdAt,
      last_activity_at: createdAt,
    };
  }

  function createPlayerRow(
    roomId: string,
    playerId: string,
    joinedAt: string,
    overrides: Partial<{
      socket_id: string | null;
      user_id: string | null;
      name: string;
      team: number;
      is_host: boolean;
      is_ready: boolean;
      is_com: boolean;
      seat_index: number;
    }> = {},
  ) {
    return {
      id: `${roomId}-${playerId}`,
      room_id: roomId,
      player_id: playerId,
      socket_id: overrides.socket_id ?? `${playerId}-socket`,
      user_id: overrides.user_id ?? playerId,
      name: overrides.name ?? playerId,
      team: overrides.team ?? 0,
      is_ready: overrides.is_ready ?? false,
      is_host: overrides.is_host ?? false,
      is_com: overrides.is_com ?? false,
      joined_at: joinedAt,
      seat_index: overrides.seat_index ?? 0,
    };
  }

  it('batches room player lookup for findAll and preserves player ordering', async () => {
    const roomsData = [
      createRoomRow('room-2', 'Second room', '2026-04-16T01:00:00.000Z'),
      createRoomRow('room-1', 'First room', '2026-04-16T00:00:00.000Z'),
    ];
    const roomPlayersData = [
      createPlayerRow('room-1', 'player-1', '2026-04-16T00:00:30.000Z', {
        is_host: true,
        seat_index: 0,
      }),
      createPlayerRow('room-1', 'player-2', '2026-04-16T00:01:00.000Z', {
        seat_index: 1,
      }),
      createPlayerRow('room-2', 'player-3', '2026-04-16T01:00:30.000Z', {
        seat_index: 0,
      }),
    ];

    const roomsOrder = jest
      .fn()
      .mockResolvedValue({ data: roomsData, error: null });
    const roomsSelect = jest.fn().mockReturnValue({ order: roomsOrder });

    const playerOrderBySeatIndex = jest
      .fn()
      .mockResolvedValue({ data: roomPlayersData, error: null });
    const playerOrderByRoomId = jest.fn().mockReturnValue({
      order: playerOrderBySeatIndex,
    });
    const playerIn = jest.fn().mockReturnValue({ order: playerOrderByRoomId });
    const playersSelect = jest.fn().mockReturnValue({ in: playerIn });

    const from = jest.fn((table: string) => {
      if (table === 'rooms') {
        return { select: roomsSelect };
      }

      if (table === 'room_players') {
        return { select: playersSelect };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const supabaseService = {
      client: { from },
    } as unknown as SupabaseService;

    const repository = new SupabaseRoomRepository(supabaseService);

    const rooms = await repository.findAll();

    expect(from).toHaveBeenCalledTimes(2);
    expect(playerIn).toHaveBeenCalledWith('room_id', ['room-2', 'room-1']);
    expect(playerOrderByRoomId).toHaveBeenCalledWith('room_id', {
      ascending: true,
    });
    expect(playerOrderBySeatIndex).toHaveBeenCalledWith('seat_index', {
      ascending: true,
    });
    expect(rooms).toHaveLength(2);
    expect(rooms[0].id).toBe('room-2');
    expect(rooms[0].players.map((player) => player.playerId)).toEqual([
      'player-3',
    ]);
    expect(rooms[1].players.map((player) => player.playerId)).toEqual([
      'player-1',
      'player-2',
    ]);
  });

  it('queries recent finished rooms by user ordered by last activity', async () => {
    const roomsData = [
      {
        ...createRoomRow('room-1', 'Finished room', '2026-04-16T00:00:00.000Z'),
        status: RoomStatus.FINISHED,
      },
    ];
    const roomPlayersData = [
      createPlayerRow('room-1', 'player-1', '2026-04-16T00:01:00.000Z'),
    ];

    const limitMock = jest
      .fn()
      .mockResolvedValue({ data: roomsData, error: null });
    const orderMock = jest.fn().mockReturnValue({ limit: limitMock });
    const eqUserMock = jest.fn().mockReturnValue({ order: orderMock });
    const eqStatusMock = jest.fn().mockReturnValue({ eq: eqUserMock });
    const roomsSelect = jest.fn().mockReturnValue({ eq: eqStatusMock });

    const playerOrderByJoinedAt = jest
      .fn()
      .mockResolvedValue({ data: roomPlayersData, error: null });
    const playerOrderByRoomId = jest.fn().mockReturnValue({
      order: playerOrderByJoinedAt,
    });
    const playerIn = jest.fn().mockReturnValue({ order: playerOrderByRoomId });
    const playersSelect = jest.fn().mockReturnValue({ in: playerIn });

    const from = jest.fn((table: string) => {
      if (table === 'rooms') {
        return { select: roomsSelect };
      }

      if (table === 'room_players') {
        return { select: playersSelect };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const repository = new SupabaseRoomRepository({
      client: { from },
    } as unknown as SupabaseService);

    const rooms = await repository.findRecentFinishedByUserId('user-1', 10);

    expect(roomsSelect).toHaveBeenCalledWith('*, room_players!inner(user_id)');
    expect(eqStatusMock).toHaveBeenCalledWith('status', RoomStatus.FINISHED);
    expect(eqUserMock).toHaveBeenCalledWith('room_players.user_id', 'user-1');
    expect(orderMock).toHaveBeenCalledWith('last_activity_at', {
      ascending: false,
    });
    expect(limitMock).toHaveBeenCalledWith(10);
    expect(rooms).toHaveLength(1);
    expect(rooms[0].status).toBe(RoomStatus.FINISHED);
  });

  it('returns false when the DB rejects adding a deleting user to room_players', async () => {
    const existingSingle = jest.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const existingEqPlayerId = jest.fn().mockReturnValue({
      single: existingSingle,
    });
    const existingEqRoomId = jest.fn().mockReturnValue({
      eq: existingEqPlayerId,
    });
    const seatLimit = jest.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const seatOrder = jest.fn().mockReturnValue({
      limit: seatLimit,
    });
    const seatEq = jest.fn().mockReturnValue({
      order: seatOrder,
    });
    const select = jest.fn((columns: string) => {
      if (columns === 'player_id') {
        return { eq: existingEqRoomId };
      }
      if (columns === 'seat_index') {
        return { eq: seatEq };
      }

      throw new Error(`Unexpected select: ${columns}`);
    });
    const insert = jest.fn().mockResolvedValue({
      error: {
        message: 'account_deletion_in_progress user=user-1',
        code: 'PT403',
      },
    });
    const from = jest.fn((table: string) => {
      if (table === 'room_players') {
        return { select, insert };
      }

      if (table === 'rooms') {
        return {
          update: jest.fn(),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
    const repository = new SupabaseRoomRepository({
      client: { from },
    } as unknown as SupabaseService);

    await expect(
      repository.addPlayer('room-1', {
        socketId: 'socket-1',
        playerId: 'player-1',
        userId: 'user-1',
        name: 'User',
        team: 0,
        isReady: false,
        isHost: false,
        isCOM: false,
        hand: [],
        isPasser: false,
        joinedAt: new Date('2026-04-01T00:00:00.000Z'),
      }),
    ).resolves.toBe(false);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        room_id: 'room-1',
        player_id: 'player-1',
        user_id: 'user-1',
      }),
    );
  });

  it('installs a room_players trigger so roster RPC writes cannot race account deletion', () => {
    const triggerMigration = readFileSync(
      join(
        __dirname,
        '../../../supabase/migrations/20260723162619_reject_deleting_room_players.sql',
      ),
      'utf8',
    );
    const lockMigration = readFileSync(
      join(
        __dirname,
        '../../../supabase/migrations/20260723165711_serialize_account_deletion_room_membership.sql',
      ),
      'utf8',
    );
    const migration = `${triggerMigration}\n${lockMigration}`;

    expect(migration).toContain(
      'CREATE TRIGGER reject_deleting_room_player_user',
    );
    expect(migration).toContain('BEFORE INSERT OR UPDATE OF user_id');
    expect(migration).toContain('CREATE TRIGGER reject_deleting_room_host');
    expect(migration).toContain('BEFORE INSERT OR UPDATE OF host_id');
    expect(migration).toContain('account_deletion_started_at IS NOT NULL');
    expect(migration).toContain("ERRCODE = 'PT403'");
    expect(migration).toContain(
      'create or replace function public.mark_account_deletion_started',
    );
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain('meitra-account-room-membership');
    expect(migration).toContain('account_deletion_blocked');
    expect(migration).toContain('persist_room_roster_atomic');
  });
});
