import { GameHistoryController } from './game-history.controller';
import { IRoomRepository } from '../repositories/interfaces/room.repository.interface';
import { Room, RoomStatus } from '../types/room.types';
import { AuthenticatedUser } from '../types/user.types';
import { IGetGameHistoryUseCase } from '../use-cases/interfaces/get-game-history.use-case.interface';
import { asSeatId } from '../types/identity.types';
import type { GameParticipant } from '../types/game-participant.types';
import type { RoomMembershipReplayEvent } from '../types/room-membership.types';
import { RoomMembershipService } from '../services/room-membership.service';
import { GameHistoryMembershipLogService } from '../services/game-history-membership-log.service';

describe('GameHistoryController', () => {
  const actorSeatId = asSeatId('11111111-1111-4111-8111-111111111111');
  const currentUser = {
    id: 'user-1',
    email: 'user@example.com',
    isAnonymous: false,
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
    hostSeatId: asSeatId('player-1'),
    status: RoomStatus.FINISHED,
    players: [
      {
        socketId: 'socket-1',
        seatId: asSeatId('player-1'),
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
      teamNames: { 0: '111', 1: '222' },
    },
    createdAt: new Date('2026-04-16T00:00:00.000Z'),
    updatedAt: new Date('2026-04-16T00:00:00.000Z'),
    lastActivityAt: new Date('2026-04-16T00:00:00.000Z'),
  } satisfies Room;

  const defaultParticipants: GameParticipant[] = [
    {
      roomId: room.id,
      seatId: room.players[0].seatId,
      userId: currentUser.id,
      playerName: room.players[0].name,
      team: room.players[0].team,
      joinedAt: room.players[0].joinedAt,
    },
  ];

  const createRoomRepository = (
    nextRoom: Room | null = room,
    gameParticipants: GameParticipant[] = defaultParticipants,
  ) =>
    ({
      findById: jest.fn().mockResolvedValue(nextRoom),
      findGameParticipants: jest.fn().mockResolvedValue(gameParticipants),
    }) as unknown as jest.Mocked<IRoomRepository>;

  const createRoomMembershipService = (
    replayEvents: RoomMembershipReplayEvent[] = [],
  ) =>
    ({
      listReplayEventsForRoom: jest.fn().mockResolvedValue(replayEvents),
    }) as unknown as jest.Mocked<RoomMembershipService>;

  const createController = (
    getGameHistoryUseCase: IGetGameHistoryUseCase,
    roomRepository: jest.Mocked<IRoomRepository>,
    roomMembershipService = createRoomMembershipService(),
  ) =>
    new GameHistoryController(
      getGameHistoryUseCase,
      roomRepository,
      roomMembershipService,
      new GameHistoryMembershipLogService(),
    );

  it('returns the room history from the use-case', async () => {
    const history = [
      {
        id: 'history-1',
        roomId: 'room-1',
        gameStateId: 'state-1',
        actionType: 'game_started' as const,
        seatId: null,
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

    const controller = createController(getGameHistoryUseCase, roomRepository);

    await expect(
      controller.listByRoomId('room-1', {}, currentUser),
    ).resolves.toEqual(history);
    expect(roomRepository.findById).toHaveBeenCalledWith('room-1');
    expect(getGameHistoryUseCase.execute).toHaveBeenCalledWith('room-1', {
      actionType: undefined,
      limit: undefined,
      actorSeatId: undefined,
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
      actorSeatIds: [asSeatId('player-1')],
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

    const controller = createController(getGameHistoryUseCase, roomRepository);

    await expect(
      controller.summarizeByRoomId(
        'room-1',
        {
          actionType: 'card_played',
          actorSeatId,
          roundNumber: '2',
          since: '2026-04-16T00:00:00.000Z',
          until: '2026-04-16T01:00:00.000Z',
          limit: '10',
        },
        currentUser,
      ),
    ).resolves.toEqual({
      ...summary,
      teamNames: { 0: '111', 1: '222' },
    });

    expect(getGameHistoryUseCase.summarize).toHaveBeenCalledWith(
      'room-1',
      {
        actionType: 'card_played',
        actorSeatId,
        roundNumber: 2,
        since: new Date('2026-04-16T00:00:00.000Z'),
        until: new Date('2026-04-16T01:00:00.000Z'),
        limit: 10,
      },
      {
        'player-1': 'Player 1',
      },
    );
  });

  it('uses the historical participant after the current seat becomes COM', async () => {
    const summary = {
      roomId: 'room-1',
      totalEntries: 1,
      byActionType: { game_over: 1 },
      actorSeatIds: [room.players[0].seatId],
      playerNames: {},
      status: 'completed' as const,
      winningTeam: 0,
      lastActionType: 'game_over' as const,
      roundNumbers: [1],
      firstTimestamp: new Date('2026-04-16T00:00:00.000Z'),
      lastTimestamp: new Date('2026-04-16T00:05:00.000Z'),
    };
    const getGameHistoryUseCase: IGetGameHistoryUseCase = {
      execute: jest.fn(),
      replay: jest.fn(),
      summarize: jest.fn().mockResolvedValue(summary),
    };
    const roomRepository = createRoomRepository({
      ...room,
      players: [
        {
          ...room.players[0],
          userId: undefined,
          isAuthenticated: false,
          isCOM: true,
          name: 'COM',
        },
      ],
    });
    const controller = createController(getGameHistoryUseCase, roomRepository);

    await expect(
      controller.summarizeByRoomId('room-1', {}, currentUser),
    ).resolves.toEqual({
      ...summary,
      teamNames: { 0: '111', 1: '222' },
    });
    expect(getGameHistoryUseCase.summarize).toHaveBeenCalledWith(
      'room-1',
      expect.any(Object),
      { 'player-1': 'Player 1' },
    );
  });

  it('allows an authenticated spectator to read active room history', async () => {
    const summary = {
      roomId: 'room-1',
      totalEntries: 1,
      byActionType: { card_played: 1 },
      actorSeatIds: [asSeatId('player-1')],
      playerNames: { 'player-1': 'Player 1' },
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
    const roomRepository = createRoomRepository(
      {
        ...room,
        status: RoomStatus.PLAYING,
        settings: { ...room.settings, allowSpectators: true },
        players: [
          {
            ...room.players[0],
            userId: 'other-user',
          },
        ],
      },
      [],
    );
    const controller = createController(getGameHistoryUseCase, roomRepository);

    await expect(
      controller.summarizeByRoomId('room-1', {}, currentUser),
    ).resolves.toEqual({
      ...summary,
      teamNames: { 0: '111', 1: '222' },
    });
    expect(getGameHistoryUseCase.summarize).toHaveBeenCalledWith(
      'room-1',
      {
        actionType: undefined,
        limit: undefined,
        actorSeatId: undefined,
        roundNumber: undefined,
        since: undefined,
        until: undefined,
      },
      { 'player-1': 'Player 1' },
    );
  });

  it('does not expose starting hands to spectators', async () => {
    const replay = {
      roomId: 'room-1',
      totalEntries: 1,
      rounds: [
        {
          roundNumber: 1,
          startedAt: new Date('2026-04-16T00:00:00.000Z'),
          endedAt: null,
          actionTypes: ['game_started' as const],
          actorSeatIds: [],
          entries: [
            {
              id: 'history-1',
              roomId: 'room-1',
              gameStateId: 'state-1',
              actionType: 'game_started' as const,
              seatId: 'player-1',
              actionData: {
                startingHandsBySeatId: { 'player-1': ['S-A'] },
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
              seatId: 'player-1',
              roundNumber: 1,
              gamePhase: 'blow' as const,
              summary: 'Game started',
              details: {},
              detailItems: [],
              actionData: {
                startingHandsBySeatId: { 'player-1': ['S-A'] },
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
    const roomRepository = createRoomRepository(
      {
        ...room,
        status: RoomStatus.PLAYING,
        settings: { ...room.settings, allowSpectators: true },
        players: [
          {
            ...room.players[0],
            userId: 'other-user',
          },
        ],
      },
      [],
    );
    const controller = createController(getGameHistoryUseCase, roomRepository);

    await expect(
      controller.replayByRoomId('room-1', {}, currentUser),
    ).resolves.toEqual(
      expect.objectContaining({
        rounds: [
          expect.objectContaining({
            viewerStartingHand: [],
            entries: [expect.objectContaining({ actionData: {} })],
            events: [expect.objectContaining({ actionData: {} })],
          }),
        ],
      }),
    );
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
          actorSeatIds: [],
          entries: [
            {
              id: 'history-1',
              roomId: 'room-1',
              gameStateId: 'state-1',
              actionType: 'game_started' as const,
              seatId: 'player-1',
              actionData: {
                startingHandsBySeatId: {
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
              seatId: 'player-1',
              roundNumber: 1,
              gamePhase: 'blow' as const,
              summary: 'Game started',
              details: {
                firstBlowSeatId: 'player-1',
                startedBySeatId: 'player-1',
                pointsToWin: 10,
              },
              detailItems: [],
              actionData: {
                startingHandsBySeatId: {
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

    const controller = createController(getGameHistoryUseCase, roomRepository);

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
    expect(getGameHistoryUseCase.replay).toHaveBeenCalledWith(
      'room-1',
      {
        actionType: undefined,
        limit: 5,
        actorSeatId: undefined,
        roundNumber: undefined,
        since: undefined,
        until: undefined,
      },
      {
        'player-1': 'Player 1',
      },
    );
  });

  it('adds visible player join and leave events to replay rounds', async () => {
    const replay = {
      roomId: 'room-1',
      totalEntries: 1,
      rounds: [
        {
          roundNumber: 1,
          startedAt: new Date('2026-04-16T00:00:00.000Z'),
          endedAt: new Date('2026-04-16T00:10:00.000Z'),
          actionTypes: ['game_started' as const],
          actorSeatIds: [],
          entries: [],
          events: [
            {
              id: 'history-1',
              timestamp: new Date('2026-04-16T00:00:00.000Z'),
              actionType: 'game_started' as const,
              kind: 'lifecycle' as const,
              actorSeatId: room.players[0].seatId,
              roundNumber: 1,
              gamePhase: 'blow' as const,
              summary: 'Game started',
              details: {
                firstBlowSeatId: room.players[0].seatId,
                startedBySeatId: room.players[0].seatId,
                pointsToWin: 10,
              },
              detailItems: [],
              actionData: {},
            },
          ],
        },
      ],
    };
    const membershipEvents: RoomMembershipReplayEvent[] = [
      {
        id: 'membership-1',
        eventType: 'player_joined',
        userId: 'user-2',
        roomId: room.id,
        seatId: room.players[0].seatId,
        timestamp: new Date('2026-04-16T00:02:00.000Z'),
      },
      {
        id: 'membership-2',
        eventType: 'player_left',
        userId: 'user-2',
        roomId: room.id,
        seatId: room.players[0].seatId,
        timestamp: new Date('2026-04-16T00:03:00.000Z'),
      },
    ];

    const getGameHistoryUseCase: IGetGameHistoryUseCase = {
      execute: jest.fn(),
      replay: jest.fn().mockResolvedValue(replay),
      summarize: jest.fn(),
    };
    const roomRepository = createRoomRepository(room, [
      ...defaultParticipants,
      {
        roomId: room.id,
        seatId: room.players[0].seatId,
        userId: 'user-2',
        playerName: 'Player 2',
        team: 1,
        joinedAt: new Date('2026-04-16T00:01:00.000Z'),
      },
    ]);
    const roomMembershipService = createRoomMembershipService(membershipEvents);
    const controller = createController(
      getGameHistoryUseCase,
      roomRepository,
      roomMembershipService,
    );

    const result = await controller.replayByRoomId('room-1', {}, currentUser);
    const round = result.rounds[0];
    const joinedEvent = round.events.find(
      (event) => event.actionType === 'player_joined',
    );
    const leftEvent = round.events.find(
      (event) => event.actionType === 'player_left',
    );
    const playerDetail = joinedEvent?.detailItems.find(
      (detailItem) => detailItem.labelKey === 'player',
    );
    const leftPlayerDetail = leftEvent?.detailItems.find(
      (detailItem) => detailItem.labelKey === 'player',
    );

    expect(result.totalEntries).toBe(3);
    expect(round.actionTypes).toEqual([
      'game_started',
      'player_joined',
      'player_left',
    ]);
    expect(round.actorSeatIds).toEqual([room.players[0].seatId]);
    expect(round.events.map((event) => event.actionType)).toEqual([
      'game_started',
      'player_joined',
      'player_left',
    ]);
    expect(joinedEvent?.actorSeatId).toBe(room.players[0].seatId);
    expect(leftEvent?.actorSeatId).toBe(room.players[0].seatId);
    expect(playerDetail?.value).toEqual({
      kind: 'player',
      seatId: room.players[0].seatId,
      playerName: 'Player 2',
    });
    expect(leftPlayerDetail?.value).toEqual({
      kind: 'player',
      seatId: room.players[0].seatId,
      playerName: 'Player 2',
    });
    expect(roomMembershipService.listReplayEventsForRoom).toHaveBeenCalledWith(
      'room-1',
    );
  });

  it('sanitizes invalid query params before delegating', async () => {
    const getGameHistoryUseCase: IGetGameHistoryUseCase = {
      execute: jest.fn().mockResolvedValue([]),
      replay: jest.fn(),
      summarize: jest.fn(),
    };
    const roomRepository = createRoomRepository();

    const controller = createController(getGameHistoryUseCase, roomRepository);

    await expect(
      controller.listByRoomId(
        'room-1',
        {
          actionType: 'not-real',
          actorSeatId: 'not-a-uuid',
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
      actorSeatId: undefined,
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
    const roomRepository = createRoomRepository(
      {
        ...room,
        players: [{ ...room.players[0], userId: 'other-user' }],
      },
      [],
    );
    const controller = createController(getGameHistoryUseCase, roomRepository);

    await expect(
      controller.summarizeByRoomId('room-1', {}, currentUser),
    ).rejects.toMatchObject({ status: 403 });
    expect(getGameHistoryUseCase.summarize).not.toHaveBeenCalled();
  });

  it('rejects an ambiguous participant identity', async () => {
    const getGameHistoryUseCase: IGetGameHistoryUseCase = {
      execute: jest.fn(),
      replay: jest.fn(),
      summarize: jest.fn(),
    };
    const roomRepository = createRoomRepository(room, [
      defaultParticipants[0],
      {
        ...defaultParticipants[0],
        seatId: asSeatId('player-duplicate'),
      },
    ]);
    const controller = createController(getGameHistoryUseCase, roomRepository);

    await expect(
      controller.listByRoomId('room-1', {}, currentUser),
    ).rejects.toThrow('Cannot access another user game history');
    expect(getGameHistoryUseCase.execute).not.toHaveBeenCalled();
  });

  it('returns 404 when the room does not exist', async () => {
    const getGameHistoryUseCase: IGetGameHistoryUseCase = {
      execute: jest.fn(),
      replay: jest.fn(),
      summarize: jest.fn(),
    };
    const roomRepository = createRoomRepository(null);
    const controller = createController(getGameHistoryUseCase, roomRepository);

    await expect(
      controller.replayByRoomId('missing-room', {}, currentUser),
    ).rejects.toMatchObject({ status: 404 });
    expect(getGameHistoryUseCase.replay).not.toHaveBeenCalled();
  });
});
