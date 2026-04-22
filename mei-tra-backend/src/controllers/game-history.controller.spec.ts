import { GameHistoryController } from './game-history.controller';
import { IRoomRepository } from '../repositories/interfaces/room.repository.interface';
import { Room, RoomStatus } from '../types/room.types';
import { AuthenticatedUser } from '../types/user.types';
import { IGetGameHistoryUseCase } from '../use-cases/interfaces/get-game-history.use-case.interface';

describe('GameHistoryController', () => {
  const currentUser = {
    id: 'user-1',
    email: 'user@example.com',
    profile: {
      id: 'user-1',
      username: 'user',
      displayName: 'User',
      createdAt: new Date('2026-04-16T00:00:00.000Z'),
      updatedAt: new Date('2026-04-16T00:00:00.000Z'),
      lastSeenAt: new Date('2026-04-16T00:00:00.000Z'),
      gamesPlayed: 0,
      gamesWon: 0,
      totalScore: 0,
      preferences: {
        notifications: true,
        sound: true,
        theme: 'light' as const,
        fontSize: 'standard' as const,
      },
    },
  } satisfies AuthenticatedUser;

  const room = {
    id: 'room-1',
    name: 'Room 1',
    hostId: 'player-1',
    status: RoomStatus.FINISHED,
    players: [
      {
        socketId: 'socket-1',
        playerId: 'player-1',
        userId: 'user-1',
        isAuthenticated: true,
        name: 'Player 1',
        hand: [],
        team: 0 as const,
        isPasser: false,
        hasBroken: false,
        hasRequiredBroken: false,
        isReady: true,
        isHost: true,
        joinedAt: new Date('2026-04-16T00:00:00.000Z'),
      },
    ],
    settings: {
      maxPlayers: 4,
      isPrivate: false,
      password: null,
      teamAssignmentMethod: 'random' as const,
      pointsToWin: 10,
      allowSpectators: false,
    },
    createdAt: new Date('2026-04-16T00:00:00.000Z'),
    updatedAt: new Date('2026-04-16T00:00:00.000Z'),
    lastActivityAt: new Date('2026-04-16T00:00:00.000Z'),
  } satisfies Room;

  const createRoomRepository = (nextRoom: Room | null = room) =>
    ({
      findById: jest.fn().mockResolvedValue(nextRoom),
    }) as unknown as jest.Mocked<IRoomRepository>;

  it('returns the room history from the use-case', async () => {
    const history = [
      {
        id: 'history-1',
        roomId: 'room-1',
        gameStateId: 'state-1',
        actionType: 'game_started' as const,
        playerId: null,
        actionData: {},
        timestamp: new Date('2026-04-16T00:00:00.000Z'),
      },
    ];

    const getGameHistoryUseCase: IGetGameHistoryUseCase = {
      execute: jest.fn().mockResolvedValue(history),
      replay: jest.fn(),
      summarize: jest.fn(),
    };
    const roomRepository = createRoomRepository();

    const controller = new GameHistoryController(
      getGameHistoryUseCase,
      roomRepository,
    );

    await expect(
      controller.listByRoomId('room-1', {}, currentUser),
    ).resolves.toEqual(history);
    expect(roomRepository.findById).toHaveBeenCalledWith('room-1');
    expect(getGameHistoryUseCase.execute).toHaveBeenCalledWith('room-1', {
      actionType: undefined,
      limit: undefined,
      playerId: undefined,
      roundNumber: undefined,
      since: undefined,
      until: undefined,
    });
  });

  it('builds summary queries from request params', async () => {
    const summary = {
      roomId: 'room-1',
      totalEntries: 2,
      byActionType: { game_started: 1, card_played: 1 },
      playerIds: ['player-1'],
      playerNames: { 'player-1': 'Player One' },
      status: 'in_progress' as const,
      winningTeam: null,
      lastActionType: 'card_played' as const,
      roundNumbers: [1],
      firstTimestamp: new Date('2026-04-16T00:00:00.000Z'),
      lastTimestamp: new Date('2026-04-16T00:05:00.000Z'),
    };

    const getGameHistoryUseCase: IGetGameHistoryUseCase = {
      execute: jest.fn(),
      replay: jest.fn(),
      summarize: jest.fn().mockResolvedValue(summary),
    };
    const roomRepository = createRoomRepository();

    const controller = new GameHistoryController(
      getGameHistoryUseCase,
      roomRepository,
    );

    await expect(
      controller.summarizeByRoomId(
        'room-1',
        {
          actionType: 'card_played',
          playerId: 'player-1',
          roundNumber: '2',
          since: '2026-04-16T00:00:00.000Z',
          until: '2026-04-16T01:00:00.000Z',
          limit: '10',
        },
        currentUser,
      ),
    ).resolves.toEqual(summary);

    expect(getGameHistoryUseCase.summarize).toHaveBeenCalledWith('room-1', {
      actionType: 'card_played',
      playerId: 'player-1',
      roundNumber: 2,
      since: new Date('2026-04-16T00:00:00.000Z'),
      until: new Date('2026-04-16T01:00:00.000Z'),
      limit: 10,
    });
  });

  it('returns replay groups from the use-case', async () => {
    const replay = {
      roomId: 'room-1',
      totalEntries: 1,
      rounds: [
        {
          roundNumber: 1,
          startedAt: new Date('2026-04-16T00:00:00.000Z'),
          endedAt: new Date('2026-04-16T00:00:00.000Z'),
          actionTypes: ['game_started' as const],
          playerIds: [],
          entries: [
            {
              id: 'history-1',
              roomId: 'room-1',
              gameStateId: 'state-1',
              actionType: 'game_started' as const,
              playerId: 'player-1',
              actionData: {
                startingHandsByPlayerId: {
                  'player-1': ['S-A', 'H-9'],
                  'player-2': ['D-5'],
                },
              },
              timestamp: new Date('2026-04-16T00:00:00.000Z'),
            },
          ],
          events: [
            {
              id: 'history-1',
              timestamp: new Date('2026-04-16T00:00:00.000Z'),
              actionType: 'game_started' as const,
              kind: 'lifecycle' as const,
              playerId: 'player-1',
              roundNumber: 1,
              gamePhase: 'blow' as const,
              summary: 'Game started',
              details: {
                firstBlowPlayerId: 'player-1',
                startedByPlayerId: 'player-1',
                pointsToWin: 10,
              },
              detailItems: [],
              actionData: {
                startingHandsByPlayerId: {
                  'player-1': ['S-A', 'H-9'],
                  'player-2': ['D-5'],
                },
              },
            },
          ],
        },
      ],
    };

    const getGameHistoryUseCase: IGetGameHistoryUseCase = {
      execute: jest.fn(),
      replay: jest.fn().mockResolvedValue(replay),
      summarize: jest.fn(),
    };
    const roomRepository = createRoomRepository();

    const controller = new GameHistoryController(
      getGameHistoryUseCase,
      roomRepository,
    );

    await expect(
      controller.replayByRoomId('room-1', { limit: '5' }, currentUser),
    ).resolves.toEqual({
      ...replay,
      rounds: [
        expect.objectContaining({
          viewerStartingHand: ['S-A', 'H-9'],
          entries: [
            expect.objectContaining({
              actionData: {
                viewerStartingHand: ['S-A', 'H-9'],
              },
            }),
          ],
          events: [
            expect.objectContaining({
              actionData: {
                viewerStartingHand: ['S-A', 'H-9'],
              },
            }),
          ],
        }),
      ],
    });
    expect(getGameHistoryUseCase.replay).toHaveBeenCalledWith('room-1', {
      actionType: undefined,
      limit: 5,
      playerId: undefined,
      roundNumber: undefined,
      since: undefined,
      until: undefined,
    });
  });

  it('sanitizes invalid query params before delegating', async () => {
    const getGameHistoryUseCase: IGetGameHistoryUseCase = {
      execute: jest.fn().mockResolvedValue([]),
      replay: jest.fn(),
      summarize: jest.fn(),
    };
    const roomRepository = createRoomRepository();

    const controller = new GameHistoryController(
      getGameHistoryUseCase,
      roomRepository,
    );

    await expect(
      controller.listByRoomId(
        'room-1',
        {
          actionType: 'not-real',
          limit: 'NaN',
          roundNumber: 'also-bad',
          since: 'invalid-date',
          until: 'still-invalid',
        },
        currentUser,
      ),
    ).resolves.toEqual([]);

    expect(getGameHistoryUseCase.execute).toHaveBeenCalledWith('room-1', {
      actionType: undefined,
      limit: undefined,
      playerId: undefined,
      roundNumber: undefined,
      since: undefined,
      until: undefined,
    });
  });

  it('rejects users who did not participate in the room', async () => {
    const getGameHistoryUseCase: IGetGameHistoryUseCase = {
      execute: jest.fn(),
      replay: jest.fn(),
      summarize: jest.fn(),
    };
    const roomRepository = createRoomRepository({
      ...room,
      players: [{ ...room.players[0], userId: 'other-user' }],
    });
    const controller = new GameHistoryController(
      getGameHistoryUseCase,
      roomRepository,
    );

    await expect(
      controller.summarizeByRoomId('room-1', {}, currentUser),
    ).rejects.toMatchObject({ status: 403 });
    expect(getGameHistoryUseCase.summarize).not.toHaveBeenCalled();
  });

  it('returns 404 when the room does not exist', async () => {
    const getGameHistoryUseCase: IGetGameHistoryUseCase = {
      execute: jest.fn(),
      replay: jest.fn(),
      summarize: jest.fn(),
    };
    const roomRepository = createRoomRepository(null);
    const controller = new GameHistoryController(
      getGameHistoryUseCase,
      roomRepository,
    );

    await expect(
      controller.replayByRoomId('missing-room', {}, currentUser),
    ).rejects.toMatchObject({ status: 404 });
    expect(getGameHistoryUseCase.replay).not.toHaveBeenCalled();
  });
});
