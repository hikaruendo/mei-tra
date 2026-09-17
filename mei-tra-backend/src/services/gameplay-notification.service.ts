import { Inject, Injectable, Logger } from '@nestjs/common';
import { PushNotificationService } from '../push/push-notification.service';
import { IUserProfileRepository } from '../repositories/interfaces/user-profile.repository.interface';
import { IRoomService } from './interfaces/room-service.interface';
import type { GameState } from '../types/game.types';
import type { Room, RoomPlayer } from '../types/room.types';
import type { GameStateService } from './game-state.service';

const MAX_DEDUPED_EVENTS = 1_000;

interface GameStartedNotificationParams {
  roomId: string;
}

interface NotificationContext {
  room: Room;
  gameState: GameStateService;
  state: GameState;
}

@Injectable()
export class GameplayNotificationService {
  private readonly logger = new Logger(GameplayNotificationService.name);
  private readonly sentEventIds = new Set<string>();
  private readonly sentEventOrder: string[] = [];

  constructor(
    @Inject('IRoomService') private readonly roomService: IRoomService,
    @Inject('IUserProfileRepository')
    private readonly userProfileRepository: IUserProfileRepository,
    private readonly pushNotificationService: PushNotificationService,
  ) {}

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
