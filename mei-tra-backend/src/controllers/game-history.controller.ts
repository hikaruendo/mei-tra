import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import {
  GAME_HISTORY_ACTION_TYPES,
  GameHistoryActionType,
  GameHistoryEntry,
  GameHistoryQuery,
  GameHistoryReplayView,
  GameHistorySummary,
} from '../types/game-history.types';
import { IGetGameHistoryUseCase } from '../use-cases/interfaces/get-game-history.use-case.interface';

type GameHistoryRequestQuery = Partial<
  Record<
    'actionType' | 'limit' | 'playerId' | 'roundNumber' | 'since' | 'until',
    string
  >
>;

@Controller('game-history')
export class GameHistoryController {
  constructor(
    @Inject('IGetGameHistoryUseCase')
    private readonly getGameHistoryUseCase: IGetGameHistoryUseCase,
  ) {}

  @Get(':roomId/summary')
  summarizeByRoomId(
    @Param('roomId') roomId: string,
    @Query() query: GameHistoryRequestQuery,
  ): Promise<GameHistorySummary> {
    return this.getGameHistoryUseCase.summarize(roomId, this.parseQuery(query));
  }

  @Get(':roomId/replay')
  replayByRoomId(
    @Param('roomId') roomId: string,
    @Query() query: GameHistoryRequestQuery,
  ): Promise<GameHistoryReplayView> {
    return this.getGameHistoryUseCase.replay(roomId, this.parseQuery(query));
  }

  @Get(':roomId')
  listByRoomId(
    @Param('roomId') roomId: string,
    @Query() query: GameHistoryRequestQuery,
  ): Promise<GameHistoryEntry[]> {
    return this.getGameHistoryUseCase.execute(roomId, this.parseQuery(query));
  }

  private parseQuery(query: GameHistoryRequestQuery): GameHistoryQuery {
    const actionType = this.parseActionType(query.actionType);
    const since = this.parseDate(query.since);
    const until = this.parseDate(query.until);
    const roundNumber = this.parseNumber(query.roundNumber);

    return {
      actionType,
      playerId: query.playerId,
      roundNumber,
      limit: this.parseLimit(query.limit),
      since,
      until,
    };
  }

  private parseLimit(value?: string): number | undefined {
    if (!value) {
      return undefined;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(1, parsed) : undefined;
  }

  private parseActionType(
    actionType?: string,
  ): GameHistoryActionType | undefined {
    return GAME_HISTORY_ACTION_TYPES.includes(
      actionType as GameHistoryActionType,
    )
      ? (actionType as GameHistoryActionType)
      : undefined;
  }

  private parseDate(value?: string): Date | undefined {
    if (!value) {
      return undefined;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  private parseNumber(value?: string): number | undefined {
    if (!value) {
      return undefined;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
}
