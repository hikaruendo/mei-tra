import type { Socket } from 'socket.io';
import { GameGateway } from '../game.gateway';
import { RoomGameActionQueueService } from '../services/room-game-action-queue.service';
import { asSeatId } from '../types/identity.types';

type Harness = {
  handleDeclareOpen: GameGateway['handleDeclareOpen'];
  declareOpenUseCase: { execute: jest.Mock };
  processGameOverUseCase: { execute: jest.Mock };
  spectatorGatewayEffectsService: { rejectAction: jest.Mock };
  accountActionGateService: { ensureActiveSocketActor: jest.Mock };
  roomGameActionQueueService: RoomGameActionQueueService;
  dispatchGameplayEvents: jest.Mock;
  triggerComAutoPlayAfterEvents: jest.Mock;
  closeFinishedRoom: jest.Mock;
};

function createGateway(): Harness {
  const GatewayConstructor = GameGateway as unknown as new (
    ...dependencies: object[]
  ) => GameGateway;
  const gateway = new GatewayConstructor(
    ...Array.from({ length: 31 }, () => ({})),
  ) as unknown as Harness;
  gateway.declareOpenUseCase = { execute: jest.fn() };
  gateway.processGameOverUseCase = {
    execute: jest.fn().mockResolvedValue(undefined),
  };
  gateway.spectatorGatewayEffectsService = {
    rejectAction: jest.fn(() => false),
  };
  gateway.accountActionGateService = {
    ensureActiveSocketActor: jest.fn().mockResolvedValue({ allowed: true }),
  };
  gateway.roomGameActionQueueService = new RoomGameActionQueueService();
  gateway.dispatchGameplayEvents = jest.fn();
  gateway.triggerComAutoPlayAfterEvents = jest.fn();
  gateway.closeFinishedRoom = jest.fn().mockResolvedValue(undefined);
  return gateway;
}

function client() {
  return {
    id: 'socket-1',
    data: { user: { id: 'user-1' } },
    emit: jest.fn(),
  } as unknown as Socket & { emit: jest.Mock };
}

const openEvents = [
  {
    scope: 'room' as const,
    roomId: 'room-1',
    event: 'open-declared',
    payload: { declarerSeatId: asSeatId('seat-1'), hand: ['A♠'], valid: true },
  },
  {
    scope: 'room' as const,
    roomId: 'room-1',
    event: 'round-results',
    payload: { scores: {} },
  },
];

describe('GameGateway open behavior', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('broadcasts a valid open and paces COM behind the next round it deals', async () => {
    const gateway = createGateway();
    const delayedEvents = [
      {
        scope: 'room' as const,
        roomId: 'room-1',
        event: 'new-round-started',
        payload: {},
        delayMs: 3000,
      },
    ];
    gateway.declareOpenUseCase.execute.mockResolvedValue({
      success: true,
      events: openEvents,
      delayedEvents,
    });

    await gateway.handleDeclareOpen(client(), { roomId: 'room-1' });

    expect(gateway.dispatchGameplayEvents).toHaveBeenNthCalledWith(
      1,
      openEvents,
    );
    expect(gateway.dispatchGameplayEvents).toHaveBeenNthCalledWith(
      2,
      delayedEvents,
    );
    expect(gateway.triggerComAutoPlayAfterEvents).toHaveBeenCalledWith(
      'room-1',
      delayedEvents,
    );
    expect(gateway.processGameOverUseCase.execute).not.toHaveBeenCalled();
  });

  it('finishes the game through the game-over flow when a valid open reaches the goal', async () => {
    jest.useFakeTimers({
      doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'],
    });
    const gateway = createGateway();
    const gameOver = {
      winningTeam: 0,
      teamScores: { 0: { play: 17, total: 17 }, 1: { play: 0, total: 0 } },
      resetDelayMs: 5000,
    };
    gateway.declareOpenUseCase.execute.mockResolvedValue({
      success: true,
      events: openEvents,
      gameOver,
    });

    await gateway.handleDeclareOpen(client(), { roomId: 'room-1' });

    expect(gateway.dispatchGameplayEvents).toHaveBeenCalledWith(openEvents);
    expect(gateway.processGameOverUseCase.execute).toHaveBeenCalledWith({
      roomId: 'room-1',
      ...gameOver,
    });
    expect(gateway.triggerComAutoPlayAfterEvents).not.toHaveBeenCalled();
    jest.advanceTimersByTime(gameOver.resetDelayMs);
    expect(gateway.closeFinishedRoom).toHaveBeenCalledWith('room-1');
  });
});
