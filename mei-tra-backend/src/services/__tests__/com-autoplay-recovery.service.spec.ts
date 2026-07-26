import { Logger } from '@nestjs/common';
import { IRoomService } from '../interfaces/room-service.interface';
import { IComAutoPlayUseCase } from '../../use-cases/interfaces/com-autoplay-use-case.interface';
import { ICompleteFieldUseCase } from '../../use-cases/interfaces/complete-field.use-case.interface';
import { GatewayEvent } from '../../use-cases/interfaces/gateway-event.interface';
import {
  ComAutoPlayRecoveryHandlers,
  ComAutoPlayRecoveryService,
} from '../com-autoplay-recovery.service';

const flushPromises = async (): Promise<void> => {
  for (let index = 0; index < 10; index += 1) {
    await Promise.resolve();
  }
};

const createService = () => {
  const roomService = {
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
      playedBy: ['p1', 'p2', 'p3', 'com-1'],
      baseCard: 'A♠',
      dealerId: 'p1',
      isComplete: true,
    };
    const state = {
      gamePhase: 'play',
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
        playedBy: [],
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

    await jest.advanceTimersByTimeAsync(2_000);
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

    await jest.advanceTimersByTimeAsync(2_000);
    await flushPromises();

    expect(comAutoPlayUseCase.execute).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(7_000);
    await flushPromises();

    expect(comAutoPlayUseCase.execute).toHaveBeenCalledTimes(2);
    service.clearRoom('room-1');
    loggerError.mockRestore();
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
    await jest.advanceTimersByTimeAsync(2_000);
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
});
