import { SupabaseService } from '../../database/supabase.service';
import { GameState } from '../../types/game.types';
import { RoomPlayer } from '../../types/room.types';
import { asSeatId } from '../../types/identity.types';
import { SupabaseGameStateRepository } from './supabase-game-state.repository';

describe('SupabaseGameStateRepository', () => {
  const firstSeatId = asSeatId('00000000-0000-4000-8000-000000001001');
  const secondSeatId = asSeatId('00000000-0000-4000-8000-000000001002');
  const gameStateRow = {
    id: 'game-state-1',
    room_id: '00000000-0000-0000-0000-000000000001',
    state_data: {
      identitySchemaVersion: 2,
      playerStates: {
        [firstSeatId]: {
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
        lastPasserSeatId: null,
        isRoundCancelled: false,
        currentBlowIndex: 0,
      },
      playState: {
        currentField: null,
        negriCard: null,
        negriSeatId: null,
        neguri: {},
        fields: [],
        lastWinnerSeatId: null,
        openDeclared: false,
        openDeclarerSeatId: null,
      },
    },
    current_seat_id: firstSeatId,
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
    id: firstSeatId,
    room_id: gameStateRow.room_id,
    user_id: '00000000-0000-0000-0000-000000000101',
    name: 'Current name',
    team: 1,
    is_ready: true,
    is_com: false,
    joined_at: '2026-07-19T00:00:00.000Z',
    seat_index: 0,
  };

  function createState(): GameState {
    return {
      version: 4,
      players: [
        {
          seatId: firstSeatId,
          playerId: firstSeatId,
          name: 'Current name',
          hand: ['S1'],
          team: 1,
          isPasser: true,
          isCOM: false,
          hasBroken: true,
          hasRequiredBroken: false,
        },
      ],
      currentSeatId: firstSeatId,
      currentPlayerId: firstSeatId,
      currentPlayerIndex: 0,
      gamePhase: 'waiting',
      deck: [],
      teamScores: {
        0: { play: 0, total: 0 },
        1: { play: 0, total: 0 },
      },
      teamScoreRecords: { 0: [], 1: [] },
      blowState: {
        ...gameStateRow.state_data.blowState,
        lastPasserSeatId: null,
      },
      playState: {
        ...gameStateRow.state_data.playState,
        lastWinnerSeatId: null,
        openDeclarerSeatId: null,
      },
      roundNumber: 1,
      pointsToWin: 8,
      teamAssignments: { [firstSeatId]: 1 },
    };
  }

  function createRoomPlayer(): RoomPlayer {
    return {
      socketId: 'transient-socket',
      seatId: firstSeatId,
      playerId: firstSeatId,
      participantKey: roomPlayerRow.user_id,
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
        playerId: firstSeatId,
        seatId: firstSeatId,
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
      id: secondSeatId,
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
              [secondSeatId]: { hand: ['H2'] },
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
      firstSeatId,
      secondSeatId,
    ]);
  });

  it('rejects a game state that is not identity schema v2', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: {
        gameState: {
          ...gameStateRow,
          state_data: {
            ...gameStateRow.state_data,
            identitySchemaVersion: 1,
          },
        },
        roomPlayers: [roomPlayerRow],
      },
      error: null,
    });
    const repository = new SupabaseGameStateRepository({
      client: { rpc },
    } as unknown as SupabaseService);

    await expect(repository.findByRoomId(gameStateRow.room_id)).rejects.toThrow(
      'Unsupported game-state identity schema',
    );
  });

  it('rejects player states that reference seats outside the roster', async () => {
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

    await expect(repository.findByRoomId(gameStateRow.room_id)).rejects.toThrow(
      'Game state references seats outside room',
    );
  });

  it('rejects nested state references outside the room roster', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: {
        gameState: {
          ...gameStateRow,
          state_data: {
            ...gameStateRow.state_data,
            blowState: {
              ...gameStateRow.state_data.blowState,
              declarations: [
                {
                  seatId: secondSeatId,
                  trumpType: 'herz',
                  numberOfPairs: 6,
                  timestamp: 1,
                },
              ],
            },
          },
        },
        roomPlayers: [roomPlayerRow],
      },
      error: null,
    });
    const repository = new SupabaseGameStateRepository({
      client: { rpc },
    } as unknown as SupabaseService);

    await expect(repository.findByRoomId(gameStateRow.room_id)).rejects.toThrow(
      'Game state references seats outside room',
    );
  });

  it('restores the current turn from current_seat_id', async () => {
    const secondRoomPlayer = {
      ...roomPlayerRow,
      id: secondSeatId,
      name: 'Second player',
      team: 0,
      seat_index: 1,
    };
    const rpc = jest.fn().mockResolvedValue({
      data: {
        gameState: {
          ...gameStateRow,
          current_seat_id: secondSeatId,
          state_data: {
            ...gameStateRow.state_data,
            playerStates: {
              ...gameStateRow.state_data.playerStates,
              [secondSeatId]: { hand: ['H2'] },
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

    expect(state?.currentSeatId).toBe(secondSeatId);
    expect(state?.currentPlayerId).toBeUndefined();
    expect(state?.currentPlayerIndex).toBeUndefined();
  });

  it('restores canonical seat references', async () => {
    const secondRoomPlayer = {
      ...roomPlayerRow,
      id: secondSeatId,
      name: 'Second player',
      team: 0,
      seat_index: 1,
    };
    const rpc = jest.fn().mockResolvedValue({
      data: {
        gameState: {
          ...gameStateRow,
          current_seat_id: secondSeatId,
          state_data: {
            ...gameStateRow.state_data,
            identitySchemaVersion: 2,
            playerStates: {
              [firstSeatId]: { hand: ['S1'] },
              [secondSeatId]: { hand: ['H2'] },
            },
            blowState: {
              ...gameStateRow.state_data.blowState,
              declarations: [
                {
                  seatId: secondSeatId,
                  trumpType: 'herz',
                  numberOfPairs: 5,
                  timestamp: 1,
                },
              ],
              actionHistory: [],
              lastPasserSeatId: firstSeatId,
            },
            playState: {
              currentField: {
                cards: ['S1'],
                playedBySeatIds: [firstSeatId],
                baseCard: 'S1',
                dealerSeatId: secondSeatId,
                isComplete: false,
              },
              negriCard: '5♣',
              negriSeatId: secondSeatId,
              neguri: {},
              fields: [
                {
                  cards: ['S1'],
                  winnerSeatId: firstSeatId,
                  winnerTeam: 1,
                  dealerSeatId: secondSeatId,
                },
              ],
              lastWinnerSeatId: firstSeatId,
              openDeclared: true,
              openDeclarerSeatId: secondSeatId,
            },
            pendingBrokenHandReveal: {
              seatId: secondSeatId,
              handSnapshot: ['H2'],
              startedAt: 1,
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

    expect(state?.currentSeatId).toBe(secondSeatId);
    expect(state?.blowState.declarations[0]?.seatId).toBe(secondSeatId);
    expect(state?.blowState.lastPasserSeatId).toBe(firstSeatId);
    expect(state?.playState?.currentField?.playedBySeatIds).toEqual([
      firstSeatId,
    ]);
    expect(state?.playState?.currentField?.dealerSeatId).toBe(secondSeatId);
    expect(state?.playState?.negriSeatId).toBe(secondSeatId);
    expect(state?.playState?.fields[0]?.winnerSeatId).toBe(firstSeatId);
    expect(state?.playState?.fields[0]?.dealerSeatId).toBe(secondSeatId);
    expect(state?.playState?.lastWinnerSeatId).toBe(firstSeatId);
    expect(state?.playState?.openDeclarerSeatId).toBe(secondSeatId);
    expect(state?.pendingBrokenHandReveal?.seatId).toBe(secondSeatId);
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
      p_state_patch: { identitySchemaVersion: 2 },
      p_scalar_patch: { roundNumber: 2 },
      p_expected_version: 4,
    });
    expect(state?.version).toBe(5);
  });

  it('persists the canonical current seat id', async () => {
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
      currentSeatId: firstSeatId,
    });

    expect(rpc).toHaveBeenCalledWith('atomic_update_game_state', {
      p_room_id: gameStateRow.room_id,
      p_state_patch: {
        identitySchemaVersion: 2,
        playerStates: {
          [firstSeatId]: {
            hand: ['S1'],
            isPasser: true,
            hasBroken: true,
            hasRequiredBroken: false,
          },
        },
      },
      p_scalar_patch: {
        currentSeatId: firstSeatId,
      },
      p_expected_version: null,
    });
  });

  it('persists the complete roster without socket metadata', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: { ...gameStateRow, version: 5, roomPlayers: [roomPlayerRow] },
      error: null,
    });
    const repository = new SupabaseGameStateRepository({
      client: { rpc },
    } as unknown as SupabaseService);

    const state = await repository.persistRoomRoster(
      gameStateRow.room_id,
      [createRoomPlayer()],
      createState(),
      firstSeatId,
    );

    expect(rpc).toHaveBeenCalledWith(
      'persist_room_roster_atomic',
      expect.objectContaining({
        p_expected_version: 4,
        p_host_id: firstSeatId,
        p_membership_mutation: null,
        p_player_states: {
          [firstSeatId]: {
            hand: ['S1'],
            isPasser: true,
            hasBroken: true,
            hasRequiredBroken: false,
          },
        },
        p_room_players: [
          {
            seatId: firstSeatId,
            userId: roomPlayerRow.user_id,
            name: 'Current name',
            team: 1,
            isReady: true,
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
      data: { ...gameStateRow, version: 5, roomPlayers: [roomPlayerRow] },
      error: null,
    });
    const repository = new SupabaseGameStateRepository({
      client: { rpc },
    } as unknown as SupabaseService);
    const secondPlayer = {
      ...createRoomPlayer(),
      seatId: secondSeatId,
      playerId: secondSeatId,
      participantKey: roomPlayerRow.user_id,
      name: 'Player 2',
      seatIndex: 0,
    };

    await repository.persistRoomRoster(
      gameStateRow.room_id,
      [{ ...createRoomPlayer(), seatIndex: 7 }, secondPlayer],
      createState(),
      firstSeatId,
    );

    const [, rosterPayload] = rpc.mock.calls[0] as [
      string,
      { p_room_players: Array<{ seatId: string; seatIndex: number }> },
    ];
    expect(
      rosterPayload.p_room_players.map((player) => ({
        seatId: player.seatId,
        seatIndex: player.seatIndex,
      })),
    ).toEqual([
      { seatId: firstSeatId, seatIndex: 0 },
      { seatId: secondSeatId, seatIndex: 1 },
    ]);
  });
});
