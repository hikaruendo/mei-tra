import { GameHistoryController } from './game-history.controller';
import { IGetGameHistoryUseCase } from '../use-cases/interfaces/get-game-history.use-case.interface';

describe('GameHistoryController', () => {
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

    const controller = new GameHistoryController(getGameHistoryUseCase);

    await expect(controller.listByRoomId('room-1', {})).resolves.toEqual(
      history,
    );
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

    const controller = new GameHistoryController(getGameHistoryUseCase);

    await expect(
      controller.summarizeByRoomId('room-1', {
        actionType: 'card_played',
        playerId: 'player-1',
        roundNumber: '2',
        since: '2026-04-16T00:00:00.000Z',
        until: '2026-04-16T01:00:00.000Z',
        limit: '10',
      }),
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
          entries: [],
        },
      ],
    };

    const getGameHistoryUseCase: IGetGameHistoryUseCase = {
      execute: jest.fn(),
      replay: jest.fn().mockResolvedValue(replay),
      summarize: jest.fn(),
    };

    const controller = new GameHistoryController(getGameHistoryUseCase);

    await expect(
      controller.replayByRoomId('room-1', { limit: '5' }),
    ).resolves.toEqual(replay);
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

    const controller = new GameHistoryController(getGameHistoryUseCase);

    await expect(
      controller.listByRoomId('room-1', {
        actionType: 'not-real',
        limit: 'NaN',
        roundNumber: 'also-bad',
        since: 'invalid-date',
        until: 'still-invalid',
      }),
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
});
