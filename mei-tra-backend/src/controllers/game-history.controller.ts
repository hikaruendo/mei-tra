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
  GameHistoryReplayEvent,
  GameHistoryReplayView,
  GameHistorySummary,
} from '../types/game-history.types';
import { RoomPlayer } from '../types/room.types';
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
    const participant = await this.assertRoomParticipant(
      roomId,
      currentUser.id,
    );
    const replay = await this.getGameHistoryUseCase.replay(
      roomId,
      this.parseQuery(query),
    );
    return this.withViewerStartingHands(replay, participant.playerId);
  }

  @Get(':roomId')
  @UseGuards(AuthGuard)
  async listByRoomId(
    @Param('roomId') roomId: string,
    @Query() query: GameHistoryRequestQuery,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<GameHistoryEntry[]> {
    const participant = await this.assertRoomParticipant(
      roomId,
      currentUser.id,
    );
    const history = await this.getGameHistoryUseCase.execute(
      roomId,
      this.parseQuery(query),
    );
    return history.map((entry) =>
      this.withSanitizedActionData(entry, participant.playerId),
    );
  }

  private async assertRoomParticipant(
    roomId: string,
    userId: string,
  ): Promise<RoomPlayer> {
    const room = await this.roomRepository.findById(roomId);
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const participant = room.players.find((player) => player.userId === userId);
    if (!participant) {
      throw new ForbiddenException('Cannot access another user game history');
    }

    return participant;
  }

  private withViewerStartingHands(
    replay: GameHistoryReplayView,
    viewerPlayerId: string,
  ): GameHistoryReplayView {
    return {
      ...replay,
      rounds: replay.rounds.map((round) => ({
        ...round,
        viewerStartingHand:
          this.resolveViewerStartingHand(round.events, viewerPlayerId) ?? [],
        entries: round.entries.map((entry) =>
          this.withSanitizedActionData(entry, viewerPlayerId),
        ),
        events: round.events.map((event) => ({
          ...event,
          actionData: this.sanitizeActionData(event.actionData, viewerPlayerId),
        })),
      })),
    };
  }

  private resolveViewerStartingHand(
    events: GameHistoryReplayEvent[],
    viewerPlayerId: string,
  ): string[] | null {
    return events.reduce<string[] | null>((latestHand, event) => {
      return (
        this.extractViewerStartingHand(event.actionData, viewerPlayerId) ??
        latestHand
      );
    }, null);
  }

  private withSanitizedActionData<
    TEntry extends { actionData: Record<string, unknown> },
  >(entry: TEntry, viewerPlayerId: string): TEntry {
    return {
      ...entry,
      actionData: this.sanitizeActionData(entry.actionData, viewerPlayerId),
    };
  }

  private sanitizeActionData(
    actionData: Record<string, unknown>,
    viewerPlayerId: string,
  ): Record<string, unknown> {
    const safeActionData = { ...actionData };
    delete safeActionData.startingHandsByPlayerId;
    const viewerStartingHand = this.extractViewerStartingHand(
      actionData,
      viewerPlayerId,
    );

    return viewerStartingHand
      ? { ...safeActionData, viewerStartingHand }
      : safeActionData;
  }

  private extractViewerStartingHand(
    actionData: Record<string, unknown>,
    viewerPlayerId: string,
  ): string[] | null {
    const handsByPlayerId = actionData.startingHandsByPlayerId;
    if (
      !handsByPlayerId ||
      typeof handsByPlayerId !== 'object' ||
      Array.isArray(handsByPlayerId)
    ) {
      return null;
    }

    const hand = (handsByPlayerId as Record<string, unknown>)[viewerPlayerId];
    if (!Array.isArray(hand)) {
      return null;
    }

    return hand.filter((card): card is string => typeof card === 'string');
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
