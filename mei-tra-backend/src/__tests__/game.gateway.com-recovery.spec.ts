import { Socket } from 'socket.io';
import { GameGateway } from '../game.gateway';

const createGateway = (): GameGateway => {
  const GatewayConstructor = GameGateway as unknown as new (
    ...dependencies: object[]
  ) => GameGateway;
  return new GatewayConstructor(...Array.from({ length: 31 }, () => ({})));
};

interface ActiveReconnectGatewayHarness {
  activityTracker: { incrementConnections: jest.Mock };
  authService: { getUserFromSocketToken: jest.Mock };
  reconnectionUseCase: { execute: jest.Mock };
  joinRoomGatewayEffectsService: {
    buildActiveReconnectEvents: jest.Mock;
  };
  comAutoPlayRecoveryService: { trigger: jest.Mock };
  dispatchEvents: jest.Mock;
  startTurnAckMonitor: jest.Mock;
}

describe('GameGateway COM recovery integration', () => {
  it('delegates COM recovery after an active-game reconnection', async () => {
    const gateway = createGateway();
    const testGateway = gateway as unknown as ActiveReconnectGatewayHarness;
    const startTurnAckMonitor = jest.fn().mockResolvedValue(undefined);
    const triggerRecovery = jest.fn();
    const authenticatedUser = {
      id: 'user-1',
      email: 'user@example.com',
      profile: { displayName: 'User 1' },
    };

    testGateway.activityTracker = {
      incrementConnections: jest.fn(),
    };
    testGateway.authService = {
      getUserFromSocketToken: jest.fn().mockResolvedValue(authenticatedUser),
    };
    testGateway.reconnectionUseCase = {
      execute: jest.fn().mockResolvedValue({
        success: true,
        mode: 'active-game',
        roomId: 'room-1',
        roomsList: [],
        room: { id: 'room-1', players: [] },
        selfPlayerId: 'user-1',
        reconnectToken: 'user-1',
        currentTurnPlayerId: 'com-1',
        gameState: { players: [], gamePhase: 'play' },
      }),
    };
    testGateway.joinRoomGatewayEffectsService = {
      buildActiveReconnectEvents: jest.fn().mockResolvedValue([]),
    };
    testGateway.comAutoPlayRecoveryService = { trigger: triggerRecovery };
    testGateway.dispatchEvents = jest.fn();
    testGateway.startTurnAckMonitor = startTurnAckMonitor;

    const client = {
      id: 'socket-1',
      handshake: { auth: { token: 'token', roomId: 'room-1' } },
      data: {},
      join: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
      disconnect: jest.fn(),
    } as unknown as Socket;

    await gateway.handleConnection(client);

    expect(startTurnAckMonitor).toHaveBeenCalledWith('room-1', 'com-1');
    expect(triggerRecovery).toHaveBeenCalledWith('room-1', expect.anything());
  });
});
