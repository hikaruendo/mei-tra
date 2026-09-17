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
    } as unknown as jest.Mocked<PushNotificationService>;
    service = new GameplayNotificationService(
      roomService,
      userProfileRepository,
      pushNotificationService,
    );
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

  it('catches push failures so gameplay callers can continue', async () => {
    pushNotificationService.sendGameStarted.mockRejectedValue(
      new Error('expo down'),
    );

    await expect(
      service.notifyGameStarted({ roomId: 'room-1' }),
    ).resolves.toBeUndefined();

    expect(pushNotificationService.sendGameStarted).toHaveBeenCalledTimes(1);
  });

  it('respects disabled notification preferences for game-start pushes', async () => {
    userProfileRepository.findById.mockResolvedValue(profile('user-2', false));

    await service.notifyGameStarted({ roomId: 'room-1' });

    expect(pushNotificationService.sendGameStarted).not.toHaveBeenCalled();
  });
});
