import type { Socket } from 'socket.io';
import { GameGateway } from '../game.gateway';
import { RoomGameActionQueueService } from '../services/room-game-action-queue.service';
import { asSeatId } from '../types/identity.types';

type Harness = {
  handleDeclareOpen: GameGateway['handleDeclareOpen'];
  handleRevealChomboHand: GameGateway['handleRevealChomboHand'];
  declareOpenUseCase: { execute: jest.Mock };
  revealChomboHandUseCase: { execute: jest.Mock };
  spectatorGatewayEffectsService: { rejectAction: jest.Mock };
  accountActionGateService: { ensureActiveSocketActor: jest.Mock };
  roomGameActionQueueService: RoomGameActionQueueService;
  dispatchGameplayEvents: jest.Mock;
};

function createGateway(): Harness {
  const GatewayConstructor = GameGateway as unknown as new (...dependencies: object[]) => GameGateway;
  const gateway = new GatewayConstructor(...Array.from({ length: 31 }, () => ({}))) as unknown as Harness;
  gateway.declareOpenUseCase = { execute: jest.fn() };
  gateway.revealChomboHandUseCase = { execute: jest.fn() };
  gateway.spectatorGatewayEffectsService = { rejectAction: jest.fn(() => false) };
  gateway.accountActionGateService = { ensureActiveSocketActor: jest.fn().mockResolvedValue({ allowed: true }) };
  gateway.roomGameActionQueueService = new RoomGameActionQueueService();
  gateway.dispatchGameplayEvents = jest.fn();
  return gateway;
}

function client() {
  return { id: 'socket-1', data: { user: { id: 'user-1' } }, emit: jest.fn() } as unknown as Socket & { emit: jest.Mock };
}

describe('GameGateway open and chombo reveal behavior', () => {
  it('broadcasts a valid open event and settlement to the room', async () => {
    const gateway = createGateway();
    const events = [
      { scope: 'room' as const, roomId: 'room-1', event: 'open-declared', payload: { declarerSeatId: asSeatId('seat-1'), hand: ['A♠'], valid: true } },
      { scope: 'room' as const, roomId: 'room-1', event: 'round-results', payload: { scores: {} } },
    ];
    gateway.declareOpenUseCase.execute.mockResolvedValue({ success: true, events });

    await gateway.handleDeclareOpen(client(), { roomId: 'room-1' });

    expect(gateway.dispatchGameplayEvents).toHaveBeenCalledWith(events);
  });

  it('returns a rejection to the requesting client when reveal is refused or expired', async () => {
    const gateway = createGateway();
    gateway.revealChomboHandUseCase.execute.mockResolvedValue({ success: false, error: 'No chombo check requires this hand' });
    const socket = client();

    await gateway.handleRevealChomboHand(socket, { roomId: 'room-1', seatId: asSeatId('seat-1') });

    expect(socket.emit).toHaveBeenCalledWith('error-message', 'No chombo check requires this hand');
    expect(gateway.dispatchGameplayEvents).not.toHaveBeenCalled();
  });
});
