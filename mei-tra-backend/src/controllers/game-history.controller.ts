import {
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/decorators/user.decorator';
import { IRoomRepository } from '../repositories/interfaces/room.repository.interface';
import {
  GAME_HISTORY_ACTION_TYPES,
  GameHistoryActionType,
  GameHistoryEntry,
  GameHistoryQuery,
  GameHistoryReplayView,
  GameHistorySummary,
} from '../types/game-history.types';
import { AuthenticatedUser } from '../types/user.types';
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
    @Inject('IRoomRepository')
    private readonly roomRepository: IRoomRepository,
  ) {}

  @Get(':roomId/summary')
  @UseGuards(AuthGuard)
  async summarizeByRoomId(
    @Param('roomId') roomId: string,
    @Query() query: GameHistoryRequestQuery,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<GameHistorySummary> {
    await this.assertRoomParticipant(roomId, currentUser.id);
    return this.getGameHistoryUseCase.summarize(roomId, this.parseQuery(query));
  }

  @Get(':roomId/replay')
  @UseGuards(AuthGuard)
  async replayByRoomId(
    @Param('roomId') roomId: string,
    @Query() query: GameHistoryRequestQuery,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<GameHistoryReplayView> {
    await this.assertRoomParticipant(roomId, currentUser.id);
    return this.getGameHistoryUseCase.replay(roomId, this.parseQuery(query));
  }

  @Get(':roomId')
  @UseGuards(AuthGuard)
  async listByRoomId(
    @Param('roomId') roomId: string,
    @Query() query: GameHistoryRequestQuery,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<GameHistoryEntry[]> {
    await this.assertRoomParticipant(roomId, currentUser.id);
    return this.getGameHistoryUseCase.execute(roomId, this.parseQuery(query));
  }

  private async assertRoomParticipant(
    roomId: string,
    userId: string,
  ): Promise<void> {
    const room = await this.roomRepository.findById(roomId);
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const isParticipant = room.players.some(
      (player) => player.userId === userId,
    );
    if (!isParticipant) {
      throw new ForbiddenException('Cannot access another user game history');
    }
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
