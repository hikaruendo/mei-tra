import { GetUserRecentGameHistoryUseCase } from '../get-user-recent-game-history.use-case';
import { IRoomRepository } from '../../repositories/interfaces/room.repository.interface';
import { IGameEventLogService } from '../../services/interfaces/game-event-log.service.interface';
import { RoomStatus } from '../../types/room.types';

describe('GetUserRecentGameHistoryUseCase', () => {
  it('returns recent finished rooms decorated with history summaries', async () => {
    const roomRepository: Pick<IRoomRepository, 'findRecentFinishedByUserId'> =
      {
        findRecentFinishedByUserId: jest.fn().mockResolvedValue([
          {
            id: 'room-1',
            name: 'Alpha room',
            hostId: 'host-1',
            status: RoomStatus.FINISHED,
            players: [],
            settings: {
              maxPlayers: 4,
              isPrivate: false,
              password: null,
              teamAssignmentMethod: 'random',
              pointsToWin: 7,
              allowSpectators: true,
            },
            createdAt: new Date('2026-04-15T23:50:00.000Z'),
            updatedAt: new Date('2026-04-16T00:10:00.000Z'),
            lastActivityAt: new Date('2026-04-16T00:10:00.000Z'),
          },
          {
            id: 'room-2',
            name: 'Beta room',
            hostId: 'host-2',
            status: RoomStatus.FINISHED,
            players: [],
            settings: {
              maxPlayers: 4,
              isPrivate: false,
              password: null,
              teamAssignmentMethod: 'random',
              pointsToWin: 7,
              allowSpectators: true,
            },
            createdAt: new Date('2026-04-16T00:30:00.000Z'),
            updatedAt: new Date('2026-04-16T00:35:00.000Z'),
            lastActivityAt: new Date('2026-04-16T00:35:00.000Z'),
          },
        ]),
      };

    const gameEventLogService: IGameEventLogService = {
      log: jest.fn(),
      listByRoomId: jest.fn(),
      replayByRoomId: jest.fn(),
      summarizeByRoomId: jest
        .fn()
        .mockResolvedValueOnce({
          roomId: 'room-1',
          totalEntries: 12,
          byActionType: { game_over: 1 },
          playerIds: ['player-1'],
          playerNames: { 'player-1': 'Player 1' },
          status: 'completed' as const,
          winningTeam: 1,
          lastActionType: 'game_over' as const,
          roundNumbers: [1, 2, 3],
          firstTimestamp: new Date('2026-04-15T23:50:00.000Z'),
          lastTimestamp: new Date('2026-04-16T00:20:00.000Z'),
        })
        .mockResolvedValueOnce({
          roomId: 'room-2',
          totalEntries: 6,
          byActionType: { round_completed: 1 },
          playerIds: ['player-2'],
          playerNames: { 'player-2': 'Player 2' },
          status: 'completed' as const,
          winningTeam: 0,
          lastActionType: 'round_completed' as const,
          roundNumbers: [1],
          firstTimestamp: new Date('2026-04-16T00:30:00.000Z'),
          lastTimestamp: null,
        }),
    };

    const useCase = new GetUserRecentGameHistoryUseCase(
      roomRepository as IRoomRepository,
      gameEventLogService,
    );

    await expect(useCase.execute('user-1')).resolves.toEqual([
      {
        roomId: 'room-2',
        roomName: 'Beta room',
        completedAt: new Date('2026-04-16T00:35:00.000Z'),
        roundCount: 1,
        totalEntries: 6,
        winningTeam: 0,
        lastActionType: 'round_completed',
      },
      {
        roomId: 'room-1',
        roomName: 'Alpha room',
        completedAt: new Date('2026-04-16T00:20:00.000Z'),
        roundCount: 3,
        totalEntries: 12,
        winningTeam: 1,
        lastActionType: 'game_over',
      },
    ]);

    expect(roomRepository.findRecentFinishedByUserId).toHaveBeenCalledWith(
      'user-1',
      10,
    );
    expect(gameEventLogService.summarizeByRoomId).toHaveBeenCalledWith(
      'room-1',
    );
    expect(gameEventLogService.summarizeByRoomId).toHaveBeenCalledWith(
      'room-2',
    );
  });
});
