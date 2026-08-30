import type { GameStatePayload, PlayerContract } from '@meitra/contracts/game';
import { asSeatId } from '@meitra/contracts/ids';
import type { RoomContract, RoomPlayerContract } from '@meitra/contracts/room';
import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import { GameProvider, useGame } from '../GameContext';

const mockAppStateHandlers: ((state: string) => void)[] = [];

let mockAuthValue: unknown;
const mockPlaySoundEffect = jest.fn();
let mockSocket: ReturnType<typeof createMockSocket>;
let mockStoredRoomId: string | null = null;
let mockAckResponses: Map<string, { success: boolean; error?: string }>;
let mockRoomStorage: {
  get: jest.Mock<Promise<string | null>, []>;
  set: jest.Mock<Promise<boolean>, [string]>;
  clear: jest.Mock<Promise<void>, []>;
};

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => mockAuthValue,
}));

jest.mock('@/hooks/useSoundEffects', () => ({
  useSoundEffects: () => mockPlaySoundEffect,
}));

jest.mock('@/lib/config', () => ({
  config: { backendUrl: 'http://localhost:3001' },
}));

jest.mock('@/lib/room-storage', () => ({
  roomStorage: (mockRoomStorage = {
    get: jest.fn(async () => mockStoredRoomId),
    set: jest.fn(async (roomId: string) => {
      mockStoredRoomId = roomId;
      return true;
    }),
    clear: jest.fn(async () => {
      mockStoredRoomId = null;
    }),
  }),
}));

jest.mock('socket.io-client', () => ({
  io: jest.fn(() => mockSocket),
}));

jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, handler) => {
  mockAppStateHandlers.push(handler as (state: string) => void);
  return { remove: jest.fn() };
});

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

interface MockTimedSocket {
  emit: jest.Mock<
    MockTimedSocket,
    [
      string,
      unknown,
      (error: Error | null, response?: { success: boolean }) => void,
    ]
  >;
}

interface MockSocket {
  id: string;
  connected: boolean;
  connect: jest.Mock<MockSocket, []>;
  disconnect: jest.Mock<MockSocket, []>;
  emit: jest.Mock<unknown, unknown[]>;
  on: jest.Mock<MockSocket, [string, (...args: unknown[]) => void]>;
  removeAllListeners: jest.Mock<MockSocket, []>;
  timeout: jest.Mock<MockTimedSocket, []>;
  trigger: (event: string, payload?: unknown) => void;
}

const createMockSocket = () => {
  const listeners = new Map<string, (...args: unknown[]) => void>();
  const timedSocket = {} as MockTimedSocket;
  timedSocket.emit = jest.fn(
    (
      event,
      _payload,
      callback,
    ) => {
      callback(null, mockAckResponses.get(event) ?? { success: true });
      return timedSocket;
    },
  );

  const socket = {} as MockSocket;
  socket.id = 'socket-1';
  socket.connected = false;
  socket.connect = jest.fn(() => {
    socket.connected = true;
    return socket;
  });
  socket.disconnect = jest.fn(() => {
    socket.connected = false;
    return socket;
  });
  socket.emit = jest.fn();
  socket.on = jest.fn((event, handler) => {
    listeners.set(event, handler);
    return socket;
  });
  socket.removeAllListeners = jest.fn(() => {
    listeners.clear();
    return socket;
  });
  socket.timeout = jest.fn(() => timedSocket);
  socket.trigger = (event, payload) => {
    listeners.get(event)?.(payload);
  };

  return socket;
};

const player = (overrides: Partial<PlayerContract> = {}): PlayerContract => ({
  socketId: 'socket-1',
  seatId: asSeatId('player-1'),
  userId: 'user-1',
  name: 'Player 1',
  team: 0,
  hand: ['S-3', 'H-4'],
  isHost: true,
  isCOM: false,
  hasRequiredBroken: false,
  ...overrides,
});

const roomPlayer = (
  overrides: Partial<RoomPlayerContract> = {},
): RoomPlayerContract => ({
  ...player(overrides),
  isReady: true,
  isHost: true,
  joinedAt: '2026-07-24T00:00:00.000Z',
  ...overrides,
});

