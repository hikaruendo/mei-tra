import { SupabaseGameHistoryRepository } from './supabase-game-history.repository';
import { SupabaseService } from '../../database/supabase.service';

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
      player_id: 'player-1',
      action_data: { card: 'A' },
    });
    expect(entry.gameStateId).toBe('state-1');
    expect(entry.timestamp).toEqual(new Date('2026-04-16T00:00:00.000Z'));
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
