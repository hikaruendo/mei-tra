import { Injectable } from '@nestjs/common';

/**
 * Serializes authoritative gameplay mutations per room while allowing
 * independent rooms to keep progressing in parallel.
 */
@Injectable()
export class RoomGameActionQueueService {
  private readonly roomTails = new Map<string, Promise<void>>();

  run<T>(roomId: string, action: () => Promise<T>): Promise<T> {
    const previousTail = this.roomTails.get(roomId) ?? Promise.resolve();
    const result = previousTail.then(action, action);
    const nextTail = result.then(
      () => undefined,
      () => undefined,
    );

    this.roomTails.set(roomId, nextTail);
    void nextTail.finally(() => {
      if (this.roomTails.get(roomId) === nextTail) {
        this.roomTails.delete(roomId);
      }
    });

    return result;
  }
}
