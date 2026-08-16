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
  GameHistoryReplayDetailItem,
  GameHistoryReplayEvent,
  GameHistoryReplayView,
  GameHistorySummary,
} from '../types/game-history.types';
import { Room, RoomStatus } from '../types/room.types';
import { asSeatId, isUuid, type SeatId } from '../types/identity.types';
import type { GameParticipant } from '../types/game-participant.types';
import type { RoomMembershipReplayEvent } from '../types/room-membership.types';
import { AuthenticatedUser } from '../types/user.types';
import { IGetGameHistoryUseCase } from '../use-cases/interfaces/get-game-history.use-case.interface';
import { RoomMembershipService } from '../services/room-membership.service';

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
    private readonly roomMembershipService: RoomMembershipService,
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
    const parsedQuery = this.parseQuery(query);
    const [summary, membershipEvents] = await Promise.all([
      this.getGameHistoryUseCase.summarize(roomId, parsedQuery, playerNames),
      this.roomMembershipService.listReplayEventsForRoom(roomId),
    ]);

    const summaryWithMembership = this.withMembershipSummary(
      summary,
      this.filterMembershipEvents(membershipEvents, parsedQuery),
      playerNames,
    );

    return {
      ...summaryWithMembership,
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
    const parsedQuery = this.parseQuery(query);
    const [replay, membershipEvents] = await Promise.all([
      this.getGameHistoryUseCase.replay(roomId, parsedQuery, playerNames),
      this.roomMembershipService.listReplayEventsForRoom(roomId),
    ]);
    const replayWithMembership = this.withMembershipReplayEvents(
      replay,
      this.filterMembershipEvents(membershipEvents, parsedQuery),
      playerNames,
      parsedQuery,
    );
    return this.withViewerStartingHands(
      replayWithMembership,
      participant?.seatId ?? null,
    );
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

  private withMembershipSummary(
    summary: GameHistorySummary,
    membershipEvents: RoomMembershipReplayEvent[],
    playerNames: Readonly<Record<string, string>>,
  ): GameHistorySummary {
    if (membershipEvents.length === 0) {
      return summary;
    }

    const byActionType = { ...summary.byActionType };
    const actorSeatIds = new Set(summary.actorSeatIds);
    const mergedPlayerNames = { ...summary.playerNames };

    for (const event of membershipEvents) {
      byActionType[event.eventType] = (byActionType[event.eventType] ?? 0) + 1;
      if (event.seatId) {
        actorSeatIds.add(event.seatId);
        const playerName = playerNames[event.seatId];
        if (playerName) {
          mergedPlayerNames[event.seatId] = playerName;
        }
      }
    }

    const firstMembershipTimestamp = membershipEvents[0]?.timestamp ?? null;
    const lastMembershipTimestamp = membershipEvents.at(-1)?.timestamp ?? null;
    const lastActionType =
      lastMembershipTimestamp &&
      (!summary.lastTimestamp ||
        lastMembershipTimestamp > summary.lastTimestamp)
        ? (membershipEvents.at(-1)?.eventType ?? summary.lastActionType)
        : summary.lastActionType;

    return {
      ...summary,
      totalEntries: summary.totalEntries + membershipEvents.length,
      byActionType,
      actorSeatIds: [...actorSeatIds],
      playerNames: mergedPlayerNames,
      lastActionType,
      firstTimestamp:
        summary.firstTimestamp && firstMembershipTimestamp
          ? summary.firstTimestamp < firstMembershipTimestamp
            ? summary.firstTimestamp
            : firstMembershipTimestamp
          : (summary.firstTimestamp ?? firstMembershipTimestamp),
      lastTimestamp:
        summary.lastTimestamp && lastMembershipTimestamp
          ? summary.lastTimestamp > lastMembershipTimestamp
            ? summary.lastTimestamp
            : lastMembershipTimestamp
          : (summary.lastTimestamp ?? lastMembershipTimestamp),
    };
  }

  private withMembershipReplayEvents(
    replay: GameHistoryReplayView,
    membershipEvents: RoomMembershipReplayEvent[],
    playerNames: Readonly<Record<string, string>>,
    query: GameHistoryQuery,
  ): GameHistoryReplayView {
    if (membershipEvents.length === 0) {
      return replay;
    }

    const rounds = replay.rounds.map((round) => ({
      ...round,
      actionTypes: [...round.actionTypes],
      actorSeatIds: [...round.actorSeatIds],
      entries: [...round.entries],
      events: [...round.events],
    }));
    let insertedCount = 0;

    for (const membershipEvent of membershipEvents) {
      const roundNumber = this.resolveRoundNumberAt(
        membershipEvent.timestamp,
        rounds,
      );
      if (
        typeof query.roundNumber === 'number' &&
        query.roundNumber !== roundNumber
      ) {
        continue;
      }

      const replayEvent = this.toMembershipReplayEvent(
        membershipEvent,
        roundNumber,
        playerNames,
      );
      let round = rounds.find(
        (candidate) => candidate.roundNumber === roundNumber,
      );
      if (!round) {
        round = {
          roundNumber,
          startedAt: membershipEvent.timestamp,
          endedAt: membershipEvent.timestamp,
          actionTypes: [],
          actorSeatIds: [],
          entries: [],
          events: [],
        };
        rounds.push(round);
      }

      round.events.push(replayEvent);
      round.events.sort(
        (left, right) => left.timestamp.getTime() - right.timestamp.getTime(),
      );
      if (!round.actionTypes.includes(replayEvent.actionType)) {
        round.actionTypes.push(replayEvent.actionType);
      }
      if (
        replayEvent.actorSeatId &&
        !round.actorSeatIds.includes(replayEvent.actorSeatId)
      ) {
        round.actorSeatIds.push(replayEvent.actorSeatId);
      }
      round.startedAt =
        !round.startedAt || membershipEvent.timestamp < round.startedAt
          ? membershipEvent.timestamp
          : round.startedAt;
      round.endedAt =
        !round.endedAt || membershipEvent.timestamp > round.endedAt
          ? membershipEvent.timestamp
          : round.endedAt;
      insertedCount += 1;
    }

    return {
      ...replay,
      totalEntries: replay.totalEntries + insertedCount,
      rounds: rounds.sort((left, right) => {
        if (left.roundNumber === null) {
          return -1;
        }
        if (right.roundNumber === null) {
          return 1;
        }
        return left.roundNumber - right.roundNumber;
      }),
    };
  }

  private filterMembershipEvents(
    events: RoomMembershipReplayEvent[],
    query: GameHistoryQuery,
  ): RoomMembershipReplayEvent[] {
    if (query.actionType) {
      return [];
    }

    return events.filter((event) => {
      if (query.actorSeatId && event.seatId !== query.actorSeatId) {
        return false;
      }
      if (query.since && event.timestamp < query.since) {
        return false;
      }
      if (query.until && event.timestamp > query.until) {
        return false;
      }
      return true;
    });
  }

  private resolveRoundNumberAt(
    timestamp: Date,
    rounds: Pick<
      GameHistoryReplayView['rounds'][number],
      'roundNumber' | 'startedAt'
    >[],
  ): number | null {
    let selectedRoundNumber: number | null = null;
    let selectedStartedAt = Number.NEGATIVE_INFINITY;

    for (const round of rounds) {
      if (
        round.roundNumber === null ||
        !(round.startedAt instanceof Date) ||
        round.startedAt > timestamp
      ) {
        continue;
      }

      const startedAt = round.startedAt.getTime();
      if (startedAt >= selectedStartedAt) {
        selectedRoundNumber = round.roundNumber;
        selectedStartedAt = startedAt;
      }
    }

    return selectedRoundNumber;
  }

  private toMembershipReplayEvent(
    event: RoomMembershipReplayEvent,
    roundNumber: number | null,
    playerNames: Readonly<Record<string, string>>,
  ): GameHistoryReplayEvent {
    const playerName = event.seatId
      ? (playerNames[event.seatId] ?? null)
      : null;
    const detailItems: GameHistoryReplayDetailItem[] = [
      {
        labelKey: 'player',
        value: {
          kind: 'player',
          seatId: event.seatId,
          playerName,
        },
      },
    ];
    const actionData = {
      membershipEventType: event.eventType,
      playerNames:
        event.seatId && playerName ? { [event.seatId]: playerName } : {},
    };

    return {
      id: event.id,
      timestamp: event.timestamp,
      actionType: event.eventType,
      kind: 'membership',
      actorSeatId: event.seatId,
      roundNumber,
      gamePhase: null,
      summary: `${playerName ?? 'Player'} ${
        event.eventType === 'player_joined' ? 'joined' : 'left'
      }`,
      details: {
        seatId: event.seatId,
        playerName,
      },
      detailItems,
      actionData,
    };
  }

  private async getRoomParticipantContext(
    roomId: string,
    userId: string,
  ): Promise<{
    participant: Pick<GameParticipant, 'seatId'> | null;
    playerNames: Record<string, string>;
    teamNames: Room['settings']['teamNames'];
  }> {
    const room = await this.roomRepository.findById(roomId);
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const gameParticipants =
      await this.roomRepository.findGameParticipants(roomId);
    const historicalParticipants = gameParticipants.filter(
      (participant) => participant.userId === userId,
    );
    const currentParticipants = room.players.filter(
      (player) => !player.isCOM && player.userId === userId,
    );
    const participants =
      historicalParticipants.length > 0
        ? historicalParticipants
        : currentParticipants;
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
      playerNames: Object.fromEntries([
        ...room.players.map((player): [string, string] => [
          player.seatId,
          player.name,
        ]),
        ...gameParticipants.map((participant): [string, string] => [
          participant.seatId,
          participant.playerName,
        ]),
      ]),
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
