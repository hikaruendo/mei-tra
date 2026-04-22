import { Inject, Injectable } from '@nestjs/common';
import { IGameEventLogService } from '../services/interfaces/game-event-log.service.interface';
import {
  GameHistoryEntry,
  GameHistoryQuery,
  GameHistoryReplayView,
  GameHistorySummary,
} from '../types/game-history.types';
import { IGetGameHistoryUseCase } from './interfaces/get-game-history.use-case.interface';

@Injectable()
export class GetGameHistoryUseCase implements IGetGameHistoryUseCase {
  constructor(
    @Inject('IGameEventLogService')
    private readonly gameEventLogService: IGameEventLogService,
  ) {}

  execute(
    roomId: string,
    query?: GameHistoryQuery,
  ): Promise<GameHistoryEntry[]> {
    return this.gameEventLogService.listByRoomId(roomId, query);
  }

  summarize(
    roomId: string,
    query?: GameHistoryQuery,
  ): Promise<GameHistorySummary> {
    return this.gameEventLogService.summarizeByRoomId(roomId, query);
  }

  replay(
    roomId: string,
    query?: GameHistoryQuery,
  ): Promise<GameHistoryReplayView> {
    return this.gameEventLogService.replayByRoomId(roomId, query);
  }
}
