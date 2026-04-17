import { SupabaseRoomRepository } from './supabase-room.repository';
import { SupabaseService } from '../../database/supabase.service';
import { RoomStatus } from '../../types/room.types';

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
      hand: string[];
      is_passer: boolean;
      has_broken: boolean;
      has_required_broken: boolean;
    }> = {},
  ) {
    return {
      id: `${roomId}-${playerId}`,
      room_id: roomId,
      player_id: playerId,
      socket_id: overrides.socket_id ?? `${playerId}-socket`,
      user_id: overrides.user_id ?? playerId,
      name: overrides.name ?? playerId,
      hand: overrides.hand ?? [],
      team: overrides.team ?? 0,
      is_passer: overrides.is_passer ?? false,
      has_broken: overrides.has_broken ?? false,
      has_required_broken: overrides.has_required_broken ?? false,
      is_ready: overrides.is_ready ?? false,
      is_host: overrides.is_host ?? false,
      joined_at: joinedAt,
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
      }),
      createPlayerRow('room-1', 'player-2', '2026-04-16T00:01:00.000Z'),
      createPlayerRow('room-2', 'player-3', '2026-04-16T01:00:30.000Z'),
    ];

    const roomsOrder = jest
      .fn()
      .mockResolvedValue({ data: roomsData, error: null });
    const roomsSelect = jest.fn().mockReturnValue({ order: roomsOrder });

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
    expect(playerOrderByJoinedAt).toHaveBeenCalledWith('joined_at', {
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
});
