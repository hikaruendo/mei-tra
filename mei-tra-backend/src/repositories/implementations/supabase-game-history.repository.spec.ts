import { SupabaseGameHistoryRepository } from './supabase-game-history.repository';
import { SupabaseService } from '../../database/supabase.service';
import { asSeatId } from '../../types/identity.types';

describe('SupabaseGameHistoryRepository', () => {
  it('resolves game_state_id before inserting a history entry', async () => {
    const gameStateSingle = jest.fn().mockResolvedValue({
      data: { id: 'state-1' },
      error: null,
    });
    const gameStateEq = jest.fn().mockReturnValue({ single: gameStateSingle });
    const gameStateSelect = jest.fn().mockReturnValue({ eq: gameStateEq });

    const insertSingle = jest.fn().mockResolvedValue({
      data: {
        id: 'history-1',
        room_id: 'room-1',
        game_state_id: 'state-1',
        action_type: 'card_played',
        player_id: 'player-1',
        action_data: { card: 'A' },
        timestamp: '2026-04-16T00:00:00.000Z',
      },
      error: null,
    });
    const insertSelect = jest.fn().mockReturnValue({ single: insertSingle });
    const insert = jest.fn().mockReturnValue({ select: insertSelect });

    const from = jest.fn((table: string) => {
      if (table === 'game_states') {
        return { select: gameStateSelect };
      }

      if (table === 'game_history') {
        return { insert };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const supabaseService = {
      client: { from },
    } as unknown as SupabaseService;

    const repository = new SupabaseGameHistoryRepository(supabaseService);
    const entry = await repository.create({
      roomId: 'room-1',
      actionType: 'card_played',
      playerId: 'player-1',
      actionData: { card: 'A' },
    });

    expect(insert).toHaveBeenCalledWith({
      room_id: 'room-1',
      game_state_id: 'state-1',
      action_type: 'card_played',
      actor_seat_id: null,
      actor_key_snapshot: 'player-1',
      player_id: 'player-1',
      action_data: { card: 'A' },
    });
    expect(entry.gameStateId).toBe('state-1');
    expect(entry.timestamp).toEqual(new Date('2026-04-16T00:00:00.000Z'));
  });

  it('writes a UUID actor to the canonical seat column', async () => {
    const gameStateSingle = jest.fn().mockResolvedValue({
      data: { id: 'state-1' },
      error: null,
    });
    const gameStateEq = jest.fn().mockReturnValue({ single: gameStateSingle });
    const gameStateSelect = jest.fn().mockReturnValue({ eq: gameStateEq });
    const insertSingle = jest.fn().mockResolvedValue({
      data: {
        id: 'history-1',
        room_id: 'room-1',
        game_state_id: 'state-1',
        action_type: 'card_played',
        actor_seat_id: '00000000-0000-0000-0000-000000000101',
        actor_key_snapshot: 'legacy-player',
        player_id: '00000000-0000-0000-0000-000000000101',
        action_data: {},
        timestamp: '2026-04-16T00:00:00.000Z',
      },
      error: null,
    });
    const insertSelect = jest.fn().mockReturnValue({ single: insertSingle });
    const insert = jest.fn().mockReturnValue({ select: insertSelect });
    const from = jest.fn((table: string) =>
      table === 'game_states' ? { select: gameStateSelect } : { insert },
    );
    const repository = new SupabaseGameHistoryRepository({
      client: { from },
    } as unknown as SupabaseService);
    const actorSeatId = '00000000-0000-0000-0000-000000000101';

    await repository.create({
      roomId: 'room-1',
      actionType: 'card_played',
      actorSeatId: asSeatId(actorSeatId),
      actorKeySnapshot: 'legacy-player',
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_seat_id: actorSeatId,
        actor_key_snapshot: 'legacy-player',
        player_id: actorSeatId,
      }),
    );
  });

  it('filters history entries by roundNumber after loading rows', async () => {
    const order = jest.fn().mockResolvedValue({
      data: [
        {
          id: 'history-1',
          room_id: 'room-1',
          game_state_id: 'state-1',
          action_type: 'card_played',
          player_id: 'player-1',
          action_data: { context: { roundNumber: 1 } },
          timestamp: '2026-04-16T00:00:00.000Z',
        },
        {
          id: 'history-2',
          room_id: 'room-1',
          game_state_id: 'state-1',
          action_type: 'field_completed',
          player_id: 'player-2',
          action_data: { context: { roundNumber: 2 } },
          timestamp: '2026-04-16T00:01:00.000Z',
        },
      ],
      error: null,
    });
    const eq = jest.fn().mockReturnValue({ order });
    const select = jest.fn().mockReturnValue({ eq });
    const from = jest.fn(() => ({ select }));

    const supabaseService = {
      client: { from },
    } as unknown as SupabaseService;

    const repository = new SupabaseGameHistoryRepository(supabaseService);
    const entries = await repository.findByRoomId('room-1', { roundNumber: 2 });

    expect(entries).toHaveLength(1);
    expect(entries[0]?.id).toBe('history-2');
  });

  it('filters a legacy non-UUID player key without comparing it to the UUID column', async () => {
    const order = jest.fn().mockResolvedValue({ data: [], error: null });
    const request = {
      eq: jest.fn(),
      or: jest.fn(),
      order,
    };
    request.eq.mockReturnValue(request);
    request.or.mockReturnValue(request);
    const select = jest.fn().mockReturnValue(request);
    const supabaseService = {
      client: { from: jest.fn(() => ({ select })) },
    } as unknown as SupabaseService;
    const repository = new SupabaseGameHistoryRepository(supabaseService);

    await repository.findByRoomId('room-1', { playerId: 'com-timeout-a' });

    expect(request.eq).toHaveBeenCalledWith(
      'actor_key_snapshot',
      'com-timeout-a',
    );
    expect(request.or).not.toHaveBeenCalled();
  });

  it('filters a UUID player key through canonical and legacy history columns', async () => {
    const order = jest.fn().mockResolvedValue({ data: [], error: null });
    const request = {
      eq: jest.fn(),
      or: jest.fn(),
      order,
    };
    request.eq.mockReturnValue(request);
    request.or.mockReturnValue(request);
    const select = jest.fn().mockReturnValue(request);
    const supabaseService = {
      client: { from: jest.fn(() => ({ select })) },
    } as unknown as SupabaseService;
    const repository = new SupabaseGameHistoryRepository(supabaseService);
    const playerId = '00000000-0000-0000-0000-000000000101';

    await repository.findByRoomId('room-1', { playerId });

    expect(request.or).toHaveBeenCalledWith(
      `actor_seat_id.eq.${playerId},actor_key_snapshot.eq.${playerId},player_id.eq.${playerId}`,
    );
  });

  it('deletes game history for finished rooms outside the recent limit', async () => {
    const roomsOrder = jest.fn().mockResolvedValue({
      data: [
        { id: 'room-1' },
        { id: 'room-2' },
        { id: 'room-3' },
        { id: 'room-4' },
      ],
      error: null,
    });
    const roomsEq = jest.fn().mockReturnValue({ order: roomsOrder });
    const roomsSelect = jest.fn().mockReturnValue({ eq: roomsEq });

    const historyIn = jest.fn().mockResolvedValue({ count: 2, error: null });
    const historyDelete = jest.fn().mockReturnValue({ in: historyIn });

    const from = jest.fn((table: string) => {
      if (table === 'rooms') {
        return { select: roomsSelect };
      }

      if (table === 'game_history') {
        return { delete: historyDelete };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const supabaseService = {
      client: { from },
    } as unknown as SupabaseService;

    const repository = new SupabaseGameHistoryRepository(supabaseService);

    await expect(
      repository.deleteForFinishedRoomsOutsideRecentLimit(2),
    ).resolves.toBe(2);

    expect(roomsEq).toHaveBeenCalledWith('status', 'finished');
    expect(roomsOrder).toHaveBeenCalledWith('last_activity_at', {
      ascending: false,
    });
    expect(historyDelete).toHaveBeenCalledWith({ count: 'exact' });
    expect(historyIn).toHaveBeenCalledWith('room_id', ['room-3', 'room-4']);
  });
});
