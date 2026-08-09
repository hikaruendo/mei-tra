import { ComSessionService } from '../com-session.service';
import { PlayerReferenceRemapperService } from '../player-reference-remapper.service';
import { IComPlayerService } from '../interfaces/com-player-service.interface';
import { GameStateService } from '../game-state.service';
import { Room } from '../../types/room.types';

const HUMAN_ID = 'human-1';

// persistRoster replaces the in-memory state with its DB round-trip, and that
// round-trip preserves the stored playState verbatim (the roster SQL only merges
// playerStates). This fake reproduces that swap so the remap must survive it.
const createGameStateStub = () => {
  const makeState = () => ({
    players: [
      {
        playerId: HUMAN_ID,
        name: 'Human',
        team: 0 as const,
        hand: ['A♠'],
        isPasser: false,
        hasBroken: false,
        hasRequiredBroken: false,
      },
    ],
    teamAssignments: { [HUMAN_ID]: 0 } as Record<string, number>,
    currentPlayerId: HUMAN_ID as string | null,
    playState: {
      currentField: {
        cards: ['A♠'],
        playedBy: [HUMAN_ID],
        baseCard: 'A♠',
        dealerId: HUMAN_ID,
        isComplete: false,
      },
      fields: [],
      neguri: {} as Record<string, string>,
    },
  });

  let liveState = makeState();
  const saveState = jest.fn().mockResolvedValue(undefined);

  const gameState = {
    getState: () => liveState,
    registerPlayerToken: jest.fn(),
    persistRoster: jest.fn().mockImplementation(() => {
      const persistedPlayers = liveState.players;
      liveState = makeState();
      liveState.players = persistedPlayers;
      return Promise.resolve();
    }),
    saveState,
  } as unknown as GameStateService;

  return { gameState, saveState };
};

const createRoom = (): Room =>
  ({
    hostId: HUMAN_ID,
    players: [
      {
        playerId: HUMAN_ID,
        name: 'Human',
        team: 0,
        hand: ['A♠'],
        isPasser: false,
        hasBroken: false,
        hasRequiredBroken: false,
        isReady: true,
        isHost: true,
        joinedAt: new Date(),
        socketId: 's1',
      },
    ],
  }) as unknown as Room;

describe('ComSessionService.convertPlayerToCOM', () => {
  it('keeps field attribution pointing at the COM seat after the roster round-trip', async () => {
    const service = new ComSessionService(
      { createComPlayer: jest.fn() } as unknown as IComPlayerService,
      new PlayerReferenceRemapperService(),
    );
    const { gameState, saveState } = createGameStateStub();

    const converted = await service.convertPlayerToCOM(
      'room-1',
      HUMAN_ID,
      createRoom(),
      gameState,
      {},
    );

    expect(converted).toBe(true);

    const state = gameState.getState();
    const comId = state.players[0].playerId;
    expect(comId).toMatch(/^com-/);

    // The removed human must not survive anywhere the round-end validator looks:
    // complete-field rejects the whole field if playedBy holds an unknown id.
    expect(state.playState!.currentField!.playedBy).toEqual([comId]);
    expect(state.playState!.currentField!.dealerId).toBe(comId);
    expect(state.teamAssignments[HUMAN_ID]).toBeUndefined();
    expect(state.teamAssignments[comId]).toBe(0);

    // In production the roster SQL re-anchors current_player_id to the seat's new
    // occupant, so this field is not known to go stale on its own. Pinned anyway:
    // resolveCurrentPlayerIndex() silently falls back to currentPlayerIndex when the
    // id is unresolvable, so a regression here would be invisible at runtime.
    expect(state.currentPlayerId).toBe(comId);

    expect(saveState).toHaveBeenCalled();
  });
});