const createRoom = (): RoomContract => ({
  id: 'room-1',
  name: 'Test Room',
  hostSeatId: asSeatId('player-1'),
  status: 'playing',
  players: [
    roomPlayer(),
    roomPlayer({ seatId: asSeatId('player-2'), userId: 'user-2', team: 1 }),
  ],
  settings: {
    maxPlayers: 4,
    isPrivate: false,
    password: null,
    teamAssignmentMethod: 'random',
    pointsToWin: 5,
    allowSpectators: true,
  },
  createdAt: '2026-07-24T00:00:00.000Z',
  updatedAt: '2026-07-24T00:00:00.000Z',
  lastActivityAt: '2026-07-24T00:00:00.000Z',
});

const createGameState = (): GameStatePayload => ({
  roomId: 'room-1',
  players: [
    player(),
    player({ seatId: asSeatId('player-2'), userId: 'user-2', team: 1, hand: [] }),
  ],
  gamePhase: 'play',
  currentField: {
    cards: [],
    playedBySeatIds: [],
    baseCard: '',
    dealerSeatId: asSeatId('player-1'),
    isComplete: false,
  },
  currentTurnSeatId: asSeatId('player-1'),
  blowState: {
    currentTrump: 'zuppe',
    currentHighestDeclaration: null,
    declarations: [],
    actionHistory: [],
    lastPasserSeatId: null,
    isRoundCancelled: false,
    currentBlowIndex: 0,
  },
  teamScores: {
    0: { play: 0, total: 0 },
    1: { play: 0, total: 0 },
  },
  youSeatId: asSeatId('player-1'),
  isSpectator: false,
  negriCard: null,
  negriSeatId: null,
  fields: [],
  hostSeatId: asSeatId('player-1'),
  pointsToWin: 5,
});

function CaptureGame({
  onValue,
}: {
  onValue: (value: ReturnType<typeof useGame>) => void;
}) {
  const value = useGame();
  useEffect(() => {
    onValue(value);
  }, [onValue, value]);

  return null;
}

const renderProvider = async () => {
  let latestGame: ReturnType<typeof useGame> | null = null;
  let renderer: ReturnType<typeof TestRenderer.create> | null = null;

  await act(async () => {
    renderer = TestRenderer.create(
      <GameProvider>
        <CaptureGame
          onValue={(value) => {
            latestGame = value;
          }}
        />
      </GameProvider>,
    );
    await flushPromises();
  });

  return {
    get latestGame() {
      if (!latestGame) throw new Error('Game context was not captured');
      return latestGame;
    },
    unmount: async () => {
      await act(async () => {
        renderer?.unmount();
        await flushPromises();
      });
    },
  };
};

