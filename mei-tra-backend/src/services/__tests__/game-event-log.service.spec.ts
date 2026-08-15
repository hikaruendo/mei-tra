/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Logger } from '@nestjs/common';
import { GameEventLogService } from '../game-event-log.service';
import { IGameHistoryRepository } from '../../repositories/interfaces/game-history.repository.interface';
import { asSeatId } from '../../types/identity.types';

describe('GameEventLogService', () => {
  it('enriches log entries with snapshot context', async () => {
    const repository = {
      create: jest.fn().mockResolvedValue(undefined),
      findByRoomId: jest.fn(),
    } as unknown as IGameHistoryRepository;

    const service = new GameEventLogService(repository);

    await service.log({
      roomId: 'room-1',
      actionType: 'card_played',
      actorSeatId: asSeatId('seat-1'),
      state: {
        players: [
          {
            seatId: asSeatId('seat-1'),
            playerId: 'player-1',
            name: 'Player One',
          },
        ],
        currentSeatId: asSeatId('seat-1'),
        currentPlayerId: 'player-1',
        gamePhase: 'play',
        roundNumber: 2,
        teamScores: { 0: { play: 2, total: 4 }, 1: { play: 1, total: 3 } },
      } as any,
      actionData: { card: 'AS' },
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: 'room-1',
        actionType: 'card_played',
        actorSeatId: 'seat-1',
        actionData: expect.objectContaining({
          card: 'AS',
          context: expect.objectContaining({
            roundNumber: 2,
            gamePhase: 'play',
            currentTurnSeatId: 'seat-1',
          }),
          playerNames: {
            'seat-1': 'Player One',
          },
        }),
      }),
    );
  });

  it('swallows persistence errors so gameplay is not blocked', async () => {
    const loggerSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const repository = {
      create: jest.fn().mockRejectedValue(new Error('db failed')),
      findByRoomId: jest.fn(),
    } as unknown as IGameHistoryRepository;

    const service = new GameEventLogService(repository);

    await expect(
      service.log({ roomId: 'room-1', actionType: 'game_started' }),
    ).resolves.toBeUndefined();

    loggerSpy.mockRestore();
  });

  it('delegates filtered history reads to the repository', async () => {
    const history = [
      {
        id: 'history-1',
        roomId: 'room-1',
        gameStateId: 'state-1',
        actionType: 'card_played' as const,
        actorSeatId: 'player-1',
        actionData: {},
        timestamp: new Date('2026-04-16T00:00:00.000Z'),
      },
    ];
    const query = { actionType: 'card_played' as const, limit: 1 };
    const repository = {
      create: jest.fn(),
      findByRoomId: jest.fn().mockResolvedValue(history),
    } as unknown as IGameHistoryRepository;

    const service = new GameEventLogService(repository);

    await expect(service.listByRoomId('room-1', query)).resolves.toEqual(
      history,
    );
    expect(repository.findByRoomId).toHaveBeenCalledWith('room-1', query);
  });

  it('prunes history for finished rooms outside the retained room limit', async () => {
    const repository = {
      create: jest.fn(),
      findByRoomId: jest.fn(),
      deleteForFinishedRoomsOutsideRecentLimit: jest.fn().mockResolvedValue(42),
    } as unknown as IGameHistoryRepository;

    const service = new GameEventLogService(repository);

    await expect(service.pruneFinishedRoomHistory()).resolves.toBe(42);
    expect(
      repository.deleteForFinishedRoomsOutsideRecentLimit,
    ).toHaveBeenCalledWith(10);
  });

  it('summarizes room history by action type and round', async () => {
    const history = [
      {
        id: 'history-1',
        roomId: 'room-1',
        gameStateId: 'state-1',
        actionType: 'game_started' as const,
        actorSeatId: null,
        actionData: {
          context: { roundNumber: 1 },
          playerNames: {
            'player-1': 'Player One',
          },
        },
        timestamp: new Date('2026-04-16T00:00:00.000Z'),
      },
      {
        id: 'history-2',
        roomId: 'room-1',
        gameStateId: 'state-1',
        actionType: 'card_played' as const,
        actorSeatId: 'player-1',
        actionData: {
          context: { roundNumber: 1 },
          playerNames: {
            'player-1': 'Player One',
          },
        },
        timestamp: new Date('2026-04-16T00:05:00.000Z'),
      },
    ];
    const repository = {
      create: jest.fn(),
      findByRoomId: jest.fn().mockResolvedValue(history),
    } as unknown as IGameHistoryRepository;

    const service = new GameEventLogService(repository);

    await expect(service.summarizeByRoomId('room-1')).resolves.toEqual({
      roomId: 'room-1',
      totalEntries: 2,
      byActionType: {
        game_started: 1,
        card_played: 1,
      },
      actorSeatIds: ['player-1'],
      playerNames: {
        'player-1': 'Player One',
      },
      status: 'in_progress',
      winningTeam: null,
      lastActionType: 'card_played',
      roundNumbers: [1],
      firstTimestamp: new Date('2026-04-16T00:00:00.000Z'),
      lastTimestamp: new Date('2026-04-16T00:05:00.000Z'),
    });
  });

  it('marks summaries complete when a game over entry exists', async () => {
    const history = [
      {
        id: 'history-1',
        roomId: 'room-1',
        gameStateId: 'state-1',
        actionType: 'game_started' as const,
        actorSeatId: null,
        actionData: {},
        timestamp: new Date('2026-04-16T00:00:00.000Z'),
      },
      {
        id: 'history-2',
        roomId: 'room-1',
        gameStateId: 'state-1',
        actionType: 'game_over' as const,
        actorSeatId: 'player-1',
        actionData: {
          winningTeam: 1,
        },
        timestamp: new Date('2026-04-16T00:10:00.000Z'),
      },
    ];
    const repository = {
      create: jest.fn(),
      findByRoomId: jest.fn().mockResolvedValue(history),
    } as unknown as IGameHistoryRepository;

    const service = new GameEventLogService(repository);

    await expect(service.summarizeByRoomId('room-1')).resolves.toEqual(
      expect.objectContaining({
        status: 'completed',
        winningTeam: 1,
        lastActionType: 'game_over',
      }),
    );
  });

  it('groups replay entries by round', async () => {
    const history = [
      {
        id: 'history-1',
        roomId: 'room-1',
        gameStateId: 'state-1',
        actionType: 'game_started' as const,
        actorSeatId: null,
        actionData: {
          playerNames: {
            'player-1': 'Player One',
          },
        },
        timestamp: new Date('2026-04-16T00:00:00.000Z'),
      },
      {
        id: 'history-2',
        roomId: 'room-1',
        gameStateId: 'state-1',
        actionType: 'card_played' as const,
        actorSeatId: 'player-1',
        actionData: {
          card: 'AS',
          fieldCards: ['AS'],
          context: { roundNumber: 1 },
          playerNames: {
            'player-1': 'Player One',
            'player-2': 'Player Two',
          },
        },
        timestamp: new Date('2026-04-16T00:05:00.000Z'),
      },
      {
        id: 'history-3',
        roomId: 'room-1',
        gameStateId: 'state-1',
        actionType: 'field_completed' as const,
        actorSeatId: 'player-2',
        actionData: {
          winnerSeatId: 'player-2',
          winnerTeam: 1,
          context: { roundNumber: 1 },
          playerNames: {
            'player-2': 'Player Two',
          },
        },
        timestamp: new Date('2026-04-16T00:06:00.000Z'),
      },
    ];
    const repository = {
      create: jest.fn(),
      findByRoomId: jest.fn().mockResolvedValue(history),
    } as unknown as IGameHistoryRepository;

    const service = new GameEventLogService(repository);

    await expect(service.replayByRoomId('room-1')).resolves.toEqual({
      roomId: 'room-1',
      totalEntries: 3,
      rounds: [
        {
          roundNumber: null,
          startedAt: new Date('2026-04-16T00:00:00.000Z'),
          endedAt: new Date('2026-04-16T00:00:00.000Z'),
          actionTypes: ['game_started'],
          actorSeatIds: [],
          entries: [history[0]],
          events: [
            {
              id: 'history-1',
              timestamp: new Date('2026-04-16T00:00:00.000Z'),
              actionType: 'game_started',
              kind: 'lifecycle',
              actorSeatId: null,
              roundNumber: null,
              gamePhase: null,
              summary: 'Game started',
              details: {
                firstBlowSeatId: null,
                startedBySeatId: null,
                pointsToWin: null,
              },
              detailItems: [],
              context: undefined,
              actionData: {
                playerNames: {
                  'player-1': 'Player One',
                },
              },
            },
          ],
        },
        {
          roundNumber: 1,
          startedAt: new Date('2026-04-16T00:05:00.000Z'),
          endedAt: new Date('2026-04-16T00:06:00.000Z'),
          actionTypes: ['card_played', 'field_completed'],
          actorSeatIds: ['player-1', 'player-2'],
          entries: [history[1], history[2]],
          events: [
            {
              id: 'history-2',
              timestamp: new Date('2026-04-16T00:05:00.000Z'),
              actionType: 'card_played',
              kind: 'play',
              actorSeatId: 'player-1',
              roundNumber: 1,
              gamePhase: 'waiting',
              summary: 'Player One played AS (1/4)',
              details: {
                card: 'AS',
                fieldCards: ['AS'],
                baseCard: null,
              },
              detailItems: [
                {
                  labelKey: 'card',
                  value: {
                    kind: 'text',
                    text: 'AS',
                  },
                },
                {
                  labelKey: 'cards',
                  value: {
                    kind: 'cards',
                    cards: ['AS'],
                  },
                },
              ],
              context: {
                roundNumber: 1,
                gamePhase: 'waiting',
                currentTurnSeatId: null,
                teamScores: undefined,
              },
              actionData: {
                card: 'AS',
                fieldCards: ['AS'],
                context: { roundNumber: 1 },
                playerNames: {
                  'player-1': 'Player One',
                  'player-2': 'Player Two',
                },
              },
            },
            {
              id: 'history-3',
              timestamp: new Date('2026-04-16T00:06:00.000Z'),
              actionType: 'field_completed',
              kind: 'play',
              actorSeatId: 'player-2',
              roundNumber: 1,
              gamePhase: 'waiting',
              summary: 'Field completed by Player Two for Team 2',
              details: {
                winnerSeatId: 'player-2',
                winnerTeam: 1,
                cards: [],
              },
              detailItems: [
                {
                  labelKey: 'winner',
                  value: {
                    kind: 'player',
                    seatId: 'player-2',
                    playerName: 'Player Two',
                  },
                },
                {
                  labelKey: 'winnerTeam',
                  value: {
                    kind: 'team',
                    team: 1,
                  },
                },
              ],
              context: {
                roundNumber: 1,
                gamePhase: 'waiting',
                currentTurnSeatId: null,
                teamScores: undefined,
              },
              actionData: {
                winnerSeatId: 'player-2',
                winnerTeam: 1,
                context: { roundNumber: 1 },
                playerNames: {
                  'player-2': 'Player Two',
                },
              },
            },
          ],
        },
      ],
    });
  });

  it('builds action-aware summaries for replay events', async () => {
    const repository = {
      create: jest.fn(),
      findByRoomId: jest.fn().mockResolvedValue([
        {
          id: 'history-1',
          roomId: 'room-1',
          gameStateId: 'state-1',
          actionType: 'player_stats_updated' as const,
          actionData: {
            updatedCount: 2,
            skippedPlayers: ['player-3'],
            failedCount: 1,
          },
          timestamp: new Date('2026-04-16T00:00:00.000Z'),
        },
      ]),
    } as unknown as IGameHistoryRepository;

    const service = new GameEventLogService(repository);
    const replay = await service.replayByRoomId('room-1');

    expect(replay.rounds[0]?.events[0]?.summary).toBe(
      'Player stats updated for 2 player(s), skipped 1, failed 1',
    );
    expect(replay.rounds[0]?.events[0]?.kind).toBe('stats');
    expect(replay.rounds[0]?.events[0]?.details).toEqual({
      winningTeam: null,
      updatedPlayers: [],
      skippedPlayers: ['player-3'],
      updatedCount: 2,
      failedCount: 1,
    });
    expect(replay.rounds[0]?.events[0]?.detailItems).toEqual([
      {
        labelKey: 'updated',
        value: {
          kind: 'number',
          value: 2,
        },
      },
      {
        labelKey: 'failed',
        value: {
          kind: 'number',
          value: 1,
        },
      },
    ]);
  });

  it('projects current seat names onto replay summaries and details', async () => {
    const repository = {
      create: jest.fn(),
      findByRoomId: jest.fn().mockResolvedValue([
        {
          id: 'history-1',
          roomId: 'room-1',
          gameStateId: 'state-1',
          actionType: 'field_completed' as const,
          actorSeatId: 'player-3',
          actionData: {
            winnerSeatId: 'player-3',
            winnerTeam: 0,
            playerNames: { 'player-3': 'COM 3' },
          },
          timestamp: new Date('2026-04-16T00:00:00.000Z'),
        },
      ]),
    } as unknown as IGameHistoryRepository;
    const service = new GameEventLogService(repository);

    const replay = await service.replayByRoomId('room-1', undefined, {
      'player-3': 'Player3',
    });
    const event = replay.rounds[0]?.events[0];

    expect(event?.summary).toBe('Field completed by Player3 for Team 1');
    expect(event?.detailItems).toContainEqual({
      labelKey: 'winner',
      value: {
        kind: 'player',
        seatId: 'player-3',
        playerName: 'Player3',
      },
    });
    expect(event?.actionData.playerNames).toEqual({
      'player-3': 'Player3',
    });

    const summary = await service.summarizeByRoomId('room-1', undefined, {
      'player-3': 'Player3',
    });
    expect(summary.playerNames).toEqual({ 'player-3': 'Player3' });
  });
});
