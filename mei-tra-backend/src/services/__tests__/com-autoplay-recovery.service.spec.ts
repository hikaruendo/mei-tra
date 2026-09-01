import { asSeatId } from '../../types/identity.types';
import { Logger } from '@nestjs/common';
import { IRoomService } from '../interfaces/room-service.interface';
import { IComAutoPlayUseCase } from '../../use-cases/interfaces/com-autoplay-use-case.interface';
import { ICompleteFieldUseCase } from '../../use-cases/interfaces/complete-field.use-case.interface';
import { GatewayEvent } from '../../use-cases/interfaces/gateway-event.interface';
import {
  ComAutoPlayRecoveryHandlers,
  ComAutoPlayRecoveryService,
} from '../com-autoplay-recovery.service';
import { RoomGameActionQueueService } from '../room-game-action-queue.service';

const flushPromises = async (): Promise<void> => {
  for (let index = 0; index < 10; index += 1) {
    await Promise.resolve();
  }
};

const createService = () => {
  const roomService = {
    getRoom: jest.fn().mockResolvedValue({ id: 'room-1' }),
    getRoomGameState: jest.fn(),
  };
  const comAutoPlayUseCase = {
    execute: jest.fn(),
  };
  const completeFieldUseCase = {
    execute: jest.fn(),
  };
  const handlers: ComAutoPlayRecoveryHandlers = {
    dispatchEvents: jest.fn(),
    processFieldCompletion: jest.fn().mockResolvedValue(undefined),
  };
  const service = new ComAutoPlayRecoveryService(
    roomService as unknown as IRoomService,
    comAutoPlayUseCase as IComAutoPlayUseCase,
    completeFieldUseCase as ICompleteFieldUseCase,
    new RoomGameActionQueueService(),
  );

  return {
    service,
    roomService,
    comAutoPlayUseCase,
    completeFieldUseCase,
    handlers,
  };
};

