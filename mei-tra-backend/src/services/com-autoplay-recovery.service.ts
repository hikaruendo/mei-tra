import { Inject, Injectable, Logger } from '@nestjs/common';
import { IRoomService } from './interfaces/room-service.interface';
import {
  ComAutoPlayResponse,
  IComAutoPlayUseCase,
} from '../use-cases/interfaces/com-autoplay-use-case.interface';
import {
  CompleteFieldResponse,
  ICompleteFieldUseCase,
} from '../use-cases/interfaces/complete-field.use-case.interface';
import { CompleteFieldTrigger } from '../use-cases/interfaces/play-card.use-case.interface';
import { GatewayEvent } from '../use-cases/interfaces/gateway-event.interface';
import { BROKEN_HAND_REVEAL_PENDING_TTL_MS } from '../use-cases/helpers/broken-hand.helper';

const COM_AUTO_PLAY_RETRY_DELAY_MS = 5_000;
const COM_AUTO_PLAY_INITIAL_DELAY_MS = 2_000;
const COM_AUTO_PLAY_CONTINUE_DELAY_MS = 2_000;
const MAX_COM_AUTO_PLAY_RETRY_DELAY_MS = 60_000;

export interface ComAutoPlayRecoveryHandlers {
  dispatchEvents(events?: GatewayEvent[]): void;
  processFieldCompletion(
    roomId: string,
    response: CompleteFieldResponse,
    initiatingActorId?: string,
  ): Promise<void>;
}

// 'continuation' / 'initial' timers pace COM against delayed client broadcasts
// and must not be cancelled. 'retry' timers only back off after a failure, so
// a reconnect may cancel them to recover sooner.
type PendingTriggerKind = 'retry' | 'continuation' | 'initial';

interface PendingTrigger {
  timeout: NodeJS.Timeout;
  kind: PendingTriggerKind;
}

@Injectable()
export class ComAutoPlayRecoveryService {
  private readonly logger = new Logger(ComAutoPlayRecoveryService.name);
  private readonly activeRooms = new Set<string>();
  private readonly pendingReruns = new Set<string>();
  private readonly retryTimeouts = new Map<string, PendingTrigger>();
  private readonly fieldCompletionTimeouts = new Map<string, NodeJS.Timeout>();
  private readonly retryAttempts = new Map<string, number>();
  private readonly roomGenerations = new Map<string, number>();

  constructor(
    @Inject('IRoomService')
    private readonly roomService: IRoomService,
    @Inject('IComAutoPlayUseCase')
    private readonly comAutoPlayUseCase: IComAutoPlayUseCase,
    @Inject('ICompleteFieldUseCase')
    private readonly completeFieldUseCase: ICompleteFieldUseCase,
  ) {}

  trigger(roomId: string, handlers: ComAutoPlayRecoveryHandlers): void {
    if (this.activeRooms.has(roomId)) {
      this.pendingReruns.add(roomId);
      return;
    }

    // A paced timer already scheduled here (e.g. the post-round-reset delay that
    // keeps COM from acting before the delayed round-reset broadcasts reach
    // clients) must run to completion; cancelling it lets a reconnect-driven
    // trigger move COM early and desync the table. It drives progress on its own.
    const pending = this.retryTimeouts.get(roomId);
    if (pending && pending.kind !== 'retry') {
      return;
    }

    this.clearRetry(roomId);
    this.activeRooms.add(roomId);
    const generation = this.getRoomGeneration(roomId);

    void (async () => {
      const recoveredInterruptedProgress = await this.resumeInterruptedProgress(
        roomId,
        handlers,
        generation,
      );
      if (
        !recoveredInterruptedProgress &&
        this.isCurrentGeneration(roomId, generation)
      ) {
        this.scheduleInitialAutoPlay(roomId, handlers);
      }
    })()
      .catch((error) =>
        this.handleRecoveryError(
          roomId,
          generation,
          handlers,
          `COM auto-play recovery failed for room ${roomId}`,
          error,
        ),
      )
      .finally(() => {
        this.activeRooms.delete(roomId);
        if (this.pendingReruns.delete(roomId)) {
          this.trigger(roomId, handlers);
        }
      });
  }

