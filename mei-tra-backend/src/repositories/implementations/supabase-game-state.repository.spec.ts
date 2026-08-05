import { SupabaseService } from '../../database/supabase.service';
import { GameState } from '../../types/game.types';
import { RoomPlayer } from '../../types/room.types';
import { SupabaseGameStateRepository } from './supabase-game-state.repository';

describe('SupabaseGameStateRepository', () => {
  const gameStateRow = {
    id: 'game-state-1',
    room_id: '00000000-0000-0000-0000-000000000001',
    state_data: {
      playerStates: {
        'player-1': {
          hand: ['S1'],
          isPasser: true,
          hasBroken: true,
          hasRequiredBroken: false,
        },
      },
      deck: [],
      blowState: {
        currentTrump: null,
        currentHighestDeclaration: null,
        declarations: [],
        actionHistory: [],
        lastPasser: null,
        isRoundCancelled: false,
        currentBlowIndex: 0,
      },
      playState: {
        currentField: null,
        negriCard: null,
        neguri: {},
        fields: [],
        lastWinnerId: null,
        openDeclared: false,
        openDeclarerId: null,
      },
    },
    current_player_id: 'player-1',
    game_phase: 'waiting' as const,
    round_number: 1,
    points_to_win: 8,
    team_scores: {
      0: { play: 0, total: 0 },
      1: { play: 0, total: 0 },
    },
    team_score_records: { 0: [], 1: [] },
    version: 4,
    created_at: '2026-07-19T00:00:00.000Z',
    updated_at: '2026-07-19T00:00:00.000Z',
  };

  const roomPlayerRow = {
    id: 'room-player-1',
    room_id: gameStateRow.room_id,
    player_id: 'player-1',
    socket_id: null,
    user_id: '00000000-0000-0000-0000-000000000101',
    name: 'Current name',
    team: 1,
    is_ready: true,
    is_host: true,
    is_com: false,
    joined_at: '2026-07-19T00:00:00.000Z',
    seat_index: 0,
  };

  function createState(): GameState {
    return {
      version: 4,
      players: [
        {
          playerId: 'player-1',
          name: 'Current name',
          hand: ['S1'],
          team: 1,
          isPasser: true,
          isCOM: false,
          hasBroken: true,
          hasRequiredBroken: false,
        },
      ],
      currentPlayerId: 'player-1',
      currentPlayerIndex: 0,
      gamePhase: 'waiting',
      deck: [],
      teamScores: {
        0: { play: 0, total: 0 },
        1: { play: 0, total: 0 },
      },
      teamScoreRecords: { 0: [], 1: [] },
      blowState: gameStateRow.state_data.blowState,
      playState: gameStateRow.state_data.playState,
      roundNumber: 1,
      pointsToWin: 8,
      teamAssignments: { 'player-1': 1 },
    };
  }

  function createRoomPlayer(): RoomPlayer {
    return {
      socketId: 'transient-socket',
      playerId: 'player-1',
      userId: roomPlayerRow.user_id,
      isAuthenticated: true,
      name: 'Current name',
      hand: ['S1'],
      team: 1,
      isPasser: true,
      isCOM: false,
      hasBroken: true,
      hasRequiredBroken: false,
      isReady: true,
      isHost: true,
      joinedAt: new Date(roomPlayerRow.joined_at),
    };
  }

  it('loads identity from room_players and gameplay from playerStates', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: {
        gameState: gameStateRow,
        roomPlayers: [roomPlayerRow],
      },
      error: null,
    });
    const repository = new SupabaseGameStateRepository({
      client: { rpc },
    } as unknown as SupabaseService);

    const state = await repository.findByRoomId(gameStateRow.room_id);

    expect(state?.version).toBe(4);
    expect(state?.players).toEqual([
      expect.objectContaining({
        playerId: 'player-1',
        name: 'Current name',
        team: 1,
        hand: ['S1'],
        isPasser: true,
        hasBroken: true,
      }),
    ]);
  });

  it('uses room_players seat order as the authoritative roster', async () => {
    const secondRoomPlayer = {
      ...roomPlayerRow,
      id: 'room-player-2',
      player_id: 'player-2',
      name: 'Second player',
      team: 0,
      seat_index: 1,
    };
    const rpc = jest.fn().mockResolvedValue({
      data: {
        gameState: {
          ...gameStateRow,
          state_data: {
            ...gameStateRow.state_data,
            playerStates: {
              ...gameStateRow.state_data.playerStates,
              'player-2': { hand: ['H2'] },
            },
          },
        },
        roomPlayers: [roomPlayerRow, secondRoomPlayer],
      },
      error: null,
    });
    const repository = new SupabaseGameStateRepository({
      client: { rpc },
    } as unknown as SupabaseService);

    const state = await repository.findByRoomId(gameStateRow.room_id);

    expect(state?.players.map((player) => player.playerId)).toEqual([
      'player-1',
      'player-2',
    ]);
  });

  it('ignores player order entries when authoritative roster is empty', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: {
        gameState: gameStateRow,
        roomPlayers: [],
      },
      error: null,
    });
    const repository = new SupabaseGameStateRepository({
      client: { rpc },
    } as unknown as SupabaseService);

    const state = await repository.findByRoomId(gameStateRow.room_id);

    expect(state?.players).toEqual([]);
  });

  it('restores the current turn from current_player_id', async () => {
    const secondRoomPlayer = {
      ...roomPlayerRow,
      id: 'room-player-2',
      player_id: 'player-2',
      name: 'Second player',
      team: 0,
      seat_index: 1,
    };
    const rpc = jest.fn().mockResolvedValue({
      data: {
        gameState: {
          ...gameStateRow,
          current_player_id: 'player-2',
          state_data: {
            ...gameStateRow.state_data,
            playerStates: {
              ...gameStateRow.state_data.playerStates,
              'player-2': { hand: ['H2'] },
            },
          },
        },
        roomPlayers: [roomPlayerRow, secondRoomPlayer],
      },
      error: null,
    });
    const repository = new SupabaseGameStateRepository({
      client: { rpc },
    } as unknown as SupabaseService);

    const state = await repository.findByRoomId(gameStateRow.room_id);

    expect(state?.currentPlayerId).toBe('player-2');
    expect(state?.currentPlayerIndex).toBe(1);
  });

  it('passes the expected version to atomic state updates', async () => {
    const order = jest.fn().mockResolvedValue({
      data: [roomPlayerRow],
      error: null,
    });
    const eq = jest.fn().mockReturnValue({ order });
    const select = jest.fn().mockReturnValue({ eq });
    const rpc = jest.fn().mockResolvedValue({
      data: { ...gameStateRow, version: 5 },
      error: null,
    });
    const repository = new SupabaseGameStateRepository({
      client: {
        rpc,
        from: jest.fn().mockReturnValue({ select }),
      },
    } as unknown as SupabaseService);

    const state = await repository.update(
      gameStateRow.room_id,
      { roundNumber: 2 },
      4,
    );

    expect(rpc).toHaveBeenCalledWith('atomic_update_game_state', {
      p_room_id: gameStateRow.room_id,
      p_state_patch: {},
      p_scalar_patch: { roundNumber: 2 },
      p_expected_version: 4,
    });
    expect(state?.version).toBe(5);
  });

  it('persists current player id with a derived index fallback', async () => {
    const order = jest.fn().mockResolvedValue({
      data: [roomPlayerRow],
      error: null,
    });
    const eq = jest.fn().mockReturnValue({ order });
    const select = jest.fn().mockReturnValue({ eq });
    const rpc = jest.fn().mockResolvedValue({
      data: { ...gameStateRow, version: 5 },
      error: null,
    });
    const repository = new SupabaseGameStateRepository({
      client: {
        rpc,
        from: jest.fn().mockReturnValue({ select }),
      },
    } as unknown as SupabaseService);

    await repository.update(gameStateRow.room_id, {
      players: createState().players,
      currentPlayerIndex: 0,
    });

    expect(rpc).toHaveBeenCalledWith('atomic_update_game_state', {
      p_room_id: gameStateRow.room_id,
      p_state_patch: {
        playerStates: {
          'player-1': {
            hand: ['S1'],
            isPasser: true,
            hasBroken: true,
            hasRequiredBroken: false,
          },
        },
      },
      p_scalar_patch: {
        currentPlayerId: 'player-1',
      },
      p_expected_version: null,
    });
  });

  it('persists the complete roster without socket metadata', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: { ...gameStateRow, version: 5 },
      error: null,
    });
    const repository = new SupabaseGameStateRepository({
      client: { rpc },
    } as unknown as SupabaseService);

    const state = await repository.persistRoomRoster(
      gameStateRow.room_id,
      [createRoomPlayer()],
      createState(),
      'player-1',
    );

    expect(rpc).toHaveBeenCalledWith(
      'persist_room_roster_atomic',
      expect.objectContaining({
        p_expected_version: 4,
        p_host_id: 'player-1',
        p_player_states: {
          'player-1': {
            hand: ['S1'],
            isPasser: true,
            hasBroken: true,
            hasRequiredBroken: false,
          },
        },
        p_room_players: [
          {
            playerId: 'player-1',
            userId: roomPlayerRow.user_id,
            name: 'Current name',
            team: 1,
            isReady: true,
            isHost: true,
            isCOM: false,
            joinedAt: roomPlayerRow.joined_at,
            seatIndex: 0,
          },
        ],
      }),
    );
    const [, rosterPayload] = rpc.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(rosterPayload).not.toHaveProperty('p_legacy_players');
    expect(rosterPayload).not.toHaveProperty('p_team_assignments');
    expect(state?.version).toBe(5);
  });

  it('reassigns sequential seat indexes when persisting a roster', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: { ...gameStateRow, version: 5 },
      error: null,
    });
    const repository = new SupabaseGameStateRepository({
      client: { rpc },
    } as unknown as SupabaseService);
    const secondPlayer = {
      ...createRoomPlayer(),
      playerId: 'player-2',
      name: 'Player 2',
      seatIndex: 0,
    };

    await repository.persistRoomRoster(
      gameStateRow.room_id,
      [{ ...createRoomPlayer(), seatIndex: 7 }, secondPlayer],
      createState(),
      'player-1',
    );

    const [, rosterPayload] = rpc.mock.calls[0] as [
      string,
      { p_room_players: Array<{ playerId: string; seatIndex: number }> },
    ];
    expect(
      rosterPayload.p_room_players.map((player) => ({
        playerId: player.playerId,
        seatIndex: player.seatIndex,
      })),
    ).toEqual([
      { playerId: 'player-1', seatIndex: 0 },
      { playerId: 'player-2', seatIndex: 1 },
    ]);
  });
});