describe('ComAutoPlayRecoveryService', () => {
  it('stops recovery when the room no longer exists', async () => {
    jest.useFakeTimers();
    const { service, roomService, comAutoPlayUseCase, handlers } =
      createService();

    roomService.getRoom.mockResolvedValue(null);
    roomService.getRoomGameState.mockRejectedValue(
      new Error('Room not found: room-1'),
    );

    service.trigger('room-1', handlers);
    await flushPromises();
    await jest.runOnlyPendingTimersAsync();

    expect(roomService.getRoomGameState).toHaveBeenCalledTimes(1);
    expect(comAutoPlayUseCase.execute).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
    jest.useRealTimers();
  });

  it('stops a delayed auto-play retry when the room is deleted', async () => {
    jest.useFakeTimers();
    const { service, roomService, comAutoPlayUseCase, handlers } =
      createService();

    roomService.getRoomGameState.mockResolvedValue({
      getState: () => ({
        gamePhase: 'play',
        playState: { currentField: null },
        pendingBrokenHandReveal: null,
      }),
    });
    comAutoPlayUseCase.execute.mockRejectedValue(
      new Error('Room not found: room-1'),
    );

    service.trigger('room-1', handlers);
    await flushPromises();
    roomService.getRoom.mockResolvedValue(null);
    await jest.advanceTimersByTimeAsync(1_499);
    await flushPromises();
    expect(comAutoPlayUseCase.execute).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);
    await flushPromises();

    expect(comAutoPlayUseCase.execute).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
    jest.useRealTimers();
  });

  it('completes a persisted full field when its timer was lost', async () => {
    jest.useFakeTimers();
    const {
      service,
      roomService,
      comAutoPlayUseCase,
      completeFieldUseCase,
      handlers,
    } = createService();
    const field = {
      cards: ['A♠', 'K♠', 'Q♠', 'J♠'],
      playedBySeatIds: ['p1', 'p2', 'p3', 'com-1'].map(asSeatId),
      baseCard: 'A♠',
      dealerSeatId: asSeatId('p1'),
      isComplete: true,
    };
    const state = {
      gamePhase: 'play',
      players: ['p1', 'p2', 'p3', 'com-1'].map((seatId) => ({
        seatId: asSeatId(seatId),
      })),
      playState: { currentField: field },
      pendingBrokenHandReveal: null,
    };
    const completionResponse = { success: true, events: [] };

    roomService.getRoomGameState.mockResolvedValue({
      getState: () => state,
    });
    completeFieldUseCase.execute.mockImplementation(() => {
      state.playState.currentField = {
        ...field,
        cards: [],
        playedBySeatIds: [],
        baseCard: '',
        isComplete: false,
      };
      return Promise.resolve(completionResponse);
    });
    comAutoPlayUseCase.execute.mockResolvedValue({
      success: true,
      events: [],
      shouldContinue: false,
    });

    service.trigger('room-1', handlers);
    await flushPromises();

    expect(completeFieldUseCase.execute).toHaveBeenCalledWith({
      roomId: 'room-1',
      field,
    });
    expect(handlers.processFieldCompletion).toHaveBeenCalledWith(
      'room-1',
      completionResponse,
      undefined,
    );
    expect(comAutoPlayUseCase.execute).not.toHaveBeenCalled();

    await jest.runOnlyPendingTimersAsync();
    await flushPromises();

    expect(comAutoPlayUseCase.execute).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('serializes duplicate recovery triggers before the delayed step', async () => {
    jest.useFakeTimers();
    const { service, roomService, comAutoPlayUseCase, handlers } =
      createService();

    roomService.getRoomGameState.mockResolvedValue({
      getState: () => ({
        gamePhase: 'play',
        playState: { currentField: null },
        pendingBrokenHandReveal: null,
      }),
    });
    comAutoPlayUseCase.execute.mockResolvedValue({
      success: true,
      events: [],
      shouldContinue: false,
    });

    service.trigger('room-1', handlers);
    service.trigger('room-1', handlers);
    await flushPromises();

    expect(comAutoPlayUseCase.execute).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1_499);
    await flushPromises();
    expect(comAutoPlayUseCase.execute).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);
    await flushPromises();

    expect(comAutoPlayUseCase.execute).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('retries COM auto-play after a transient failure', async () => {
    jest.useFakeTimers();
    const loggerError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation();
    const { service, roomService, comAutoPlayUseCase, handlers } =
      createService();

    roomService.getRoomGameState.mockResolvedValue({
      getState: () => ({
        gamePhase: 'play',
        playState: { currentField: null },
        pendingBrokenHandReveal: null,
      }),
    });
    comAutoPlayUseCase.execute
      .mockResolvedValueOnce({
        success: false,
        events: [],
        shouldContinue: false,
        error: 'temporary persistence error',
      })
      .mockResolvedValueOnce({
        success: true,
        events: [],
        shouldContinue: false,
      });

    service.trigger('room-1', handlers);
    await flushPromises();

    expect(comAutoPlayUseCase.execute).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1_500);
    await flushPromises();

    expect(comAutoPlayUseCase.execute).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(4_999);
    await flushPromises();
    expect(comAutoPlayUseCase.execute).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1);
    await flushPromises();

    expect(comAutoPlayUseCase.execute).toHaveBeenCalledTimes(2);
    service.clearRoom('room-1');
    loggerError.mockRestore();
    jest.useRealTimers();
  });

  it('uses only one 1.5 second delay between consecutive COM moves', async () => {
    jest.useFakeTimers();
    const { service, roomService, comAutoPlayUseCase, handlers } =
      createService();

    roomService.getRoomGameState.mockResolvedValue({
      getState: () => ({
        gamePhase: 'play',
        playState: { currentField: null },
        pendingBrokenHandReveal: null,
      }),
    });
    comAutoPlayUseCase.execute
      .mockResolvedValueOnce({
        success: true,
        events: [],
        shouldContinue: true,
      })
      .mockResolvedValueOnce({
        success: true,
        events: [],
        shouldContinue: false,
      });

    service.trigger('room-1', handlers);
    await flushPromises();
    await jest.advanceTimersByTimeAsync(1_500);
    await flushPromises();
    expect(comAutoPlayUseCase.execute).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1_499);
    await flushPromises();
    expect(comAutoPlayUseCase.execute).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1);
    await flushPromises();
    expect(comAutoPlayUseCase.execute).toHaveBeenCalledTimes(2);

    service.clearRoom('room-1');
    jest.useRealTimers();
  });

  it('does not add a think delay after the field reveal delay', async () => {
    jest.useFakeTimers();
    const {
      service,
      roomService,
      comAutoPlayUseCase,
      completeFieldUseCase,
      handlers,
    } = createService();
    const field = {
      cards: ['A♠', 'K♠', 'Q♠', 'J♠'],
      playedBySeatIds: ['p1', 'p2', 'p3', 'com-1'].map(asSeatId),
      baseCard: 'A♠',
      dealerSeatId: asSeatId('p1'),
      isComplete: true,
    };

    roomService.getRoomGameState.mockResolvedValue({
      getState: () => ({
        gamePhase: 'play',
        playState: { currentField: null },
        pendingBrokenHandReveal: null,
      }),
    });
    completeFieldUseCase.execute.mockResolvedValue({
      success: true,
      events: [],
    });
    comAutoPlayUseCase.execute.mockResolvedValue({
      success: true,
      events: [],
      shouldContinue: false,
    });

    service.scheduleFieldCompletion(
      { roomId: 'room-1', delayMs: 3_000, field },
      handlers,
    );

    await jest.advanceTimersByTimeAsync(2_999);
    await flushPromises();
    expect(completeFieldUseCase.execute).not.toHaveBeenCalled();
    expect(comAutoPlayUseCase.execute).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);
    await flushPromises();
    expect(completeFieldUseCase.execute).toHaveBeenCalledTimes(1);
    expect(comAutoPlayUseCase.execute).toHaveBeenCalledTimes(1);

    service.clearRoom('room-1');
    jest.useRealTimers();
  });

  it('cancels scheduled continuation when the room is cleared', async () => {
    jest.useFakeTimers();
    const { service, roomService, comAutoPlayUseCase, handlers } =
      createService();

    roomService.getRoomGameState.mockResolvedValue({
      getState: () => ({
        gamePhase: 'play',
        playState: { currentField: null },
        pendingBrokenHandReveal: null,
      }),
    });
    comAutoPlayUseCase.execute.mockResolvedValue({
      success: true,
      events: [],
      shouldContinue: true,
    });

    service.trigger('room-1', handlers);
    await flushPromises();

    expect(comAutoPlayUseCase.execute).not.toHaveBeenCalled();
    service.clearRoom('room-1');
    await jest.advanceTimersByTimeAsync(2_000);

    expect(comAutoPlayUseCase.execute).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('keeps a paced continuation when a reconnect re-triggers recovery', async () => {
    jest.useFakeTimers();
    const { service, roomService, comAutoPlayUseCase, handlers } =
      createService();

    roomService.getRoomGameState.mockResolvedValue({
      getState: () => ({
        gamePhase: 'play',
        playState: { currentField: null },
        pendingBrokenHandReveal: null,
      }),
    });
    comAutoPlayUseCase.execute
      .mockResolvedValueOnce({
        success: true,
        events: [],
        delayedEvents: [
          {
            scope: 'room',
            roomId: 'room-1',
            event: 'new-round-started',
            payload: {},
            delayMs: 3_000,
          },
        ],
        shouldContinue: false,
      })
      .mockResolvedValue({
        success: true,
        events: [],
        shouldContinue: false,
      });

    service.trigger('room-1', handlers);
    await flushPromises();
    await jest.advanceTimersByTimeAsync(1_500);
    await flushPromises();

    // Round transition scheduled a 3100ms continuation so COM cannot act before
    // the delayed round-reset broadcasts reach clients.
    expect(comAutoPlayUseCase.execute).toHaveBeenCalledTimes(1);

    // A host reconnect re-triggers recovery mid-transition.
    service.trigger('room-1', handlers);
    await flushPromises();
    await jest.advanceTimersByTimeAsync(3_099);
    await flushPromises();

    // The reconnect must not have replaced the pacing delay with a shorter one.
    expect(comAutoPlayUseCase.execute).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1);
    await flushPromises();

    expect(comAutoPlayUseCase.execute).toHaveBeenCalledTimes(2);
    service.clearRoom('room-1');
    jest.useRealTimers();
  });

  it('lets a reconnect cancel a failure backoff instead of waiting it out', async () => {
    jest.useFakeTimers();
    const loggerError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation();
    const { service, roomService, comAutoPlayUseCase, handlers } =
      createService();

    roomService.getRoomGameState.mockResolvedValue({
      getState: () => ({
        gamePhase: 'play',
        playState: { currentField: null },
        pendingBrokenHandReveal: null,
      }),
    });
    comAutoPlayUseCase.execute
      .mockResolvedValueOnce({
        success: false,
        events: [],
        shouldContinue: false,
        error: 'temporary persistence error',
      })
      .mockResolvedValue({
        success: true,
        events: [],
        shouldContinue: false,
      });

    service.trigger('room-1', handlers);
    await flushPromises();
    await jest.advanceTimersByTimeAsync(1_500);
    await flushPromises();

    // Failure scheduled a 5000ms backoff.
    expect(comAutoPlayUseCase.execute).toHaveBeenCalledTimes(1);

    service.trigger('room-1', handlers);
    await flushPromises();
    await jest.advanceTimersByTimeAsync(1_500);
    await flushPromises();

    // Reconnect supersedes the backoff and recovers on the shorter initial delay.
    expect(comAutoPlayUseCase.execute).toHaveBeenCalledTimes(2);
    service.clearRoom('room-1');
    loggerError.mockRestore();
    jest.useRealTimers();
  });

  it('suppresses events from an in-flight run after the room is cleared', async () => {
    jest.useFakeTimers();
    const { service, roomService, comAutoPlayUseCase, handlers } =
      createService();
    let finishRun:
      | ((value: {
          success: boolean;
          events: GatewayEvent[];
          shouldContinue: boolean;
        }) => void)
      | undefined;
    const pendingRun = new Promise<{
      success: boolean;
      events: GatewayEvent[];
      shouldContinue: boolean;
    }>((resolve) => {
      finishRun = resolve;
    });

    roomService.getRoomGameState.mockResolvedValue({
      getState: () => ({
        gamePhase: 'play',
        playState: { currentField: null },
        pendingBrokenHandReveal: null,
      }),
    });
    comAutoPlayUseCase.execute.mockReturnValue(pendingRun);

    service.trigger('room-1', handlers);
    await flushPromises();
    await jest.advanceTimersByTimeAsync(1_500);
    await flushPromises();
    service.clearRoom('room-1');
    finishRun?.({
      success: true,
      events: [
        {
          scope: 'room',
          roomId: 'room-1',
          event: 'update-turn',
          payload: 'com-1',
        },
      ],
      shouldContinue: false,
    });
    await flushPromises();

    expect(handlers.dispatchEvents).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('holds the first COM move until the start reveal delay elapses', async () => {
    jest.useFakeTimers();
    const { service, roomService, comAutoPlayUseCase, handlers } =
      createService();

    roomService.getRoomGameState.mockResolvedValue({
      getState: () => ({
        gamePhase: 'blow',
        playState: { currentField: null },
        pendingBrokenHandReveal: null,
      }),
    });
    comAutoPlayUseCase.execute.mockResolvedValue({
      success: true,
      events: [],
      shouldContinue: false,
    });

    service.triggerAfterDelay('room-1', handlers, 4_600);
    await flushPromises();

    // The COM seat must stay silent while clients play the reveal.
    await jest.advanceTimersByTimeAsync(4_000);
    await flushPromises();
    expect(comAutoPlayUseCase.execute).not.toHaveBeenCalled();

    // A reconnect mid-reveal must not pull the move forward.
    service.trigger('room-1', handlers);
    await flushPromises();
    expect(comAutoPlayUseCase.execute).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(599);
    await flushPromises();
    expect(comAutoPlayUseCase.execute).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);
    await flushPromises();
    expect(comAutoPlayUseCase.execute).toHaveBeenCalledTimes(1);

    service.clearRoom('room-1');
    jest.useRealTimers();
  });

  it('supersedes a stale timer from the previous game on a quick rematch', async () => {
    jest.useFakeTimers();
    const { service, roomService, comAutoPlayUseCase, handlers } =
      createService();

    roomService.getRoomGameState.mockResolvedValue({
      getState: () => ({
        gamePhase: 'blow',
        playState: { currentField: null },
        pendingBrokenHandReveal: null,
      }),
    });
    comAutoPlayUseCase.execute.mockResolvedValue({
      success: true,
      events: [],
      shouldContinue: false,
    });

    // Leftover pacing from the previous game's final move.
    service.triggerAfterDelay('room-1', handlers, 1_000);
    // The rematch starts before it fires and must reset the baseline.
    service.triggerAfterDelay('room-1', handlers, 4_600);
    await flushPromises();

    await jest.advanceTimersByTimeAsync(4_000);
    await flushPromises();
    expect(comAutoPlayUseCase.execute).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(599);
    await flushPromises();
    expect(comAutoPlayUseCase.execute).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);
    await flushPromises();
    expect(comAutoPlayUseCase.execute).toHaveBeenCalledTimes(1);

    service.clearRoom('room-1');
    jest.useRealTimers();
  });

  it('uses the regular think delay when no reveal delay is requested', async () => {
    jest.useFakeTimers();
    const { service, roomService, comAutoPlayUseCase, handlers } =
      createService();

    roomService.getRoomGameState.mockResolvedValue({
      getState: () => ({
        gamePhase: 'blow',
        playState: { currentField: null },
        pendingBrokenHandReveal: null,
      }),
    });
    comAutoPlayUseCase.execute.mockResolvedValue({
      success: true,
      events: [],
      shouldContinue: false,
    });

    service.triggerAfterDelay('room-1', handlers, 0);
    await flushPromises();
    await jest.advanceTimersByTimeAsync(1_499);
    await flushPromises();
    expect(comAutoPlayUseCase.execute).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);
    await flushPromises();

    expect(comAutoPlayUseCase.execute).toHaveBeenCalledTimes(1);
    service.clearRoom('room-1');
    jest.useRealTimers();
  });
});
