import { GetGameHistoryUseCase } from '../get-game-history.use-case';
import { IGameEventLogService } from '../../services/interfaces/game-event-log.service.interface';

describe('GetGameHistoryUseCase', () => {
  it('delegates room history reads to the event log service', async () => {
    const history = [
      {
        id: 'history-1',
        roomId: 'room-1',
        gameStateId: 'state-1',
        actionType: 'game_started' as const,
        playerId: 'player-1',
        actionData: {},
        timestamp: new Date('2026-04-16T00:00:00.000Z'),
      },
    ];

    const gameEventLogService: IGameEventLogService = {
      log: jest.fn(),
      listByRoomId: jest.fn().mockResolvedValue(history),
      replayByRoomId: jest.fn(),
      summarizeByRoomId: jest.fn(),
    };

    const useCase = new GetGameHistoryUseCase(gameEventLogService);

    await expect(useCase.execute('room-1')).resolves.toEqual(history);
    expect(gameEventLogService.listByRoomId).toHaveBeenCalledWith(
      'room-1',
      undefined,
    );
  });

  it('delegates room history summaries to the event log service', async () => {
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
    const query = { actionType: 'card_played' as const, limit: 5 };

    const gameEventLogService: IGameEventLogService = {
      log: jest.fn(),
      listByRoomId: jest.fn(),
      replayByRoomId: jest.fn(),
      summarizeByRoomId: jest.fn().mockResolvedValue(summary),
    };

    const useCase = new GetGameHistoryUseCase(gameEventLogService);

    await expect(useCase.summarize('room-1', query)).resolves.toEqual(summary);
    expect(gameEventLogService.summarizeByRoomId).toHaveBeenCalledWith(
      'room-1',
      query,
    );
  });

  it('delegates replay views to the event log service', async () => {
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
    const query = { limit: 10 };

    const gameEventLogService: IGameEventLogService = {
      log: jest.fn(),
      listByRoomId: jest.fn(),
      replayByRoomId: jest.fn().mockResolvedValue(replay),
      summarizeByRoomId: jest.fn(),
    };

    const useCase = new GetGameHistoryUseCase(gameEventLogService);

    await expect(useCase.replay('room-1', query)).resolves.toEqual(replay);
    expect(gameEventLogService.replayByRoomId).toHaveBeenCalledWith(
      'room-1',
      query,
    );
  });
});
