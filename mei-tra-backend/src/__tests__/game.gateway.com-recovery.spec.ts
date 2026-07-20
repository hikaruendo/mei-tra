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
  reconnectionUseCase: {
    execute: jest.Mock;
    getActiveGameSnapshot: jest.Mock;
  };
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
      getActiveGameSnapshot: jest.fn(),
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

  it('returns an authoritative active-game snapshot after the client registers handlers', async () => {
    const gateway = createGateway();
    const testGateway = gateway as unknown as ActiveReconnectGatewayHarness;
    const authenticatedUser = {
      id: 'user-1',
      email: 'user@example.com',
      profile: { displayName: 'User 1' },
    };
    const gameState = {
      players: [],
      gamePhase: 'blow',
      currentTurn: 'player-2',
    };

    testGateway.reconnectionUseCase = {
      execute: jest.fn(),
      getActiveGameSnapshot: jest.fn().mockResolvedValue({
        selfPlayerId: 'user-1',
        reconnectToken: 'player-1',
        currentTurnPlayerId: 'player-2',
        gameState,
      }),
    };
    testGateway.startTurnAckMonitor = jest.fn().mockResolvedValue(undefined);

    const client = {
      id: 'socket-1',
      handshake: { auth: { token: 'token' } },
      data: { user: authenticatedUser },
      emit: jest.fn(),
    } as unknown as Socket;

    await gateway.handleSyncGameState(client, { roomId: 'room-1' });

    expect(testGateway.reconnectionUseCase.getActiveGameSnapshot).toHaveBeenCalledWith({
      roomId: 'room-1',
      authenticatedUser,
    });
    expect(testGateway.reconnectionUseCase.execute).not.toHaveBeenCalled();
    expect(client.emit).toHaveBeenCalledWith('game-state', gameState);
    expect(client.emit).toHaveBeenCalledWith('reconnect-token', 'player-1');
    expect(testGateway.startTurnAckMonitor).toHaveBeenCalledWith(
      'room-1',
      'player-2',
    );
  });
});
