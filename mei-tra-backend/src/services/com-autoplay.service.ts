import { Injectable, Logger } from '@nestjs/common';
import { IComAutoPlayService } from './interfaces/com-autoplay-service.interface';
import type { SeatId } from '../types/identity.types';

@Injectable()
export class ComAutoPlayService implements IComAutoPlayService {
  private readonly logger = new Logger(ComAutoPlayService.name);
  private comTurnTimeouts = new Map<string, NodeJS.Timeout>();

  scheduleComTurn(
    roomId: string,
    seatId: SeatId,
    action: () => Promise<void>,
  ): void {
    this.clearComTurn(roomId, seatId);

    const timeout = setTimeout(() => {
      void (async () => {
        try {
          await action();
        } catch (error) {
          this.logger.error(
            `COM auto-play error in room ${roomId} for seat ${seatId}:`,
            error,
          );
        } finally {
          this.comTurnTimeouts.delete(`${roomId}:${seatId}`);
        }
      })();
    }, 2000);

    this.comTurnTimeouts.set(`${roomId}:${seatId}`, timeout);
  }

  clearComTurn(roomId: string, seatId: SeatId): void {
    const key = `${roomId}:${seatId}`;
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