  scheduleFieldCompletion(
    trigger: CompleteFieldTrigger,
    handlers: ComAutoPlayRecoveryHandlers,
  ): void {
    if (this.fieldCompletionTimeouts.has(trigger.roomId)) {
      return;
    }

    const generation = this.getRoomGeneration(trigger.roomId);
    const timeout = setTimeout(() => {
      this.fieldCompletionTimeouts.delete(trigger.roomId);
      if (!this.isCurrentGeneration(trigger.roomId, generation)) {
        return;
      }
      void this.completeFieldUseCase
        .execute({ roomId: trigger.roomId, field: trigger.field })
        .then((response) =>
          this.handleFieldCompletionResponse(
            trigger.roomId,
            response,
            handlers,
            generation,
            trigger.initiatingActorId,
          ),
        )
        .catch((error) =>
          this.handleRecoveryError(
            trigger.roomId,
            generation,
            handlers,
            `Error completing field in room ${trigger.roomId}`,
            error,
          ),
        );
    }, trigger.delayMs);

    this.fieldCompletionTimeouts.set(trigger.roomId, timeout);
  }

  clearRoom(roomId: string): void {
    this.roomGenerations.set(roomId, this.getRoomGeneration(roomId) + 1);
    this.clearRetry(roomId);
    const fieldCompletionTimeout = this.fieldCompletionTimeouts.get(roomId);
    if (fieldCompletionTimeout) {
      clearTimeout(fieldCompletionTimeout);
      this.fieldCompletionTimeouts.delete(roomId);
    }
    this.pendingReruns.delete(roomId);
    this.retryAttempts.delete(roomId);
  }

  private async resumeInterruptedProgress(
    roomId: string,
    handlers: ComAutoPlayRecoveryHandlers,
    generation: number,
  ): Promise<boolean> {
    const roomGameState = await this.roomService.getRoomGameState(roomId);
    if (!this.isCurrentGeneration(roomId, generation)) {
      return true;
    }
    const state = roomGameState.getState();
    const currentField = state.playState?.currentField;

    if (
      state.gamePhase === 'play' &&
      currentField?.isComplete &&
      currentField.cards.length === 4
    ) {
      if (!this.fieldCompletionTimeouts.has(roomId)) {
        const response = await this.completeFieldUseCase.execute({
          roomId,
          field: {
            ...currentField,
            cards: [...currentField.cards],
            playedBy: [...(currentField.playedBy ?? [])],
          },
        });
        await this.handleFieldCompletionResponse(
          roomId,
          response,
          handlers,
          generation,
        );
      }
      return true;
    }

    const pendingReveal = state.pendingBrokenHandReveal;
    if (state.gamePhase === 'blow' && pendingReveal) {
      const retryDelay = Math.max(
        100,
        pendingReveal.startedAt +
          BROKEN_HAND_REVEAL_PENDING_TTL_MS -
          Date.now() +
          100,
      );
      this.scheduleContinuation(roomId, handlers, retryDelay);
      return true;
    }

    return false;
  }

  private async runAutoPlayStep(
    roomId: string,
    handlers: ComAutoPlayRecoveryHandlers,
    generation: number,
  ): Promise<void> {
    const result = await this.comAutoPlayUseCase.execute({ roomId });
    if (!this.isCurrentGeneration(roomId, generation)) {
      return;
    }

    if (!result.success) {
      if (await this.stopRecoveryIfRoomMissing(roomId, generation)) {
        return;
      }
      this.logger.error(`COM auto-play failed: ${result.error}`);
      this.scheduleRetry(roomId, handlers);
      return;
    }

    this.retryAttempts.delete(roomId);
    handlers.dispatchEvents(result.events);
    handlers.dispatchEvents(result.delayedEvents);

    if (result.completeFieldTrigger) {
      this.scheduleFieldCompletion(result.completeFieldTrigger, handlers);
      return;
    }

    const maxDelay = this.getMaxEventDelay(result);
    if (maxDelay > 0) {
      this.scheduleContinuation(roomId, handlers, maxDelay + 100);
      return;
    }

    if (result.shouldContinue) {
      this.scheduleContinuation(
        roomId,
        handlers,
        COM_AUTO_PLAY_CONTINUE_DELAY_MS,
      );
    }
  }

  private async handleFieldCompletionResponse(
    roomId: string,
    response: CompleteFieldResponse,
    handlers: ComAutoPlayRecoveryHandlers,
    generation: number,
    initiatingActorId?: string,
  ): Promise<void> {
    if (!this.isCurrentGeneration(roomId, generation)) {
      return;
    }
    await handlers.processFieldCompletion(roomId, response, initiatingActorId);
    if (!this.isCurrentGeneration(roomId, generation)) {
      return;
    }

    if (!response.success) {
      if (await this.stopRecoveryIfRoomMissing(roomId, generation)) {
        return;
      }
      this.scheduleRetry(roomId, handlers);
      return;
    }

    if (response.gameOver) {
      this.retryAttempts.delete(roomId);
      return;
    }

    this.retryAttempts.delete(roomId);
    const maxDelay = this.getMaxEventDelay(response);
    if (maxDelay > 0) {
      this.scheduleContinuation(roomId, handlers, maxDelay + 100);
      return;
    }

    this.trigger(roomId, handlers);
  }

