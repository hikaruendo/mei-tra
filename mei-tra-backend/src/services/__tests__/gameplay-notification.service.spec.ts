import { asSeatId } from '../../types/identity.types';
import { GameplayNotificationService } from '../gameplay-notification.service';
import type { PushNotificationService } from '../../push/push-notification.service';
import type { IUserProfileRepository } from '../../repositories/interfaces/user-profile.repository.interface';
import type { IRoomService } from '../interfaces/room-service.interface';
import type { GameState } from '../../types/game.types';
import { Room, RoomStatus } from '../../types/room.types';
import { UserProfile } from '../../types/user.types';
import type { GameStateService } from '../game-state.service';

const state = (overrides: Partial<GameState> = {}): GameState =>
  ({
    players: [],
    currentPlayerIndex: 0,
    // Turn notifications verify the seat still holds the turn before sending.
    currentSeatId: asSeatId('player-2'),
    gamePhase: 'blow',
    deck: [],
    teamScores: {
      0: { play: 0, total: 0 },
      1: { play: 0, total: 0 },
    },
    teamScoreRecords: { 0: [], 1: [] },
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
      currentField: {
        cards: [],
        playedBySeatIds: [],
        baseCard: '',
        dealerSeatId: asSeatId('player-1'),
        isComplete: false,
      },
      negriCard: null,
      neguri: {},
      fields: [],
      lastWinnerSeatId: null,
      openDeclared: false,
      openDeclarerSeatId: null,
    },
    roundNumber: 1,
    pointsToWin: 5,
    ...overrides,
  }) as GameState;

const room = (overrides: Partial<Room> = {}): Room => ({
  id: 'room-1',
  name: 'Room',
  hostSeatId: asSeatId('player-1'),
  status: RoomStatus.PLAYING,
  players: [
    {
      seatId: asSeatId('player-1'),
      userId: 'user-1',
      socketId: 'socket-1',
      name: 'Player 1',
      team: 0,
      hand: [],
      isPasser: false,
      isCOM: false,
      isReady: true,
      isHost: true,
      isAuthenticated: true,
      joinedAt: new Date('2026-07-23T00:00:00.000Z'),
    },
    {
      seatId: asSeatId('player-2'),
      userId: 'user-2',
      socketId: 'socket-2',
      name: 'Player 2',
      team: 1,
      hand: [],
      isPasser: false,
      isCOM: false,
      isReady: true,
      isHost: false,
      isAuthenticated: true,
      joinedAt: new Date('2026-07-23T00:00:00.000Z'),
    },
    {
      seatId: asSeatId('com-3'),
      socketId: 'socket-3',
      name: 'COM 3',
      team: 0,
      hand: [],
      isPasser: false,
      isCOM: true,
      isReady: true,
      isHost: false,
      joinedAt: new Date('2026-07-23T00:00:00.000Z'),
    },
  ],
  settings: {
    maxPlayers: 4,
    isPrivate: false,
    password: null,
    teamAssignmentMethod: 'random',
    pointsToWin: 5,
    allowSpectators: true,
  },
  createdAt: new Date('2026-07-23T00:00:00.000Z'),
  updatedAt: new Date('2026-07-23T00:00:00.000Z'),
  lastActivityAt: new Date('2026-07-23T00:00:00.000Z'),
  ...overrides,
});

const profile = (userId: string, notifications = true): UserProfile =>
  ({
    id: userId,
    username: userId,
    displayName: userId,
    createdAt: new Date('2026-07-23T00:00:00.000Z'),
    updatedAt: new Date('2026-07-23T00:00:00.000Z'),
    lastSeenAt: new Date('2026-07-23T00:00:00.000Z'),
    gamesPlayed: 0,
    gamesWon: 0,
    totalScore: 0,
    preferences: {
      notifications,
      sound: true,
      theme: 'dark',
      fontSize: 'standard',
    },
  }) as UserProfile;

