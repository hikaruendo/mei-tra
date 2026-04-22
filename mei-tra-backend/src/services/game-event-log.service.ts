import { Inject, Injectable, Logger } from '@nestjs/common';
import { IGameHistoryRepository } from '../repositories/interfaces/game-history.repository.interface';
import {
  LogGameEventInput,
  IGameEventLogService,
} from './interfaces/game-event-log.service.interface';
import {
  BlowDeclaredReplayDetails,
  BlowPassedReplayDetails,
  BrokenHandRevealedReplayDetails,
  CardPlayedReplayDetails,
  FieldCompletedReplayDetails,
  GameHistoryContext,
  GameHistoryEntry,
  GameHistoryQuery,
  GameHistoryReplayDetailItem,
  GameHistoryReplayEvent,
  GameHistoryReplayRound,
  GameHistoryReplayView,
  GameOverReplayDetails,
  GameStartedReplayDetails,
  PlayPhaseStartedReplayDetails,
  PlayerStatsUpdatedReplayDetails,
  RoundCancelledReplayDetails,
  RoundCompletedReplayDetails,
  RoundResetReplayDetails,
  GameHistorySummary,
} from '../types/game-history.types';

@Injectable()
export class GameEventLogService implements IGameEventLogService {
  private readonly logger = new Logger(GameEventLogService.name);

  constructor(
    @Inject('IGameHistoryRepository')
    private readonly gameHistoryRepository: IGameHistoryRepository,
  ) {}

