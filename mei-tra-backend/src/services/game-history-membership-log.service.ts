import { Injectable } from '@nestjs/common';
import {
  GameHistoryQuery,
  GameHistoryReplayDetailItem,
  GameHistoryReplayEvent,
  GameHistoryReplayView,
  GameHistorySummary,
} from '../types/game-history.types';
import type { RoomMembershipReplayEvent } from '../types/room-membership.types';

@Injectable()
export class GameHistoryMembershipLogService {
  mergeSummary(
    summary: GameHistorySummary,
    membershipEvents: RoomMembershipReplayEvent[],
    query: GameHistoryQuery,
    playerNamesBySeatId: Readonly<Record<string, string>>,
    playerNamesByUserId: Readonly<Record<string, string>>,
  ): GameHistorySummary {
    const filteredEvents = this.filterEvents(membershipEvents, query);
    if (filteredEvents.length === 0) {
      return summary;
    }

    const byActionType = { ...summary.byActionType };
    const actorSeatIds = new Set(summary.actorSeatIds);
    const mergedPlayerNames = { ...summary.playerNames };

    for (const event of filteredEvents) {
      byActionType[event.eventType] = (byActionType[event.eventType] ?? 0) + 1;
      if (event.seatId) {
        actorSeatIds.add(event.seatId);
        const playerName = this.resolvePlayerName(
          event,
          playerNamesBySeatId,
          playerNamesByUserId,
        );
        if (playerName) {
          mergedPlayerNames[event.seatId] = playerName;
        }
      }
    }

    const firstMembershipTimestamp = filteredEvents[0]?.timestamp ?? null;
    const lastMembershipTimestamp = filteredEvents.at(-1)?.timestamp ?? null;
    const lastActionType =
      lastMembershipTimestamp &&
      (!summary.lastTimestamp ||
        lastMembershipTimestamp > summary.lastTimestamp)
        ? (filteredEvents.at(-1)?.eventType ?? summary.lastActionType)
        : summary.lastActionType;

    return {
      ...summary,
      totalEntries: summary.totalEntries + filteredEvents.length,
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

  mergeReplay(
    replay: GameHistoryReplayView,
    membershipEvents: RoomMembershipReplayEvent[],
    query: GameHistoryQuery,
    playerNamesBySeatId: Readonly<Record<string, string>>,
    playerNamesByUserId: Readonly<Record<string, string>>,
  ): GameHistoryReplayView {
    const filteredEvents = this.filterEvents(membershipEvents, query);
    if (filteredEvents.length === 0) {
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

    for (const membershipEvent of filteredEvents) {
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

      const replayEvent = this.toReplayEvent(
        membershipEvent,
        roundNumber,
        playerNamesBySeatId,
        playerNamesByUserId,
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

  private filterEvents(
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

  private toReplayEvent(
    event: RoomMembershipReplayEvent,
    roundNumber: number | null,
    playerNamesBySeatId: Readonly<Record<string, string>>,
    playerNamesByUserId: Readonly<Record<string, string>>,
  ): GameHistoryReplayEvent {
    const playerName = this.resolvePlayerName(
      event,
      playerNamesBySeatId,
      playerNamesByUserId,
    );
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

  private resolvePlayerName(
    event: RoomMembershipReplayEvent,
    playerNamesBySeatId: Readonly<Record<string, string>>,
    playerNamesByUserId: Readonly<Record<string, string>>,
  ): string | null {
    const userName = playerNamesByUserId[event.userId]?.trim();
    if (userName) {
      return userName;
    }

    if (!event.seatId) {
      return null;
    }

    return playerNamesBySeatId[event.seatId]?.trim() || null;
  }
}
