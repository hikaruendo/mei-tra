import { ComSessionService } from '../com-session.service';
import { IComPlayerService } from '../interfaces/com-player-service.interface';
import { GameStateService } from '../game-state.service';
import { Room } from '../../types/room.types';
import type { VacantSeats } from '../../types/vacant-seat.types';
import { asSeatId } from '../../types/identity.types';

const HUMAN_ID = 'human-1';

// persistRoster replaces the in-memory state with its DB round-trip. Identity
// references must remain valid without a remapping pass because the seat is stable.
const createGameStateStub = () => {
  const makeState = () => ({
    players: [
      {
        seatId: asSeatId(HUMAN_ID),
        name: 'Human',
        team: 0 as const,
        hand: ['A♠'],
        isPasser: false,
        hasBroken: false,
        hasRequiredBroken: false,
      },
    ],
    currentSeatId: asSeatId(HUMAN_ID),
    playState: {
      currentField: {
        cards: ['A♠'],
        playedBySeatIds: [asSeatId(HUMAN_ID)],
        baseCard: 'A♠',
        dealerSeatId: asSeatId(HUMAN_ID),
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
    registerSeatToken: jest.fn(),
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
    hostSeatId: asSeatId(HUMAN_ID),
    players: [
      {
        seatId: asSeatId(HUMAN_ID),
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
    const service = new ComSessionService({
      createComPlayer: jest.fn(),
    } as unknown as IComPlayerService);
    const { gameState } = createGameStateStub();
    const vacantSeats: VacantSeats = {};

    const converted = await service.convertPlayerToCOM(
      'room-1',
      asSeatId(HUMAN_ID),
      createRoom(),
      gameState,
      vacantSeats,
    );

    expect(converted).toBe(true);

    const state = gameState.getState();
    const comId = state.players[0].seatId;
    expect(comId).toBe(HUMAN_ID);

    expect(state.playState!.currentField!.playedBySeatIds).toEqual([comId]);
    expect(state.playState!.currentField!.dealerSeatId).toBe(comId);
    expect(state.players.find((player) => player.seatId === comId)?.team).toBe(
      0,
    );
    expect(state.currentSeatId).toBe(comId);
    expect(Object.keys(vacantSeats['room-1'])).toEqual([HUMAN_ID]);
    expect(vacantSeats['room-1'][asSeatId(HUMAN_ID)].roomPlayer.seatId).toBe(
      asSeatId(HUMAN_ID),
    );
  });

  it('keeps the seat owner only for a disconnect-timeout COM replacement', async () => {
    const service = new ComSessionService({
      createComPlayer: jest.fn(),
    } as unknown as IComPlayerService);
    const { gameState } = createGameStateStub();
    const room = createRoom();
    room.players[0].userId = 'user-1';
    room.players[0].isAuthenticated = true;
    room.players[0].participantKey = 'user-1';

    const converted = await service.convertPlayerToCOM(
      'room-1',
      asSeatId(HUMAN_ID),
      room,
      gameState,
      {},
      {
        type: 'complete-disconnect-timeout',
        userId: 'user-1',
        expectedVersion: 2,
        transitionId: 'transition-timeout',
      },
    );

    expect(converted).toBe(true);
    expect(room.players[0]).toEqual(
      expect.objectContaining({
        seatId: asSeatId(HUMAN_ID),
        userId: 'user-1',
        participantKey: 'user-1',
        isAuthenticated: true,
        isCOM: true,
      }),
    );
  });
});