  private getMaxEventDelay(
    response: Pick<
      ComAutoPlayResponse | CompleteFieldResponse,
      'delayedEvents'
    >,
  ): number {
    return (response.delayedEvents ?? []).reduce(
      (maxDelay, event) => Math.max(maxDelay, event.delayMs ?? 0),
      0,
    );
  }

  private scheduleRetry(
    roomId: string,
    handlers: ComAutoPlayRecoveryHandlers,
    delayMs: number = COM_AUTO_PLAY_RETRY_DELAY_MS,
  ): void {
    if (this.retryTimeouts.has(roomId)) {
      return;
    }

    const attempt = (this.retryAttempts.get(roomId) ?? 0) + 1;
    this.retryAttempts.set(roomId, attempt);
    const retryDelay = Math.min(
      delayMs * 2 ** (attempt - 1),
      MAX_COM_AUTO_PLAY_RETRY_DELAY_MS,
    );
    this.scheduleTrigger(roomId, handlers, retryDelay, 'retry');
  }

  private scheduleContinuation(
    roomId: string,
    handlers: ComAutoPlayRecoveryHandlers,
    delayMs: number,
  ): void {
    this.retryAttempts.delete(roomId);
    this.scheduleTrigger(roomId, handlers, delayMs, 'continuation');
  }

  private scheduleInitialAutoPlay(
    roomId: string,
    handlers: ComAutoPlayRecoveryHandlers,
  ): void {
    if (this.retryTimeouts.has(roomId)) {
      return;
    }

    const generation = this.getRoomGeneration(roomId);
    const timeout = setTimeout(() => {
      this.retryTimeouts.delete(roomId);
      if (!this.isCurrentGeneration(roomId, generation)) {
        return;
      }

      void this.runAutoPlayStep(roomId, handlers, generation).catch((error) =>
        this.handleRecoveryError(
          roomId,
          generation,
          handlers,
          `COM auto-play initial step failed for room ${roomId}`,
          error,
        ),
      );
    }, COM_AUTO_PLAY_INITIAL_DELAY_MS);
    this.retryTimeouts.set(roomId, { timeout, kind: 'initial' });
  }

  private scheduleTrigger(
    roomId: string,
    handlers: ComAutoPlayRecoveryHandlers,
    delayMs: number,
    kind: PendingTriggerKind,
  ): void {
    if (this.retryTimeouts.has(roomId)) {
      return;
    }

    const generation = this.getRoomGeneration(roomId);
    const timeout = setTimeout(() => {
      this.retryTimeouts.delete(roomId);
      if (!this.isCurrentGeneration(roomId, generation)) {
        return;
      }
      this.trigger(roomId, handlers);
    }, delayMs);
    this.retryTimeouts.set(roomId, { timeout, kind });
  }

  private clearRetry(roomId: string): void {
    const pending = this.retryTimeouts.get(roomId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.retryTimeouts.delete(roomId);
    }
  }

  private async handleRecoveryError(
    roomId: string,
    generation: number,
    handlers: ComAutoPlayRecoveryHandlers,
    message: string,
    error: unknown,
  ): Promise<void> {
    if (!this.isCurrentGeneration(roomId, generation)) {
      return;
    }
    if (await this.stopRecoveryIfRoomMissing(roomId, generation)) {
      return;
    }

    this.logger.error(
      message,
      error instanceof Error ? error.stack : String(error),
    );
    this.scheduleRetry(roomId, handlers);
  }

  private async stopRecoveryIfRoomMissing(
    roomId: string,
    generation: number,
  ): Promise<boolean> {
    try {
      const room = await this.roomService.getRoom(roomId);
      if (!this.isCurrentGeneration(roomId, generation)) {
        return true;
      }
      if (room) {
        return false;
      }

      this.clearRoom(roomId);
      return true;
    } catch {
      return false;
    }
  }

  private getRoomGeneration(roomId: string): number {
    return this.roomGenerations.get(roomId) ?? 0;
  }

  private isCurrentGeneration(roomId: string, generation: number): boolean {
    return this.getRoomGeneration(roomId) === generation;
  }
}
