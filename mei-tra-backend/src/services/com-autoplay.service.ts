import { Injectable, Logger } from '@nestjs/common';
import { IComAutoPlayService } from './interfaces/com-autoplay-service.interface';

@Injectable()
export class ComAutoPlayService implements IComAutoPlayService {
  private readonly logger = new Logger(ComAutoPlayService.name);
  private comTurnTimeouts = new Map<string, NodeJS.Timeout>();

  scheduleComTurn(
    roomId: string,
    playerId: string,
    action: () => Promise<void>,
  ): void {
    this.clearComTurn(roomId, playerId);

    const timeout = setTimeout(() => {
      void (async () => {
        try {
          await action();
        } catch (error) {
          this.logger.error(
            `COM auto-play error in room ${roomId} for player ${playerId}:`,
            error,
          );
        } finally {
          this.comTurnTimeouts.delete(`${roomId}:${playerId}`);
        }
      })();
    }, 2000);

    this.comTurnTimeouts.set(`${roomId}:${playerId}`, timeout);
  }

  clearComTurn(roomId: string, playerId: string): void {
    const key = `${roomId}:${playerId}`;
    const timeout = this.comTurnTimeouts.get(key);
    if (timeout) {
      clearTimeout(timeout);
      this.comTurnTimeouts.delete(key);
    }
  }

  clearRoomTimers(roomId: string): void {
    for (const [key, timeout] of this.comTurnTimeouts.entries()) {
      if (key.startsWith(`${roomId}:`)) {
        clearTimeout(timeout);
        this.comTurnTimeouts.delete(key);
      }
    }
  }
}
