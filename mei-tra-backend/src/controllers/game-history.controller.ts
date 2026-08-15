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
import { Room, RoomPlayer, RoomStatus } from '../types/room.types';
import { asSeatId, isUuid, type SeatId } from '../types/identity.types';
import { AuthenticatedUser } from '../types/user.types';
import { IGetGameHistoryUseCase } from '../use-cases/interfaces/get-game-history.use-case.interface';

type GameHistoryRequestQuery = Partial<
  Record<
    'actionType' | 'limit' | 'actorSeatId' | 'roundNumber' | 'since' | 'until',
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
    const { playerNames, teamNames } = await this.getRoomParticipantContext(
      roomId,
      currentUser.id,
    );
    const summary = await this.getGameHistoryUseCase.summarize(
      roomId,
      this.parseQuery(query),
      playerNames,
    );

    return {
      ...summary,
      teamNames,
    };
  }

  @Get(':roomId/replay')
  @UseGuards(AuthGuard)
  async replayByRoomId(
    @Param('roomId') roomId: string,
    @Query() query: GameHistoryRequestQuery,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<GameHistoryReplayView> {
    const { participant, playerNames } = await this.getRoomParticipantContext(
      roomId,
      currentUser.id,
    );
    const replay = await this.getGameHistoryUseCase.replay(
      roomId,
      this.parseQuery(query),
      playerNames,
    );
    return this.withViewerStartingHands(replay, participant?.seatId ?? null);
  }

  @Get(':roomId')
  @UseGuards(AuthGuard)
  async listByRoomId(
    @Param('roomId') roomId: string,
    @Query() query: GameHistoryRequestQuery,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<GameHistoryEntry[]> {
    const { participant } = await this.getRoomParticipantContext(
      roomId,
      currentUser.id,
    );
    const history = await this.getGameHistoryUseCase.execute(
      roomId,
      this.parseQuery(query),
    );
    return history.map((entry) =>
      this.withSanitizedActionData(entry, participant?.seatId ?? null),
    );
  }

  private async getRoomParticipantContext(
    roomId: string,
    userId: string,
  ): Promise<{
    participant: RoomPlayer | null;
    playerNames: Record<string, string>;
    teamNames: Room['settings']['teamNames'];
  }> {
    const room = await this.roomRepository.findById(roomId);
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const participants = room.players.filter(
      (player) => !player.isCOM && player.userId === userId,
    );
    if (
      participants.length !== 1 &&
      !(
        participants.length === 0 &&
        room.status === RoomStatus.PLAYING &&
        room.settings.allowSpectators
      )
    ) {
      throw new ForbiddenException('Cannot access another user game history');
    }

    return {
      participant: participants[0] ?? null,
      playerNames: Object.fromEntries(
        room.players.map((player) => [player.seatId, player.name]),
      ),
      teamNames: room.settings.teamNames,
    };
  }

  private withViewerStartingHands(
    replay: GameHistoryReplayView,
    viewerSeatId: SeatId | null,
  ): GameHistoryReplayView {
    return {
      ...replay,
      rounds: replay.rounds.map((round) => ({
        ...round,
        viewerStartingHand:
          this.resolveViewerStartingHand(round.events, viewerSeatId) ?? [],
        entries: round.entries.map((entry) =>
          this.withSanitizedActionData(entry, viewerSeatId),
        ),
        events: round.events.map((event) => ({
          ...event,
          actionData: this.sanitizeActionData(event.actionData, viewerSeatId),
        })),
      })),
    };
  }

  private resolveViewerStartingHand(
    events: GameHistoryReplayEvent[],
    viewerSeatId: SeatId | null,
  ): string[] | null {
    return events.reduce<string[] | null>((latestHand, event) => {
      return (
        this.extractViewerStartingHand(event.actionData, viewerSeatId) ??
        latestHand
      );
    }, null);
  }

  private withSanitizedActionData<
    TEntry extends { actionData: Record<string, unknown> },
  >(entry: TEntry, viewerSeatId: SeatId | null): TEntry {
    return {
      ...entry,
      actionData: this.sanitizeActionData(entry.actionData, viewerSeatId),
    };
  }

  private sanitizeActionData(
    actionData: Record<string, unknown>,
    viewerSeatId: SeatId | null,
  ): Record<string, unknown> {
    const safeActionData = { ...actionData };
    delete safeActionData.startingHandsBySeatId;
    const viewerStartingHand = this.extractViewerStartingHand(
      actionData,
      viewerSeatId,
    );

    return viewerStartingHand
      ? { ...safeActionData, viewerStartingHand }
      : safeActionData;
  }

  private extractViewerStartingHand(
    actionData: Record<string, unknown>,
    viewerSeatId: SeatId | null,
  ): string[] | null {
    const handsBySeatId = actionData.startingHandsBySeatId;
    if (
      !handsBySeatId ||
      !viewerSeatId ||
      typeof handsBySeatId !== 'object' ||
      Array.isArray(handsBySeatId)
    ) {
      return null;
    }

    const hand = (handsBySeatId as Record<string, unknown>)[viewerSeatId];
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
      actorSeatId: this.parseSeatId(query.actorSeatId),
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

  private parseSeatId(value?: string): SeatId | undefined {
    return value && isUuid(value) ? asSeatId(value) : undefined;
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