describe('GameplayNotificationService', () => {
  let roomService: jest.Mocked<IRoomService>;
  let userProfileRepository: jest.Mocked<IUserProfileRepository>;
  let pushNotificationService: jest.Mocked<PushNotificationService>;
  let gameState: GameState;
  let currentRoom: Room;
  let connectionSocketIds: Map<string, string>;
  let roomGameState: jest.Mocked<
    Pick<GameStateService, 'getState' | 'getPlayerConnectionState'>
  >;
  let service: GameplayNotificationService;

  beforeEach(() => {
    jest.useFakeTimers();
    gameState = state();
    currentRoom = room();
    connectionSocketIds = new Map([
      ['player-1', 'socket-1'],
      ['player-2', ''],
      ['com-3', ''],
    ]);
    roomGameState = {
      getState: jest.fn(() => gameState),
      getPlayerConnectionState: jest.fn((seatId) => ({
        socketId: connectionSocketIds.get(seatId) ?? '',
      })),
    };
    roomService = {
      getRoom: jest.fn(async () => currentRoom),
      getRoomGameState: jest.fn(
        async () => roomGameState as unknown as GameStateService,
      ),
    } as unknown as jest.Mocked<IRoomService>;
    userProfileRepository = {
      findById: jest.fn(async (userId: string) => profile(userId)),
    } as unknown as jest.Mocked<IUserProfileRepository>;
    pushNotificationService = {
      sendGameStarted: jest.fn().mockResolvedValue({}),
      sendTurnNotification: jest.fn().mockResolvedValue({}),
    } as unknown as jest.Mocked<PushNotificationService>;
    service = new GameplayNotificationService(
      roomService,
      userProfileRepository,
      pushNotificationService,
    );
  });

  afterEach(() => {
    service.onModuleDestroy();
    jest.useRealTimers();
  });

  it('sends game-started once to eligible human recipients only', async () => {
    const playerTemplate = currentRoom.players[1];
    currentRoom = room({
      players: [
        ...currentRoom.players,
        {
          ...playerTemplate,
          seatId: asSeatId('guest-4'),
          userId: 'guest-user',
          socketId: '',
          name: 'Guest',
          isAuthenticated: false,
        },
      ],
    });

    await service.notifyGameStarted({
      roomId: 'room-1',
    });
    await service.notifyGameStarted({
      roomId: 'room-1',
    });

    expect(pushNotificationService.sendGameStarted).toHaveBeenCalledTimes(1);
    expect(pushNotificationService.sendGameStarted).toHaveBeenCalledWith(
      ['user-2'],
      {
        eventId: 'game-started:room-1:1',
        roomId: 'room-1',
        roundNumber: 1,
      },
    );
  });

  it('drops a turn notification whose seat no longer holds the turn', async () => {
    await service.notifyTurnChanged({
      roomId: 'room-1',
      seatId: asSeatId('player-1'),
    });

    expect(pushNotificationService.sendTurnNotification).not.toHaveBeenCalled();
  });

  it('sends one turn notification per transition and suppresses replay duplicates', async () => {
    await service.notifyTurnChanged({
      roomId: 'room-1',
      seatId: asSeatId('player-2'),
    });
    await service.notifyTurnChanged({
      roomId: 'room-1',
      seatId: asSeatId('player-2'),
    });

    await jest.advanceTimersByTimeAsync(60_000);

    expect(pushNotificationService.sendTurnNotification).toHaveBeenCalledTimes(
      1,
    );
    expect(pushNotificationService.sendTurnNotification).toHaveBeenCalledWith(
      ['user-2'],
      expect.objectContaining({
        eventId: 'turn:room-1:1:blow:player-2:0:0:0:0:player-1',
        roomId: 'room-1',
        roundNumber: 1,
        phase: 'blow',
      }),
    );
  });

  it('skips COM turns and players with notifications disabled', async () => {
    userProfileRepository.findById.mockResolvedValue(profile('user-2', false));

    await service.notifyTurnChanged({
      roomId: 'room-1',
      seatId: asSeatId('com-3'),
    });
    await service.notifyTurnChanged({
      roomId: 'room-1',
      seatId: asSeatId('player-2'),
    });

    await jest.advanceTimersByTimeAsync(60_000);

    expect(pushNotificationService.sendTurnNotification).not.toHaveBeenCalled();
  });

  it('catches push failures so gameplay callers can continue', async () => {
    pushNotificationService.sendTurnNotification.mockRejectedValue(
      new Error('expo down'),
    );

    await expect(
      service.notifyTurnChanged({
        roomId: 'room-1',
        seatId: asSeatId('player-2'),
      }),
    ).resolves.toBeUndefined();

    await jest.advanceTimersByTimeAsync(60_000);

    expect(pushNotificationService.sendTurnNotification).toHaveBeenCalledTimes(
      1,
    );
  });

  it('sends delayed turn notifications after the delayed transition', async () => {
    await service.notifyTurnChanged({
      roomId: 'room-1',
      seatId: asSeatId('player-2'),
      transitionDelayMs: 1_000,
    });

    expect(pushNotificationService.sendTurnNotification).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(60_999);

    expect(pushNotificationService.sendTurnNotification).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);

    expect(pushNotificationService.sendTurnNotification).toHaveBeenCalledTimes(
      1,
    );
  });

  it('clears delayed turn notification timers on module destroy', async () => {
    await service.notifyTurnChanged({
      roomId: 'room-1',
      seatId: asSeatId('player-2'),
      transitionDelayMs: 1_000,
    });
    service.onModuleDestroy();

    await jest.advanceTimersByTimeAsync(61_000);

    expect(pushNotificationService.sendTurnNotification).not.toHaveBeenCalled();
  });

  it('does not send a turn push before a player has stalled for 60 seconds', async () => {
    await service.notifyTurnChanged({
      roomId: 'room-1',
      seatId: asSeatId('player-2'),
    });

    await jest.advanceTimersByTimeAsync(59_999);
    expect(pushNotificationService.sendTurnNotification).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);
    expect(pushNotificationService.sendTurnNotification).toHaveBeenCalledTimes(
      1,
    );
  });

  it('skips the turn push when the player reconnects before the deadline', async () => {
    await service.notifyTurnChanged({
      roomId: 'room-1',
      seatId: asSeatId('player-2'),
    });
    connectionSocketIds.set('player-2', 'socket-reconnected');

    await jest.advanceTimersByTimeAsync(60_000);

    expect(pushNotificationService.sendTurnNotification).not.toHaveBeenCalled();
  });

  it('replaces the pending timer when the turn moves to another seat', async () => {
    connectionSocketIds.set('player-1', '');
    await service.notifyTurnChanged({
      roomId: 'room-1',
      seatId: asSeatId('player-2'),
    });

    gameState = state({
      currentSeatId: asSeatId('player-1'),
      blowState: {
        ...gameState.blowState,
        currentBlowIndex: 1,
        actionHistory: [
          {
            type: 'pass',
            seatId: asSeatId('player-2'),
            timestamp: 1,
          },
        ],
      },
    });
    await service.notifyTurnChanged({
      roomId: 'room-1',
      seatId: asSeatId('player-1'),
    });

    await jest.advanceTimersByTimeAsync(60_000);

    expect(pushNotificationService.sendTurnNotification).toHaveBeenCalledTimes(
      1,
    );
    expect(pushNotificationService.sendTurnNotification).toHaveBeenCalledWith(
      ['user-1'],
      expect.objectContaining({
        eventId: 'turn:room-1:1:blow:player-1:1:1:0:0:player-1',
      }),
    );
  });

  it('does not let an older scheduling request clear the latest turn timer', async () => {
    let resolveFirstRoom!: (value: Room) => void;
    const firstRoom = new Promise<Room>((resolve) => {
      resolveFirstRoom = resolve;
    });
    roomService.getRoom
      .mockImplementationOnce(() => firstRoom)
      .mockImplementation(async () => currentRoom);

    gameState = state({ currentSeatId: asSeatId('player-1') });
    const olderRequest = service.notifyTurnChanged({
      roomId: 'room-1',
      seatId: asSeatId('player-1'),
    });

    gameState = state({
      currentSeatId: asSeatId('player-2'),
      blowState: {
        ...gameState.blowState,
        currentBlowIndex: 1,
        actionHistory: [
          {
            type: 'pass',
            seatId: asSeatId('player-1'),
            timestamp: 1,
          },
        ],
      },
    });
    await service.notifyTurnChanged({
      roomId: 'room-1',
      seatId: asSeatId('player-2'),
    });

    resolveFirstRoom(currentRoom);
    await olderRequest;
    await jest.advanceTimersByTimeAsync(60_000);

    expect(pushNotificationService.sendTurnNotification).toHaveBeenCalledWith(
      ['user-2'],
      expect.objectContaining({
        eventId: 'turn:room-1:1:blow:player-2:1:1:0:0:player-1',
      }),
    );
  });

  it('drops the old timer when the phase changes', async () => {
    await service.notifyTurnChanged({
      roomId: 'room-1',
      seatId: asSeatId('player-2'),
    });
    gameState = state({ gamePhase: 'play' });

    await jest.advanceTimersByTimeAsync(60_000);

    expect(pushNotificationService.sendTurnNotification).not.toHaveBeenCalled();
  });

  it('drops the old timer when the player is converted to COM', async () => {
    await service.notifyTurnChanged({
      roomId: 'room-1',
      seatId: asSeatId('player-2'),
    });
    currentRoom = room({
      players: currentRoom.players.map((player) =>
        player.seatId === asSeatId('player-2')
          ? { ...player, isCOM: true, userId: undefined }
          : player,
      ),
    });

    await jest.advanceTimersByTimeAsync(60_000);

    expect(pushNotificationService.sendTurnNotification).not.toHaveBeenCalled();
  });

  it('drops an old timer when a later turn cycles back to the same seat', async () => {
    await service.notifyTurnChanged({
      roomId: 'room-1',
      seatId: asSeatId('player-2'),
    });
    await jest.advanceTimersByTimeAsync(30_000);

    gameState = state({
      blowState: {
        ...gameState.blowState,
        currentBlowIndex: 4,
        actionHistory: ['player-2', 'player-3', 'player-4', 'player-1'].map(
          (seatId, index) => ({
            type: 'pass' as const,
            seatId: asSeatId(seatId),
            timestamp: index + 1,
          }),
        ),
      },
    });
    await service.notifyTurnChanged({
      roomId: 'room-1',
      seatId: asSeatId('player-2'),
    });

    await jest.advanceTimersByTimeAsync(30_000);

    expect(pushNotificationService.sendTurnNotification).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(30_000);

    expect(pushNotificationService.sendTurnNotification).toHaveBeenCalledWith(
      ['user-2'],
      expect.objectContaining({
        eventId: 'turn:room-1:1:blow:player-2:4:4:0:0:player-1',
      }),
    );
  });

  it('does not send game-start pushes to connected players', async () => {
    connectionSocketIds.set('player-2', 'socket-2-live');

    await service.notifyGameStarted({ roomId: 'room-1' });

    expect(pushNotificationService.sendGameStarted).not.toHaveBeenCalled();
  });

  it('includes a disconnected first-turn player in the game-start push', async () => {
    await service.notifyGameStarted({ roomId: 'room-1' });

    expect(pushNotificationService.sendGameStarted).toHaveBeenCalledWith(
      ['user-2'],
      expect.objectContaining({ eventId: 'game-started:room-1:1' }),
    );
  });

  it('does not send game-start pushes for later rounds', async () => {
    gameState = state({ roundNumber: 2 });

    await service.notifyGameStarted({ roomId: 'room-1' });

    expect(pushNotificationService.sendGameStarted).not.toHaveBeenCalled();
  });

  it('respects disabled notification preferences for game-start pushes', async () => {
    userProfileRepository.findById.mockResolvedValue(profile('user-2', false));

    await service.notifyGameStarted({ roomId: 'room-1' });

    expect(pushNotificationService.sendGameStarted).not.toHaveBeenCalled();
  });
});