  async log(input: LogGameEventInput): Promise<void> {
    try {
      const context = input.state ? this.buildContext(input.state) : undefined;
      const playerNames = input.state
        ? this.buildPlayerNames(input.state.players)
        : undefined;

      const actionData = {
        ...(context ? { context } : {}),
        ...(playerNames ? { playerNames } : {}),
        ...(input.actionData ?? {}),
      };

      await this.gameHistoryRepository.create({
        roomId: input.roomId,
        actionType: input.actionType,
        playerId: input.playerId ?? null,
        actionData,
      });
    } catch (error) {
      this.logger.error(
        `Failed to persist game history entry for ${input.actionType}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  listByRoomId(roomId: string, query?: GameHistoryQuery) {
    return this.gameHistoryRepository.findByRoomId(roomId, query);
  }

  async summarizeByRoomId(
    roomId: string,
    query?: GameHistoryQuery,
  ): Promise<GameHistorySummary> {
    const history = await this.listByRoomId(roomId, query);
    const byActionType: Partial<
      Record<GameHistoryEntry['actionType'], number>
    > = {};
    const playerIds = new Set<string>();
    const playerNames: Record<string, string> = {};
    const roundNumbers = new Set<number>();

    history.forEach((entry) => {
      byActionType[entry.actionType] =
        (byActionType[entry.actionType] ?? 0) + 1;
      if (entry.playerId) {
        playerIds.add(entry.playerId);
      }

      const roundNumber = this.extractRoundNumber(entry);
      if (typeof roundNumber === 'number') {
        roundNumbers.add(roundNumber);
      }

      Object.assign(playerNames, this.extractPlayerNames(entry));
    });

    return {
      roomId,
      totalEntries: history.length,
      byActionType,
      playerIds: [...playerIds],
      playerNames,
      status: history.some((entry) => entry.actionType === 'game_over')
        ? 'completed'
        : 'in_progress',
      winningTeam: this.extractWinningTeam(history),
      lastActionType: history.at(-1)?.actionType ?? null,
      roundNumbers: [...roundNumbers].sort((a, b) => a - b),
      firstTimestamp: history[0]?.timestamp ?? null,
      lastTimestamp: history.at(-1)?.timestamp ?? null,
    };
  }

  async replayByRoomId(
    roomId: string,
    query?: GameHistoryQuery,
  ): Promise<GameHistoryReplayView> {
    const history = await this.listByRoomId(roomId, query);
    const rounds = new Map<number | null, GameHistoryReplayRound>();

    history.forEach((entry) => {
      const roundNumber = this.extractRoundNumber(entry);
      const existingRound = rounds.get(roundNumber);

      if (!existingRound) {
        rounds.set(roundNumber, {
          roundNumber,
          startedAt: entry.timestamp,
          endedAt: entry.timestamp,
          actionTypes: [entry.actionType],
          playerIds: entry.playerId ? [entry.playerId] : [],
          entries: [entry],
          events: [this.toReplayEvent(entry)],
        });
        return;
      }

      existingRound.entries.push(entry);
      existingRound.events.push(this.toReplayEvent(entry));
      existingRound.endedAt = entry.timestamp;
      if (!existingRound.actionTypes.includes(entry.actionType)) {
        existingRound.actionTypes.push(entry.actionType);
      }
      if (entry.playerId && !existingRound.playerIds.includes(entry.playerId)) {
        existingRound.playerIds.push(entry.playerId);
      }
    });

    return {
      roomId,
      totalEntries: history.length,
      rounds: [...rounds.values()].sort((left, right) => {
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

  private buildContext(
    input: NonNullable<LogGameEventInput['state']>,
  ): GameHistoryContext {
    return {
      roundNumber: input.roundNumber,
      gamePhase: input.gamePhase,
      currentPlayerIndex: input.currentPlayerIndex,
      currentTurnPlayerId:
        input.players[input.currentPlayerIndex]?.playerId ?? null,
      teamScores: input.teamScores,
    };
  }

  private buildPlayerNames(
    players: Array<{ name?: string; playerId?: string }>,
  ): Record<string, string> | undefined {
    const entries = players
      .filter(
        (player): player is { name: string; playerId: string } =>
          typeof player.playerId === 'string' &&
          player.playerId.length > 0 &&
          typeof player.name === 'string' &&
          player.name.length > 0,
      )
      .map((player) => [player.playerId, player.name] as const);

    if (entries.length === 0) {
      return undefined;
    }

    return Object.fromEntries(entries);
  }

  private extractRoundNumber(entry: GameHistoryEntry): number | null {
    const context = this.extractContext(entry);

    return typeof context?.roundNumber === 'number'
      ? context.roundNumber
      : null;
  }

  private extractContext(
    entry: GameHistoryEntry,
  ): GameHistoryContext | undefined {
    const context =
      entry.actionData?.context &&
      typeof entry.actionData.context === 'object' &&
      entry.actionData.context !== null
        ? (entry.actionData.context as Partial<GameHistoryContext>)
        : null;

    if (!context) {
      return undefined;
    }

    return {
      roundNumber:
        typeof context.roundNumber === 'number' ? context.roundNumber : 0,
      gamePhase:
        context.gamePhase === 'waiting' ||
        context.gamePhase === 'deal' ||
        context.gamePhase === 'blow' ||
        context.gamePhase === 'play'
          ? context.gamePhase
          : 'waiting',
      currentPlayerIndex:
        typeof context.currentPlayerIndex === 'number'
          ? context.currentPlayerIndex
          : 0,
      currentTurnPlayerId:
        typeof context.currentTurnPlayerId === 'string'
          ? context.currentTurnPlayerId
          : null,
      teamScores: context.teamScores,
    };
  }

  private extractPlayerNames(entry: GameHistoryEntry): Record<string, string> {
    const playerNames =
      entry.actionData?.playerNames &&
      typeof entry.actionData.playerNames === 'object' &&
      entry.actionData.playerNames !== null
        ? entry.actionData.playerNames
        : null;

    if (!playerNames) {
      return {};
    }

    return Object.entries(playerNames).reduce<Record<string, string>>(
      (acc, [playerId, playerName]) => {
        if (
          playerId.length > 0 &&
          typeof playerName === 'string' &&
          playerName.length > 0
        ) {
          acc[playerId] = playerName;
        }

        return acc;
      },
      {},
    );
  }

  private extractWinningTeam(history: GameHistoryEntry[]): number | null {
    const gameOverEntry = [...history]
      .reverse()
      .find((entry) => entry.actionType === 'game_over');

    if (!gameOverEntry) {
      return null;
    }

    return typeof gameOverEntry.actionData.winningTeam === 'number'
      ? gameOverEntry.actionData.winningTeam
      : null;
  }

  private toReplayEvent(entry: GameHistoryEntry): GameHistoryReplayEvent {
    const context = this.extractContext(entry);
    const details = this.normalizeReplayDetails(entry);
    const base = {
      id: entry.id,
      timestamp: entry.timestamp,
      playerId: entry.playerId,
      roundNumber: this.extractRoundNumber(entry),
      gamePhase: context?.gamePhase ?? null,
      summary: this.summarizeEntry(entry),
      detailItems: this.buildDetailItems(entry, details),
      context,
      actionData: entry.actionData,
    };

    switch (entry.actionType) {
      case 'game_started':
        return {
          ...base,
          actionType: entry.actionType,
          kind: 'lifecycle',
          details: details as GameStartedReplayDetails,
        };
      case 'blow_declared':
        return {
          ...base,
          actionType: entry.actionType,
          kind: 'blow',
          details: details as BlowDeclaredReplayDetails,
        };
      case 'blow_passed':
        return {
          ...base,
          actionType: entry.actionType,
          kind: 'blow',
          details: details as BlowPassedReplayDetails,
        };
      case 'play_phase_started':
        return {
          ...base,
          actionType: entry.actionType,
          kind: 'blow',
          details: details as PlayPhaseStartedReplayDetails,
        };
      case 'card_played':
        return {
          ...base,
          actionType: entry.actionType,
          kind: 'play',
          details: details as CardPlayedReplayDetails,
        };
      case 'field_completed':
        return {
          ...base,
          actionType: entry.actionType,
          kind: 'play',
          details: details as FieldCompletedReplayDetails,
        };
      case 'round_completed':
        return {
          ...base,
          actionType: entry.actionType,
          kind: 'round',
          details: details as RoundCompletedReplayDetails,
        };
      case 'round_cancelled':
        return {
          ...base,
          actionType: entry.actionType,
          kind: 'round',
          details: details as RoundCancelledReplayDetails,
        };
      case 'round_reset':
        return {
          ...base,
          actionType: entry.actionType,
          kind: 'round',
          details: details as RoundResetReplayDetails,
        };
      case 'broken_hand_revealed':
        return {
          ...base,
          actionType: entry.actionType,
          kind: 'blow',
          details: details as BrokenHandRevealedReplayDetails,
        };
      case 'game_over':
        return {
          ...base,
          actionType: entry.actionType,
          kind: 'lifecycle',
          details: details as GameOverReplayDetails,
        };
      case 'player_stats_updated':
        return {
          ...base,
          actionType: entry.actionType,
          kind: 'stats',
          details: details as PlayerStatsUpdatedReplayDetails,
        };
      default: {
        const exhaustiveActionType: never = entry.actionType;
        throw new Error(
          `Unsupported action type: ${String(exhaustiveActionType)}`,
        );
      }
    }
  }

  private summarizeEntry(entry: GameHistoryEntry): string {
    const actionData = entry.actionData;
    const playerLabel =
      this.resolvePlayerLabel(actionData, entry.playerId) ?? 'Unknown player';

    switch (entry.actionType) {
      case 'game_started':
        return this.formatGameStartedSummary(actionData);
      case 'blow_declared':
        return this.formatBlowDeclaredSummary(playerLabel, actionData);
      case 'blow_passed':
        return `${playerLabel} passed blow`;
      case 'play_phase_started':
        return this.formatPlayPhaseStartedSummary(actionData);
      case 'card_played':
        return this.formatCardPlayedSummary(playerLabel, actionData);
      case 'field_completed':
        return this.formatFieldCompletedSummary(actionData);
      case 'round_completed':
        return this.formatRoundCompletedSummary(actionData);
      case 'round_cancelled':
        return this.formatRoundCancelledSummary(actionData);
      case 'round_reset':
        return this.formatRoundResetSummary(actionData);
      case 'broken_hand_revealed':
        return this.formatBrokenHandSummary(playerLabel, actionData);
      case 'game_over':
        return this.formatGameOverSummary(actionData);
      case 'player_stats_updated':
        return this.formatPlayerStatsUpdatedSummary(actionData);
      default:
        return entry.actionType;
    }
  }

  private normalizeReplayDetails(
    entry: GameHistoryEntry,
  ):
    | GameStartedReplayDetails
    | BlowDeclaredReplayDetails
    | BlowPassedReplayDetails
    | PlayPhaseStartedReplayDetails
    | CardPlayedReplayDetails
    | FieldCompletedReplayDetails
    | RoundCompletedReplayDetails
    | RoundCancelledReplayDetails
    | RoundResetReplayDetails
    | BrokenHandRevealedReplayDetails
    | GameOverReplayDetails
    | PlayerStatsUpdatedReplayDetails {
    const actionData = entry.actionData;

    switch (entry.actionType) {
      case 'game_started':
        return {
          firstBlowPlayerId:
            typeof actionData.firstBlowPlayerId === 'string'
              ? actionData.firstBlowPlayerId
              : null,
          startedByPlayerId:
            typeof actionData.startedByPlayerId === 'string'
              ? actionData.startedByPlayerId
              : null,
          pointsToWin:
            typeof actionData.pointsToWin === 'number'
              ? actionData.pointsToWin
              : null,
        };
      case 'blow_declared':
        return {
          declaration: this.asRecord(actionData.declaration),
          currentHighestDeclaration: this.asRecord(
            actionData.currentHighestDeclaration,
          ),
        };
      case 'blow_passed':
        return {
          lastPasser:
            typeof actionData.lastPasser === 'string'
              ? actionData.lastPasser
              : null,
          actedCount:
            typeof actionData.actedCount === 'number'
              ? actionData.actedCount
              : null,
        };
      case 'play_phase_started':
        return {
          winnerPlayerId:
            typeof actionData.winnerPlayerId === 'string'
              ? actionData.winnerPlayerId
              : null,
          currentTrump:
            typeof actionData.currentTrump === 'string'
              ? actionData.currentTrump
              : null,
          revealBrokenRequired:
            typeof actionData.revealBrokenRequired === 'boolean'
              ? actionData.revealBrokenRequired
              : false,
        };
      case 'card_played':
        return {
          card: typeof actionData.card === 'string' ? actionData.card : null,
          fieldCards: Array.isArray(actionData.fieldCards)
            ? actionData.fieldCards.filter(
                (value): value is string => typeof value === 'string',
              )
            : [],
          baseCard:
            typeof actionData.baseCard === 'string'
              ? actionData.baseCard
              : null,
        };
      case 'field_completed':
        return {
          winnerPlayerId:
            typeof actionData.winnerPlayerId === 'string'
              ? actionData.winnerPlayerId
              : null,
          winnerTeam:
            typeof actionData.winnerTeam === 'number'
              ? actionData.winnerTeam
              : null,
          cards: Array.isArray(actionData.cards)
            ? actionData.cards.filter(
                (value): value is string => typeof value === 'string',
              )
            : [],
        };
      case 'round_completed':
        return {
          declaringTeam:
            typeof actionData.declaringTeam === 'number'
              ? actionData.declaringTeam
              : null,
          teamScores: this.asRecord(actionData.teamScores),
        };
      case 'round_cancelled':
        return {
          highestDeclaration: this.asRecord(actionData.highestDeclaration),
        };
      case 'round_reset':
        return {
          nextDealerId:
            typeof actionData.nextDealerId === 'string'
              ? actionData.nextDealerId
              : null,
        };
      case 'broken_hand_revealed':
        return {
          nextPlayerId:
            typeof actionData.nextPlayerId === 'string'
              ? actionData.nextPlayerId
              : null,
          nextBlowIndex:
            typeof actionData.nextBlowIndex === 'number'
              ? actionData.nextBlowIndex
              : null,
        };
      case 'game_over':
        return {
          winningTeam:
            typeof actionData.winningTeam === 'number'
              ? actionData.winningTeam
              : null,
          finalScores: this.asRecord(actionData.finalScores),
        };
      case 'player_stats_updated':
        return {
          winningTeam:
            typeof actionData.winningTeam === 'number'
              ? actionData.winningTeam
              : null,
          updatedPlayers: Array.isArray(actionData.updatedPlayers)
            ? actionData.updatedPlayers.filter(
                (value): value is string => typeof value === 'string',
              )
            : [],
          skippedPlayers: Array.isArray(actionData.skippedPlayers)
            ? actionData.skippedPlayers.filter(
                (value): value is string => typeof value === 'string',
              )
            : [],
          updatedCount:
            typeof actionData.updatedCount === 'number'
              ? actionData.updatedCount
              : 0,
          failedCount:
            typeof actionData.failedCount === 'number'
              ? actionData.failedCount
              : 0,
        };
      default:
        throw new Error(
          `Unsupported action type details: ${String(entry.actionType)}`,
        );
    }
  }

  private buildDetailItems(
    entry: GameHistoryEntry,
    details:
      | GameStartedReplayDetails
      | BlowDeclaredReplayDetails
      | BlowPassedReplayDetails
      | PlayPhaseStartedReplayDetails
      | CardPlayedReplayDetails
      | FieldCompletedReplayDetails
      | RoundCompletedReplayDetails
      | RoundCancelledReplayDetails
      | RoundResetReplayDetails
      | BrokenHandRevealedReplayDetails
      | GameOverReplayDetails
      | PlayerStatsUpdatedReplayDetails,
  ): GameHistoryReplayDetailItem[] {
    switch (entry.actionType) {
      case 'game_started': {
        const typedDetails = details as GameStartedReplayDetails;
        return [
          this.playerDetail('startedBy', entry, typedDetails.startedByPlayerId),
          this.playerDetail('firstBlow', entry, typedDetails.firstBlowPlayerId),
          this.numberDetail('pointsToWin', typedDetails.pointsToWin),
        ].filter((item): item is GameHistoryReplayDetailItem => Boolean(item));
      }
      case 'blow_declared': {
        const typedDetails = details as BlowDeclaredReplayDetails;
        return [
          this.textDetail(
            'declaration',
            this.formatDeclarationSummary(typedDetails.declaration),
          ),
          this.textDetail(
            'highestDeclaration',
            this.formatDeclarationSummary(
              typedDetails.currentHighestDeclaration,
            ),
          ),
        ].filter((item): item is GameHistoryReplayDetailItem => Boolean(item));
      }
      case 'blow_passed': {
        const typedDetails = details as BlowPassedReplayDetails;
        return [
          this.playerDetail('lastPasser', entry, typedDetails.lastPasser),
          this.numberDetail('actedCount', typedDetails.actedCount),
        ].filter((item): item is GameHistoryReplayDetailItem => Boolean(item));
      }
      case 'play_phase_started': {
        const typedDetails = details as PlayPhaseStartedReplayDetails;
        return [
          this.playerDetail('winner', entry, typedDetails.winnerPlayerId),
          this.trumpDetail('trump', typedDetails.currentTrump),
          this.textDetail(
            'revealBroken',
            typedDetails.revealBrokenRequired ? 'required' : 'notRequired',
          ),
        ].filter((item): item is GameHistoryReplayDetailItem => Boolean(item));
      }
      case 'card_played': {
        const typedDetails = details as CardPlayedReplayDetails;
        return [
          this.textDetail('card', typedDetails.card),
          this.textDetail('baseCard', typedDetails.baseCard),
          this.cardsDetail('cards', typedDetails.fieldCards),
        ].filter((item): item is GameHistoryReplayDetailItem => Boolean(item));
      }
      case 'field_completed': {
        const typedDetails = details as FieldCompletedReplayDetails;
        return [
          this.playerDetail('winner', entry, typedDetails.winnerPlayerId),
          this.teamDetail('winnerTeam', typedDetails.winnerTeam),
          this.cardsDetail('cards', typedDetails.cards),
        ].filter((item): item is GameHistoryReplayDetailItem => Boolean(item));
      }
      case 'round_completed': {
        const typedDetails = details as RoundCompletedReplayDetails;
        return [
          this.teamDetail('declaringTeam', typedDetails.declaringTeam),
          this.scoresDetail('scores', typedDetails.teamScores),
        ].filter((item): item is GameHistoryReplayDetailItem => Boolean(item));
      }
      case 'round_cancelled': {
        const typedDetails = details as RoundCancelledReplayDetails;
        return [
          this.textDetail(
            'highestDeclaration',
            this.formatDeclarationSummary(typedDetails.highestDeclaration),
          ),
        ].filter((item): item is GameHistoryReplayDetailItem => Boolean(item));
      }
      case 'round_reset': {
        const typedDetails = details as RoundResetReplayDetails;
        return [
          this.playerDetail('nextDealer', entry, typedDetails.nextDealerId),
        ].filter((item): item is GameHistoryReplayDetailItem => Boolean(item));
      }
      case 'broken_hand_revealed': {
        const typedDetails = details as BrokenHandRevealedReplayDetails;
        return [
          this.playerDetail('nextPlayer', entry, typedDetails.nextPlayerId),
          this.numberDetail('nextBlowIndex', typedDetails.nextBlowIndex),
        ].filter((item): item is GameHistoryReplayDetailItem => Boolean(item));
      }
      case 'game_over': {
        const typedDetails = details as GameOverReplayDetails;
        return [
          this.teamDetail('winnerTeam', typedDetails.winningTeam),
          this.scoresDetail('finalScores', typedDetails.finalScores),
        ].filter((item): item is GameHistoryReplayDetailItem => Boolean(item));
      }
      case 'player_stats_updated': {
        const typedDetails = details as PlayerStatsUpdatedReplayDetails;
        return [
          this.numberDetail('updated', typedDetails.updatedCount),
          this.numberDetail('failed', typedDetails.failedCount),
        ].filter((item): item is GameHistoryReplayDetailItem => Boolean(item));
      }
      default: {
        const exhaustiveActionType: never = entry.actionType;
        throw new Error(
          `Unsupported action type detail items: ${String(exhaustiveActionType)}`,
        );
      }
    }
  }

  private textDetail(
    labelKey: string,
    text: string | null | undefined,
  ): GameHistoryReplayDetailItem | null {
    if (!text) {
      return null;
    }

    return {
      labelKey,
      value: {
        kind: 'text',
        text,
      },
    };
  }

  private playerDetail(
    labelKey: string,
    entry: GameHistoryEntry,
    playerId: string | null,
  ): GameHistoryReplayDetailItem | null {
    if (!playerId) {
      return null;
    }

    const playerNames = this.extractPlayerNames(entry);

    return {
      labelKey,
      value: {
        kind: 'player',
        playerId,
        playerName: playerNames[playerId] ?? null,
      },
    };
  }

  private teamDetail(
    labelKey: string,
    team: number | null,
  ): GameHistoryReplayDetailItem | null {
    if (team === null) {
      return null;
    }

    return {
      labelKey,
      value: {
        kind: 'team',
        team,
      },
    };
  }

  private trumpDetail(
    labelKey: string,
    trump: string | null,
  ): GameHistoryReplayDetailItem | null {
    if (!trump) {
      return null;
    }

    return {
      labelKey,
      value: {
        kind: 'trump',
        trump,
      },
    };
  }

  private numberDetail(
    labelKey: string,
    value: number | null,
  ): GameHistoryReplayDetailItem | null {
    if (value === null) {
      return null;
    }

    return {
      labelKey,
      value: {
        kind: 'number',
        value,
      },
    };
  }

  private cardsDetail(
    labelKey: string,
    cards: string[],
  ): GameHistoryReplayDetailItem | null {
    if (cards.length === 0) {
      return null;
    }

    return {
      labelKey,
      value: {
        kind: 'cards',
        cards,
      },
    };
  }

  private scoresDetail(
    labelKey: string,
    scores: Record<string, unknown> | null,
  ): GameHistoryReplayDetailItem | null {
    if (!scores) {
      return null;
    }

    return {
      labelKey,
      value: {
        kind: 'scores',
        scores,
      },
    };
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)
      : null;
  }

  private formatDeclarationSummary(
    declaration: Record<string, unknown> | null,
  ): string | null {
    if (!declaration) {
      return null;
    }

    const trumpType =
      typeof declaration.trumpType === 'string' ? declaration.trumpType : null;
    const numberOfPairs =
      typeof declaration.numberOfPairs === 'number'
        ? declaration.numberOfPairs
        : null;

    if (numberOfPairs !== null && trumpType) {
      return `${numberOfPairs} pair(s) / ${trumpType}`;
    }
    if (numberOfPairs !== null) {
      return `${numberOfPairs} pair(s)`;
    }
    if (trumpType) {
      return trumpType;
    }

    return null;
  }

  private formatGameStartedSummary(
    actionData: Record<string, unknown>,
  ): string {
    const firstBlowPlayerId =
      typeof actionData.firstBlowPlayerId === 'string'
        ? actionData.firstBlowPlayerId
        : null;
    const firstBlowPlayerLabel = this.resolvePlayerLabel(
      actionData,
      firstBlowPlayerId,
    );
    const pointsToWin =
      typeof actionData.pointsToWin === 'number'
        ? actionData.pointsToWin
        : null;

    if (firstBlowPlayerLabel && pointsToWin !== null) {
      return `Game started. First blow: ${firstBlowPlayerLabel}. Target: ${pointsToWin} points`;
    }
    if (firstBlowPlayerLabel) {
      return `Game started. First blow: ${firstBlowPlayerLabel}`;
    }
    return 'Game started';
  }

  private formatBlowDeclaredSummary(
    playerLabel: string,
    actionData: Record<string, unknown>,
  ): string {
    const declaration =
      actionData.declaration &&
      typeof actionData.declaration === 'object' &&
      actionData.declaration !== null
        ? (actionData.declaration as Record<string, unknown>)
        : null;
    const trumpType =
      declaration && typeof declaration.trumpType === 'string'
        ? declaration.trumpType
        : null;
    const numberOfPairs =
      declaration && typeof declaration.numberOfPairs === 'number'
        ? declaration.numberOfPairs
        : null;
    const trumpLabel = this.formatTrumpLabel(trumpType);

    if (trumpLabel && numberOfPairs !== null) {
      return `${playerLabel} declared ${numberOfPairs} pair(s) with ${trumpLabel}`;
    }
    return `${playerLabel} declared blow`;
  }

  private formatPlayPhaseStartedSummary(
    actionData: Record<string, unknown>,
  ): string {
    const winnerPlayerId =
      typeof actionData.winnerPlayerId === 'string'
        ? actionData.winnerPlayerId
        : null;
    const winnerPlayerLabel = this.resolvePlayerLabel(
      actionData,
      winnerPlayerId,
    );
    const currentTrump =
      typeof actionData.currentTrump === 'string'
        ? actionData.currentTrump
        : null;
    const trumpLabel = this.formatTrumpLabel(currentTrump);

    if (winnerPlayerLabel && trumpLabel) {
      return `Play phase started. ${winnerPlayerLabel} leads with trump ${trumpLabel}`;
    }
    if (winnerPlayerLabel) {
      return `Play phase started. ${winnerPlayerLabel} leads`;
    }
    return 'Play phase started';
  }

  private formatCardPlayedSummary(
    playerLabel: string,
    actionData: Record<string, unknown>,
  ): string {
    const card = typeof actionData.card === 'string' ? actionData.card : null;
    const fieldCards = Array.isArray(actionData.fieldCards)
      ? actionData.fieldCards.filter(
          (value): value is string => typeof value === 'string',
        )
      : [];

    if (card) {
      const fieldProgress =
        fieldCards.length > 0 ? ` (${fieldCards.length}/4)` : '';
      return `${playerLabel} played ${card}${fieldProgress}`;
    }
    return `${playerLabel} played a card`;
  }

  private formatFieldCompletedSummary(
    actionData: Record<string, unknown>,
  ): string {
    const winnerPlayerId =
      typeof actionData.winnerPlayerId === 'string'
        ? actionData.winnerPlayerId
        : null;
    const winnerPlayerLabel = this.resolvePlayerLabel(
      actionData,
      winnerPlayerId,
    );
    const winnerTeam =
      typeof actionData.winnerTeam === 'number' ? actionData.winnerTeam : null;
    const winnerTeamLabel = this.formatTeamLabel(winnerTeam);

    if (winnerPlayerLabel && winnerTeamLabel) {
      return `Field completed by ${winnerPlayerLabel} for ${winnerTeamLabel}`;
    }
    if (winnerPlayerLabel) {
      return `Field completed by ${winnerPlayerLabel}`;
    }
    return 'Field completed';
  }

  private formatRoundCompletedSummary(
    actionData: Record<string, unknown>,
  ): string {
    const declaringTeam =
      typeof actionData.declaringTeam === 'number'
        ? actionData.declaringTeam
        : null;
    const finalScores =
      actionData.teamScores &&
      typeof actionData.teamScores === 'object' &&
      actionData.teamScores !== null
        ? (actionData.teamScores as Record<string, unknown>)
        : null;
    const declaringTeamLabel = this.formatTeamLabel(declaringTeam);

    if (declaringTeamLabel && finalScores) {
      return `Round completed. Declaring team: ${declaringTeamLabel}`;
    }
    if (declaringTeamLabel) {
      return `Round completed. Declaring team: ${declaringTeamLabel}`;
    }
    return 'Round completed';
  }

  private formatRoundCancelledSummary(
    actionData: Record<string, unknown>,
  ): string {
    const highestDeclaration =
      actionData.highestDeclaration &&
      typeof actionData.highestDeclaration === 'object' &&
      actionData.highestDeclaration !== null
        ? (actionData.highestDeclaration as Record<string, unknown>)
        : null;
    const playerId =
      highestDeclaration && typeof highestDeclaration.playerId === 'string'
        ? highestDeclaration.playerId
        : null;
    const playerLabel = this.resolvePlayerLabel(actionData, playerId);

    return playerLabel
      ? `Round cancelled after declaration by ${playerLabel}`
      : 'Round cancelled';
  }

  private formatRoundResetSummary(actionData: Record<string, unknown>): string {
    const nextDealerId =
      typeof actionData.nextDealerId === 'string'
        ? actionData.nextDealerId
        : null;
    const nextDealerLabel = this.resolvePlayerLabel(actionData, nextDealerId);

    return nextDealerLabel
      ? `Round reset. Next dealer: ${nextDealerLabel}`
      : 'Round reset';
  }

  private formatBrokenHandSummary(
    playerLabel: string,
    actionData: Record<string, unknown>,
  ): string {
    const nextPlayerId =
      typeof actionData.nextPlayerId === 'string'
        ? actionData.nextPlayerId
        : null;
    const nextPlayerLabel = this.resolvePlayerLabel(actionData, nextPlayerId);

    return nextPlayerLabel
      ? `${playerLabel} revealed a broken hand. Next player: ${nextPlayerLabel}`
      : `${playerLabel} revealed broken hand`;
  }

  private formatGameOverSummary(actionData: Record<string, unknown>): string {
    const winningTeam =
      typeof actionData.winningTeam === 'number'
        ? actionData.winningTeam
        : null;
    const winningTeamLabel = this.formatTeamLabel(winningTeam);

    return winningTeamLabel
      ? `Game over. ${winningTeamLabel} won`
      : 'Game over';
  }

  private formatPlayerStatsUpdatedSummary(
    actionData: Record<string, unknown>,
  ): string {
    const updatedCount =
      typeof actionData.updatedCount === 'number' ? actionData.updatedCount : 0;
    const failedCount =
      typeof actionData.failedCount === 'number' ? actionData.failedCount : 0;
    const skippedPlayers = Array.isArray(actionData.skippedPlayers)
      ? actionData.skippedPlayers.filter(
          (value): value is string => typeof value === 'string',
        )
      : [];

    const segments = [`Player stats updated for ${updatedCount} player(s)`];
    if (skippedPlayers.length > 0) {
      segments.push(`skipped ${skippedPlayers.length}`);
    }
    if (failedCount > 0) {
      segments.push(`failed ${failedCount}`);
    }

    return segments.join(', ');
  }

  private resolvePlayerLabel(
    actionData: Record<string, unknown>,
    playerId: string | null,
  ): string | null {
    if (!playerId) {
      return null;
    }

    const playerNames =
      actionData.playerNames &&
      typeof actionData.playerNames === 'object' &&
      actionData.playerNames !== null
        ? (actionData.playerNames as Record<string, unknown>)
        : null;

    const playerName =
      playerNames && typeof playerNames[playerId] === 'string'
        ? playerNames[playerId]
        : null;

    return playerName ?? playerId;
  }

  private formatTeamLabel(team: number | null): string | null {
    if (team === null) {
      return null;
    }

    return `Team ${team + 1}`;
  }

  private formatTrumpLabel(trump: string | null): string | null {
    if (!trump) {
      return null;
    }

    return trump.charAt(0).toUpperCase() + trump.slice(1);
  }
}