describe('GameProvider realtime resync safety', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAppStateHandlers.length = 0;
    mockStoredRoomId = null;
    mockAckResponses = new Map();
    mockSocket = createMockSocket();
    mockPlaySoundEffect.mockClear();
    mockAuthValue = {
      user: {
        id: 'user-1',
        email: 'player@example.com',
        profile: { displayName: 'Player 1', username: 'player1' },
      },
      session: { access_token: 'session-token' },
      loading: false,
      getAccessToken: jest.fn(async () => 'fresh-token'),
    };
  });

  it('starts deal cues and sounds only for live deal events', async () => {
    const screen = await renderProvider();
    const gameState = createGameState();

    await act(async () => {
      mockSocket.trigger('game-state', gameState);
      await flushPromises();
    });
    expect(screen.latestGame.dealAnimationCue).toBeNull();
    expect(mockPlaySoundEffect).not.toHaveBeenCalled();

    await act(async () => {
      mockSocket.trigger('game-started', {
        roomId: gameState.roomId,
        players: gameState.players,
        pointsToWin: gameState.pointsToWin,
        currentTurnSeatId: gameState.currentTurnSeatId,
      });
      mockSocket.trigger('card-played', {
        seatId: asSeatId('player-2'),
        card: 'H-4',
        field: gameState.currentField,
        players: gameState.players,
        nextSeatId: asSeatId('player-1'),
      });
      mockSocket.trigger('broken', {
        nextSeatId: asSeatId('player-1'),
        players: gameState.players,
        gamePhase: 'blow',
      });
      mockSocket.trigger('round-cancelled', {
        nextDealerSeatId: asSeatId('player-1'),
        players: gameState.players,
      });
      mockSocket.trigger('new-round-started', {
        players: gameState.players,
        currentTurnSeatId: asSeatId('player-1'),
        gamePhase: 'blow',
        currentField: null,
        completedFields: [],
        negriCard: null,
        negriSeatId: null,
        revealedAgari: null,
        currentTrump: null,
        currentHighestDeclaration: null,
        blowDeclarations: [],
      });
      await flushPromises();
    });

    expect(mockPlaySoundEffect.mock.calls).toEqual([
      ['shuffle'],
      ['cardPlay'],
      ['shuffle'],
      ['shuffle'],
      ['shuffle'],
    ]);
    expect(screen.latestGame.dealAnimationCue).toMatchObject({
      token: 4,
      seatIds: gameState.players.map((player) => player.seatId),
    });
    await screen.unmount();
  });

  it('captures a live result once and preserves it through room teardown', async () => {
    const screen = await renderProvider();
    const gameState = createGameState();
    const payload = {
      winner: 'Team 0',
      winningTeam: 0 as const,
      finalScores: {
        0: { play: 2, total: 5 },
        1: { play: 1, total: 3 },
      },
    };

    await act(async () => {
      mockSocket.trigger('game-state', gameState);
      await flushPromises();
    });
    mockPlaySoundEffect.mockClear();

    await act(async () => {
      mockSocket.trigger('game-over', payload);
      mockSocket.trigger('game-over', payload);
      await flushPromises();
    });
    expect(screen.latestGame.gameResult).toMatchObject({
      winningTeam: 0,
      viewerRole: 'winner',
      teams: [{ team: 0, total: 5 }, { team: 1, total: 3 }],
    });
    expect(mockPlaySoundEffect.mock.calls).toEqual([['victory']]);

    await act(async () => {
      mockSocket.trigger('back-to-lobby');
      await flushPromises();
    });
    expect(screen.latestGame.game).toBeNull();
    expect(screen.latestGame.currentRoom).toBeNull();
    expect(screen.latestGame.gameResult?.winningTeam).toBe(0);
    await screen.unmount();
  });

  it('does not create or sound a result from a reconnect snapshot', async () => {
    const screen = await renderProvider();
    await act(async () => {
      mockSocket.trigger('game-state', createGameState());
      await flushPromises();
    });
    expect(screen.latestGame.gameResult).toBeNull();
    expect(mockPlaySoundEffect).not.toHaveBeenCalled();
    await screen.unmount();
  });

  it('plays the confirmed Negri sound only for the client that selected it', async () => {
    const screen = await renderProvider();
    const gameState = createGameState();

    await act(async () => {
      mockSocket.trigger('connect');
      mockSocket.trigger('game-state', gameState);
      await flushPromises();
    });
    mockPlaySoundEffect.mockClear();

    await act(async () => {
      mockSocket.trigger('play-setup-complete', {
        negriCard: 'H-4',
        startingSeatId: asSeatId('player-1'),
      });
      await flushPromises();
    });
    expect(mockPlaySoundEffect).not.toHaveBeenCalled();

    await act(async () => {
      screen.latestGame.selectNegri('H-4');
      mockSocket.trigger('play-setup-complete', {
        negriCard: 'H-4',
        startingSeatId: asSeatId('player-1'),
      });
      await flushPromises();
    });
    expect(mockPlaySoundEffect.mock.calls).toEqual([['negri']]);

    await act(async () => {
      mockSocket.trigger('play-setup-complete', {
        negriCard: 'H-4',
        startingSeatId: asSeatId('player-1'),
      });
      await flushPromises();
    });
    expect(mockPlaySoundEffect).toHaveBeenCalledTimes(1);

    await screen.unmount();
  });

  it('clears a pending Negri sound when a snapshot restores the game', async () => {
    const screen = await renderProvider();
    const gameState = createGameState();

    await act(async () => {
      mockSocket.trigger('connect');
      mockSocket.trigger('game-state', gameState);
      screen.latestGame.selectNegri('H-4');
      mockSocket.trigger('game-state', gameState);
      mockSocket.trigger('play-setup-complete', {
        negriCard: 'H-4',
        startingSeatId: asSeatId('player-1'),
      });
      await flushPromises();
    });

    expect(mockPlaySoundEffect).not.toHaveBeenCalled();
    await screen.unmount();
  });

  it('coalesces duplicate foreground resync triggers into one server sync', async () => {
    const screen = await renderProvider();

    await act(async () => {
      mockSocket.trigger('connect');
      await flushPromises();
    });
    mockSocket.emit.mockClear();

    mockStoredRoomId = 'room-1';
    await act(async () => {
      mockAppStateHandlers.forEach((handler) => handler('active'));
      mockAppStateHandlers.forEach((handler) => handler('active'));
      await flushPromises();
    });

    expect(
      mockSocket.emit.mock.calls.filter(([event]) => event === 'sync-game-state'),
    ).toEqual([['sync-game-state', { roomId: 'room-1' }]]);
    expect(screen.latestGame.connectionStatus).toBe('resyncing');

    await act(async () => {
      mockSocket.trigger('game-state', createGameState());
      await flushPromises();
    });
    expect(screen.latestGame.connectionStatus).toBe('connected');

    await screen.unmount();
  });

  it('resumes an explicitly requested room without stored recovery state', async () => {
    const screen = await renderProvider();

    await act(async () => {
      mockSocket.trigger('connect');
      await flushPromises();
    });
    mockSocket.emit.mockClear();

    let resumePromise: Promise<void> | undefined;
    await act(async () => {
      resumePromise = screen.latestGame.resumeRoom('room-notification');
      await flushPromises();
    });

    expect(mockRoomStorage.set).toHaveBeenCalledWith('room-notification');
    expect(
      mockSocket.emit.mock.calls.filter(([event]) => event === 'sync-game-state'),
    ).toEqual([['sync-game-state', { roomId: 'room-notification' }]]);
    expect(screen.latestGame.connectionStatus).toBe('resyncing');

    await act(async () => {
      mockSocket.trigger('game-state', {
        ...createGameState(),
        roomId: 'room-notification',
      });
      await resumePromise;
      await flushPromises();
    });
    expect(screen.latestGame.connectionStatus).toBe('connected');

    await screen.unmount();
  });

  it('blocks room and play actions while an authoritative resync is pending', async () => {
    const screen = await renderProvider();

    mockStoredRoomId = 'room-1';
    await act(async () => {
      mockSocket.trigger('connect');
      await flushPromises();
      mockSocket.trigger('room-sync', {
        room: createRoom(),
        players: createGameState().players,
      });
      mockSocket.trigger('game-state', createGameState());
      await flushPromises();
    });
    expect(screen.latestGame.connectionStatus).toBe('connected');

    mockSocket.emit.mockClear();
    mockSocket.timeout.mockClear();

    await act(async () => {
      mockAppStateHandlers.forEach((handler) => handler('active'));
      await flushPromises();
    });
    expect(screen.latestGame.connectionStatus).toBe('resyncing');

    act(() => {
      screen.latestGame.startGame();
      screen.latestGame.playCard('S-3');
    });

    expect(mockSocket.timeout).not.toHaveBeenCalled();
    expect(
      mockSocket.emit.mock.calls.some(([event]) => event === 'play-card'),
    ).toBe(false);

    await screen.unmount();
  });

  it('keeps local room recovery when leave acknowledgement fails', async () => {
    const screen = await renderProvider();

    mockStoredRoomId = 'room-1';
    await act(async () => {
      mockSocket.trigger('connect');
      await flushPromises();
      mockSocket.trigger('room-sync', {
        room: createRoom(),
        players: createGameState().players,
      });
      mockSocket.trigger('game-state', createGameState());
      await flushPromises();
    });

    mockAckResponses.set('leave-room', {
      success: false,
      error: 'still joined on server',
    });
    mockRoomStorage.clear.mockClear();

    let didLeave = true;
    await act(async () => {
      didLeave = await screen.latestGame.leaveRoom();
      await flushPromises();
    });

    expect(didLeave).toBe(false);
    expect(mockRoomStorage.clear).not.toHaveBeenCalled();
    expect(screen.latestGame.game?.roomId).toBe('room-1');
    expect(screen.latestGame.error).toBe('still joined on server');

    await screen.unmount();
  });

  it('keeps the seat identity after a player is replaced with COM', async () => {
    const screen = await renderProvider();
    const comPlayer = player({
      seatId: asSeatId('player-2'),
      userId: undefined,
      name: 'COM 2',
      team: 1,
      hand: [],
      isCOM: true,
    });

    await act(async () => {
      mockSocket.trigger('connect');
      mockSocket.trigger('room-sync', {
        room: createRoom(),
        players: createGameState().players,
      });
      mockSocket.trigger('game-state', createGameState());
      mockSocket.trigger('update-players', [player(), comPlayer]);
      mockSocket.trigger('field-updated', {
        cards: ['J♠'],
        playedBySeatIds: [asSeatId('player-2')],
        baseCard: 'J♠',
        dealerSeatId: asSeatId('player-2'),
        isComplete: false,
      });
      await flushPromises();
    });

    expect(screen.latestGame.game?.players).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          seatId: 'player-2',
          isCOM: true,
        }),
      ]),
    );
    expect(screen.latestGame.game?.currentField?.playedBySeatIds).toEqual([
      'player-2',
    ]);

    await screen.unmount();
  });

  it('applies COM replacement to PlayerInfo before the next roster snapshot', async () => {
    const screen = await renderProvider();
    const gameState = createGameState();
    gameState.players[1] = player({
      seatId: asSeatId('player-2'),
      socketId: '',
      userId: 'user-2',
      name: 'Disconnected player',
      team: 1,
      hand: [],
    });

    await act(async () => {
      mockSocket.trigger('game-state', gameState);
      mockSocket.trigger('player-converted-to-com', {
        seatId: asSeatId('player-2'),
        playerName: 'COM 2',
      });
      await flushPromises();
    });

    expect(screen.latestGame.game?.players).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          seatId: 'player-2',
          name: 'Disconnected player',
          userId: undefined,
          isCOM: true,
          isAuthenticated: false,
        }),
      ]),
    );
    expect(screen.latestGame.game?.disconnectedSeatIds).not.toContain(
      'player-2',
    );

    await screen.unmount();
  });

  it('clears stale disconnected UI when room sync restores the same seat', async () => {
    const screen = await renderProvider();
    const disconnectedState = createGameState();
    disconnectedState.players[1] = player({
      seatId: asSeatId('player-2'),
      socketId: '',
      userId: 'user-2',
      name: 'Before reconnect',
      team: 1,
      hand: [],
    });

    await act(async () => {
      mockSocket.trigger('game-state', disconnectedState);
      await flushPromises();
    });
    expect(screen.latestGame.game?.disconnectedSeatIds).toContain('player-2');

    const reconnectedPlayer = player({
      seatId: asSeatId('player-2'),
      socketId: 'socket-reconnected',
      userId: 'user-2',
      name: 'After reconnect',
      team: 1,
      hand: [],
      isAuthenticated: true,
    });

    await act(async () => {
      mockSocket.trigger('room-sync', {
        room: createRoom(),
        players: [player(), reconnectedPlayer],
      });
      await flushPromises();
    });

    expect(screen.latestGame.game?.disconnectedSeatIds).not.toContain(
      'player-2',
    );
    expect(screen.latestGame.game?.players).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          seatId: 'player-2',
          socketId: 'socket-reconnected',
          name: 'After reconnect',
          isAuthenticated: true,
        }),
      ]),
    );

    await screen.unmount();
  });
});
