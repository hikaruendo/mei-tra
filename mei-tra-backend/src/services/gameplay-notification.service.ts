import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PushNotificationService } from '../push/push-notification.service';
import { IUserProfileRepository } from '../repositories/interfaces/user-profile.repository.interface';
import { IRoomService } from './interfaces/room-service.interface';
import type { GameState } from '../types/game.types';
import type { Room, RoomPlayer } from '../types/room.types';
import type { SeatId } from '../types/identity.types';
import type { GameStateService } from './game-state.service';

const MAX_DEDUPED_EVENTS = 1_000;
const TURN_NOTIFICATION_STALL_MS = 60_000;

interface GameStartedNotificationParams {
  roomId: string;
}

interface TurnNotificationParams {
  roomId: string;
  seatId: SeatId;
  transitionDelayMs?: number;
}

interface NotificationContext {
  room: Room;
  gameState: GameStateService;
  state: GameState;
}

interface TurnNotificationSnapshot {
  eventId: string;
  roomId: string;
  seatId: SeatId;
  roundNumber: number;
  phase: 'blow' | 'play';
}

interface PendingTurnNotification {
  eventId: string;
  timeout: NodeJS.Timeout;
}

@Injectable()
export class GameplayNotificationService implements OnModuleDestroy {
  private readonly logger = new Logger(GameplayNotificationService.name);
  private readonly sentEventIds = new Set<string>();
  private readonly sentEventOrder: string[] = [];
  private readonly pendingTurnsByRoom = new Map<
    string,
    PendingTurnNotification
  >();

  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
    @Inject('IUserProfileRepository')
    private readonly userProfileRepository: IUserProfileRepository,
    private readonly pushNotificationService: PushNotificationService,
  ) {}

  onModuleDestroy(): void {
    this.pendingTurnsByRoom.forEach(({ timeout }) => clearTimeout(timeout));
    this.pendingTurnsByRoom.clear();
  }

  async notifyGameStarted({
    roomId,
  }: GameStartedNotificationParams): Promise<void> {
    try {
      const context = await this.loadContext(roomId);
      if (!context || context.state.roundNumber !== 1) {
        return;
      }

      const eventId = this.buildGameStartedEventId(roomId, context.state);
      if (!this.markEvent(eventId)) {
        return;
      }

      const recipients = await this.resolveNotificationUserIds(
        context.room.players,
        context.gameState,
      );

      if (recipients.length === 0) {
        return;
      }

      await this.pushNotificationService.sendGameStarted(recipients, {
        eventId,
        roomId,
        roundNumber: context.state.roundNumber,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send game-started push notifications for room ${roomId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async notifyTurnChanged({
    roomId,
    seatId,
    transitionDelayMs,
  }: TurnNotificationParams): Promise<void> {
    try {
      const context = await this.loadContext(roomId);
      const snapshot = context
        ? this.createTurnSnapshot(roomId, seatId, context.state)
        : null;
      if (!snapshot) {
        this.clearPendingTurn(roomId);
        return;
      }

      const pending = this.pendingTurnsByRoom.get(roomId);
      if (pending?.eventId === snapshot.eventId) {
        return;
      }

      this.clearPendingTurn(roomId);
      const delayMs =
        Math.max(0, transitionDelayMs ?? 0) + TURN_NOTIFICATION_STALL_MS;
      const timeout = setTimeout(() => {
        const latestPending = this.pendingTurnsByRoom.get(roomId);
        if (latestPending?.eventId !== snapshot.eventId) {
          return;
        }

        this.pendingTurnsByRoom.delete(roomId);
        void this.sendTurnNotification(snapshot);
      }, delayMs);
      this.pendingTurnsByRoom.set(roomId, {
        eventId: snapshot.eventId,
        timeout,
      });
    } catch (error) {
      this.logger.error(
        `Failed to schedule turn push notification for room ${roomId} seat ${seatId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async sendTurnNotification(
    snapshot: TurnNotificationSnapshot,
  ): Promise<void> {
    try {
      const context = await this.loadContext(snapshot.roomId);
      if (!context) {
        return;
      }

      const currentSnapshot = this.createTurnSnapshot(
        snapshot.roomId,
        snapshot.seatId,
        context.state,
      );
      if (!currentSnapshot || currentSnapshot.eventId !== snapshot.eventId) {
        return;
      }

      const targetPlayer = context.room.players.find(
        (player) => player.seatId === snapshot.seatId,
      );
      if (!targetPlayer) {
        return;
      }

      const recipients = await this.resolveNotificationUserIds(
        [targetPlayer],
        context.gameState,
      );
      if (recipients.length === 0 || !this.markEvent(snapshot.eventId)) {
        return;
      }

      await this.pushNotificationService.sendTurnNotification(recipients, {
        eventId: snapshot.eventId,
        roomId: snapshot.roomId,
        roundNumber: snapshot.roundNumber,
        phase: snapshot.phase,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send turn push notification for room ${snapshot.roomId} seat ${snapshot.seatId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private clearPendingTurn(roomId: string): void {
    const pending = this.pendingTurnsByRoom.get(roomId);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingTurnsByRoom.delete(roomId);
  }

  private async loadContext(
    roomId: string,
  ): Promise<NotificationContext | null> {
    const [room, roomGameState] = await Promise.all([
      this.roomService.getRoom(roomId),
      this.roomService.getRoomGameState(roomId),
    ]);

    if (!room) {
      return null;
    }

    return {
      room,
      gameState: roomGameState,
      state: roomGameState.getState(),
    };
  }

  private async resolveNotificationUserIds(
    players: readonly RoomPlayer[],
    gameState: GameStateService,
  ): Promise<string[]> {
    const candidateUserIds = [
      ...new Set(
        players
          .filter((player) => !player.isCOM)
          .filter((player) => player.isAuthenticated === true)
          .filter(
            (player) =>
              !gameState.getPlayerConnectionState(player.seatId)?.socketId,
          )
          .map((player) => player.userId)
          .filter((userId): userId is string => Boolean(userId)),
      ),
    ];

    if (candidateUserIds.length === 0) {
      return [];
    }

    const enabledResults = await Promise.all(
      candidateUserIds.map(async (userId) => {
        try {
          const profile = await this.userProfileRepository.findById(userId);
          return profile?.preferences?.notifications === false ? null : userId;
        } catch (error) {
          this.logger.warn(
            `Failed to load notification preference for user ${userId}; skipping push`,
            error instanceof Error ? error.stack : String(error),
          );
          return null;
        }
      }),
    );

    return enabledResults.filter((userId): userId is string => Boolean(userId));
  }

  private buildGameStartedEventId(roomId: string, state: GameState): string {
    return ['game-started', roomId, state.roundNumber].join(':');
  }

  private createTurnSnapshot(
    roomId: string,
    seatId: SeatId,
    state: GameState,
  ): TurnNotificationSnapshot | null {
    const phase = this.resolvePushPhase(state.gamePhase);
    if (!phase || (state.currentSeatId ?? null) !== seatId) {
      return null;
    }

    return {
      eventId: this.buildTurnEventId(roomId, seatId, state),
      roomId,
      seatId,
      roundNumber: state.roundNumber,
      phase,
    };
  }

  private resolvePushPhase(
    phase: GameState['gamePhase'],
  ): 'blow' | 'play' | null {
    return phase === 'blow' || phase === 'play' ? phase : null;
  }

  private buildTurnEventId(
    roomId: string,
    seatId: SeatId,
    state: GameState,
  ): string {
    return [
      'turn',
      roomId,
      state.roundNumber,
      state.gamePhase,
      seatId,
      state.blowState.currentBlowIndex,
      state.blowState.actionHistory?.length ?? 0,
      state.playState?.fields?.length ?? 0,
      state.playState?.currentField?.cards?.length ?? 0,
      state.playState?.currentField?.dealerSeatId ?? '',
    ].join(':');
  }

  private markEvent(eventId: string): boolean {
    if (this.sentEventIds.has(eventId)) {
      return false;
    }

    this.sentEventIds.add(eventId);
    this.sentEventOrder.push(eventId);

    while (this.sentEventOrder.length > MAX_DEDUPED_EVENTS) {
      const staleEventId = this.sentEventOrder.shift();
      if (staleEventId) {
        this.sentEventIds.delete(staleEventId);
      }
    }

    return true;
  }
}
