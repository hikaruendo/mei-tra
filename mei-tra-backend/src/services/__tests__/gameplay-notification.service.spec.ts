import { asSeatId } from '../../types/identity.types';
import { GameplayNotificationService } from '../gameplay-notification.service';
import type { PushNotificationService } from '../../push/push-notification.service';
import type { IUserProfileRepository } from '../../repositories/interfaces/user-profile.repository.interface';
import type { IRoomService } from '../interfaces/room-service.interface';
import type { GameState } from '../../types/game.types';
import { Room, RoomStatus } from '../../types/room.types';
import { UserProfile } from '../../types/user.types';

const state = (overrides: Partial<GameState> = {}): GameState =>
  ({
    players: [],
    currentPlayerIndex: 0,
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
        playedBy: [],
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
    teamAssignments: {},
    ...overrides,
  }) as GameState;

const room = (overrides: Partial<Room> = {}): Room => ({
  id: 'room-1',
  name: 'Room',
  hostSeatId: asSeatId('player-1'),
  status: RoomStatus.PLAYING,
  players: [
    {
      playerId: 'player-1',
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
      playerId: 'player-2',
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
      playerId: 'com-3',
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
  let service: GameplayNotificationService;

  beforeEach(() => {
    gameState = state();
    roomService = {
      getRoom: jest.fn().mockResolvedValue(room()),
      getRoomGameState: jest.fn().mockResolvedValue({
        getState: jest.fn(() => gameState),
      }),
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

  it('sends game-started once to eligible human recipients only', async () => {
    await service.notifyGameStarted({
      roomId: 'room-1',
      initiatingActorId: 'player-1',
      currentTurnPlayerId: 'com-3',
    });
    await service.notifyGameStarted({
      roomId: 'room-1',
      initiatingActorId: 'player-1',
      currentTurnPlayerId: 'com-3',
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

  it('sends one turn notification per transition and suppresses replay duplicates', async () => {
    await service.notifyTurnChanged({
      roomId: 'room-1',
      playerId: 'player-2',
      initiatingActorId: 'player-1',
    });
    await service.notifyTurnChanged({
      roomId: 'room-1',
      playerId: 'player-2',
      initiatingActorId: 'player-1',
    });

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
      playerId: 'com-3',
    });
    await service.notifyTurnChanged({
      roomId: 'room-1',
      playerId: 'player-2',
    });

    expect(pushNotificationService.sendTurnNotification).not.toHaveBeenCalled();
  });

  it('catches push failures so gameplay callers can continue', async () => {
    pushNotificationService.sendTurnNotification.mockRejectedValue(
      new Error('expo down'),
    );

    await expect(
      service.notifyTurnChanged({
        roomId: 'room-1',
        playerId: 'player-2',
      }),
    ).resolves.toBeUndefined();

    expect(pushNotificationService.sendTurnNotification).toHaveBeenCalledTimes(
      1,
    );
  });

  it('sends delayed turn notifications after the delayed transition', async () => {
    jest.useFakeTimers();

    await service.notifyTurnChanged({
      roomId: 'room-1',
      playerId: 'player-2',
      delayMs: 1_000,
    });

    expect(pushNotificationService.sendTurnNotification).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1_000);

    expect(pushNotificationService.sendTurnNotification).toHaveBeenCalledTimes(
      1,
    );
    jest.useRealTimers();
  });

  it('clears delayed turn notification timers on module destroy', async () => {
    jest.useFakeTimers();

    await service.notifyTurnChanged({
      roomId: 'room-1',
      playerId: 'player-2',
      delayMs: 1_000,
    });
    service.onModuleDestroy();

    await jest.advanceTimersByTimeAsync(1_000);

    expect(pushNotificationService.sendTurnNotification).not.toHaveBeenCalled();
    jest.useRealTimers();
  });
});
