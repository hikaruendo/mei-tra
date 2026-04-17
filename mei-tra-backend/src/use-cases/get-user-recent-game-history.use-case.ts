import { Inject, Injectable } from '@nestjs/common';
import { IRoomRepository } from '../repositories/interfaces/room.repository.interface';
import { IGameEventLogService } from '../services/interfaces/game-event-log.service.interface';
import { RecentGameHistoryItem } from '../types/game-history.types';
import { IGetUserRecentGameHistoryUseCase } from './interfaces/get-user-recent-game-history.use-case.interface';

const DEFAULT_LIMIT = 10;

@Injectable()
export class GetUserRecentGameHistoryUseCase
  implements IGetUserRecentGameHistoryUseCase
{
  constructor(
    @Inject('IRoomRepository')
    private readonly roomRepository: IRoomRepository,
    @Inject('IGameEventLogService')
    private readonly gameEventLogService: IGameEventLogService,
  ) {}

  async execute(
    userId: string,
    limit: number = DEFAULT_LIMIT,
  ): Promise<RecentGameHistoryItem[]> {
    const normalizedLimit = Math.max(1, limit);
    const rooms = await this.roomRepository.findRecentFinishedByUserId(
      userId,
      normalizedLimit,
    );

    const items = await Promise.all(
      rooms.map(async (room) => {
        const summary = await this.gameEventLogService.summarizeByRoomId(
          room.id,
        );
        const completedAt = summary.lastTimestamp ?? room.lastActivityAt;

        return {
          roomId: room.id,
          roomName: room.name,
          completedAt,
          roundCount: summary.roundNumbers.length,
          totalEntries: summary.totalEntries,
          winningTeam: summary.winningTeam,
          lastActionType: summary.lastActionType,
        } satisfies RecentGameHistoryItem;
      }),
    );

    return items.sort(
      (left, right) => right.completedAt.getTime() - left.completedAt.getTime(),
    );
  }
}
