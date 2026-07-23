import { Socket } from 'socket.io';
import { GameGateway } from '../game.gateway';

const createGateway = (): GameGateway => {
  const GatewayConstructor = GameGateway as unknown as new (
    ...dependencies: object[]
  ) => GameGateway;
  return new GatewayConstructor(...Array.from({ length: 32 }, () => ({})));
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
  accountActionGateService: { ensureActiveSocketActor: jest.Mock };
  dispatchEvents: jest.Mock;
  startTurnAckMonitor: jest.Mock;
}

interface MutatingActionGatewayHarness {
  activityTracker: { recordActivity: jest.Mock };
  accountActionGateService: { ensureActiveSocketActor: jest.Mock };
  spectatorGatewayEffectsService: {
    rejectAction: jest.Mock;
    isSpectatorSocket?: jest.Mock;
    leaveCurrentRoom?: jest.Mock;
  };
  roomService: {
    getRoom: jest.Mock;
    getRoomGameState?: jest.Mock;
  };
  playCardUseCase: { execute: jest.Mock };
  leaveRoomUseCase: { execute: jest.Mock };
  joinRoomUseCase?: { execute: jest.Mock };
  joinRoomGatewayEffectsService?: {
    buildEffects: jest.Mock;
  };
  roomUpdateGatewayEffectsService: {
    buildPlayersEvent: jest.Mock;
    buildRoomView?: jest.Mock;
  };
  startGameUseCase?: { execute: jest.Mock };
  startGameGatewayEffectsService?: { buildEvents: jest.Mock };
  moderatePlayerUseCase?: { execute: jest.Mock };
  gameplayNotificationService?: { notifyGameStarted: jest.Mock };
  dispatchEvents?: jest.Mock;
  dispatchGameplayEvents?: jest.Mock;
  turnMonitorService?: { isPlayerIdle: jest.Mock };
  server: {
    to: jest.Mock;
  };
  emitRoomsListToAll: jest.Mock;
  queueSpectatorSnapshot: jest.Mock;
  triggerComAutoPlayIfNeeded: jest.Mock;
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
    testGateway.accountActionGateService = {
      ensureActiveSocketActor: jest.fn().mockResolvedValue({ allowed: true }),
    };
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
    testGateway.accountActionGateService = {
      ensureActiveSocketActor: jest.fn().mockResolvedValue({ allowed: true }),
    };
    testGateway.startTurnAckMonitor = jest.fn().mockResolvedValue(undefined);

    const client = {
      id: 'socket-1',
      handshake: { auth: { token: 'token' } },
      data: { user: authenticatedUser },
      join: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
    } as unknown as Socket;

    await gateway.handleSyncGameState(client, { roomId: 'room-1' });

    expect(
      testGateway.reconnectionUseCase.getActiveGameSnapshot,
    ).toHaveBeenCalledWith({
      roomId: 'room-1',
      authenticatedUser,
    });
    expect(testGateway.reconnectionUseCase.execute).not.toHaveBeenCalled();
    expect(client.join).toHaveBeenCalledWith('room-1');
    expect(client.emit).toHaveBeenCalledWith('game-state', gameState);
    expect(client.emit).toHaveBeenCalledWith('reconnect-token', 'player-1');
    expect(testGateway.startTurnAckMonitor).not.toHaveBeenCalled();
  });

  it('rejects mutating game actions for an already-authenticated deleting socket', async () => {
    const gateway = createGateway();
    const testGateway = gateway as unknown as MutatingActionGatewayHarness;

    testGateway.activityTracker = { recordActivity: jest.fn() };
    testGateway.accountActionGateService = {
      ensureActiveSocketActor: jest.fn().mockResolvedValue({
        allowed: false,
        errorMessage: 'Account deletion is in progress',
      }),
    };
    testGateway.spectatorGatewayEffectsService = {
      rejectAction: jest.fn().mockReturnValue(false),
    };
    testGateway.playCardUseCase = {
      execute: jest.fn(),
    };

    const client = {
      id: 'socket-1',
      data: {
        user: {
          id: 'user-1',
          profile: { displayName: 'User' },
        },
      },
      emit: jest.fn(),
    } as unknown as Socket;

    await gateway.handlePlayCard(client, {
      roomId: 'room-1',
      card: 'A_SPADE',
    });

    expect(
      testGateway.accountActionGateService.ensureActiveSocketActor,
    ).toHaveBeenCalledWith(client, 'play a card');
    expect(testGateway.playCardUseCase.execute).not.toHaveBeenCalled();
    expect(client.emit).toHaveBeenCalledWith(
      'error-message',
      'Account deletion is in progress',
    );
    expect(client.emit).toHaveBeenCalledWith(
      'auth-error',
      'Account deletion is in progress',
    );
  });

  it('allows leave-room while account deletion is in progress', async () => {
    const gateway = createGateway();
    const testGateway = gateway as unknown as MutatingActionGatewayHarness;
    const roomEmitter = { emit: jest.fn() };
    const clientEmitter = { emit: jest.fn() };

    testGateway.accountActionGateService = {
      ensureActiveSocketActor: jest.fn().mockResolvedValue({
        allowed: false,
        errorMessage: 'Account deletion is in progress',
      }),
    };
    testGateway.leaveRoomUseCase = {
      execute: jest.fn().mockResolvedValue({
        success: true,
        data: {
          playerId: 'player-1',
          roomDeleted: false,
          roomsList: [],
        },
      }),
    };
    testGateway.roomService = {
      getRoom: jest.fn().mockResolvedValue({
        id: 'room-1',
        players: [
          {
            playerId: 'player-1',
            userId: 'user-1',
            socketId: 'socket-1',
          },
        ],
      }),
    };
    testGateway.server = {
      to: jest.fn((target: string) =>
        target === 'socket-1' ? clientEmitter : roomEmitter,
      ),
    };
    testGateway.emitRoomsListToAll = jest.fn();
    testGateway.queueSpectatorSnapshot = jest.fn();
    testGateway.triggerComAutoPlayIfNeeded = jest.fn();

    const client = {
      id: 'socket-1',
      data: {
        user: {
          id: 'user-1',
        },
      },
      leave: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
    } as unknown as Socket;

    await expect(
      gateway.handleLeaveRoom(client, {
        roomId: 'room-1',
      }),
    ).resolves.toEqual({ success: true });

    expect(
      testGateway.accountActionGateService.ensureActiveSocketActor,
    ).not.toHaveBeenCalled();
    expect(testGateway.leaveRoomUseCase.execute).toHaveBeenCalledWith({
      roomId: 'room-1',
      playerId: 'player-1',
    });
    expect(client.leave).toHaveBeenCalledWith('room-1');
  });

  it('derives join identity from the authenticated socket instead of client payload', async () => {
    const gateway = createGateway();
    const testGateway = gateway as unknown as MutatingActionGatewayHarness;

    testGateway.activityTracker = { recordActivity: jest.fn() };
    testGateway.accountActionGateService = {
      ensureActiveSocketActor: jest.fn().mockResolvedValue({ allowed: true }),
    };
    testGateway.spectatorGatewayEffectsService = {
      rejectAction: jest.fn().mockReturnValue(false),
      leaveCurrentRoom: jest.fn().mockResolvedValue(undefined),
    };
    testGateway.joinRoomUseCase = {
      execute: jest.fn().mockResolvedValue({
        success: true,
        normalizedUser: {
          socketId: 'socket-1',
          playerId: 'user-1',
          userId: 'user-1',
          name: 'User 1',
          isAuthenticated: true,
        },
        data: {
          room: { id: 'room-1', status: 'waiting', players: [] },
          roomStatus: 'waiting',
          roomsList: [],
          isHost: false,
        },
      }),
    };
    testGateway.joinRoomGatewayEffectsService = {
      buildEffects: jest.fn().mockResolvedValue({
        events: [],
        room: { id: 'room-1' },
      }),
    };
    testGateway.roomUpdateGatewayEffectsService = {
      buildPlayersEvent: jest.fn(),
      buildRoomView: jest.fn().mockResolvedValue({ room: { id: 'room-1' } }),
    };
    testGateway.dispatchEvents = jest.fn();

    const client = {
      id: 'socket-1',
      data: {
        user: {
          id: 'user-1',
          email: 'user@example.com',
          profile: { displayName: 'User 1' },
        },
      },
      join: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
    } as unknown as Socket;

    await expect(
      gateway.handleJoinRoom(client, {
        roomId: 'room-1',
        user: {
          socketId: 'attacker-socket',
          playerId: 'victim-player',
          userId: 'victim-user',
          name: 'Victim',
          isAuthenticated: true,
        },
      } as never),
    ).resolves.toEqual({ success: true, room: { id: 'room-1' } });

    const joinRequest = testGateway.joinRoomUseCase.execute.mock
      .calls[0][0] as {
      socketId: string;
      targetRoomId: string;
      authenticatedUser?: { id: string };
      user?: unknown;
    };
    expect(joinRequest.socketId).toBe('socket-1');
    expect(joinRequest.targetRoomId).toBe('room-1');
    expect(joinRequest.authenticatedUser?.id).toBe('user-1');
    expect(joinRequest).not.toHaveProperty('user');
  });

  it('derives start-game actor from the room roster instead of client payload', async () => {
    const gateway = createGateway();
    const testGateway = gateway as unknown as MutatingActionGatewayHarness;

    testGateway.activityTracker = { recordActivity: jest.fn() };
    testGateway.accountActionGateService = {
      ensureActiveSocketActor: jest.fn().mockResolvedValue({ allowed: true }),
    };
    testGateway.spectatorGatewayEffectsService = {
      rejectAction: jest.fn().mockReturnValue(false),
    };
    testGateway.roomService = {
      getRoom: jest.fn().mockResolvedValue({
        id: 'room-1',
        players: [
          { playerId: 'legit-player', userId: 'user-1' },
          { playerId: 'victim-player', userId: 'user-2' },
        ],
      }),
    };
    testGateway.startGameUseCase = {
      execute: jest.fn().mockResolvedValue({
        success: true,
        data: {
          players: [],
          pointsToWin: 5,
          updatePhase: { phase: 'blow' },
          currentTurnPlayerId: 'legit-player',
        },
      }),
    };
    testGateway.startGameGatewayEffectsService = {
      buildEvents: jest.fn().mockResolvedValue([]),
    };
    testGateway.gameplayNotificationService = {
      notifyGameStarted: jest.fn().mockResolvedValue(undefined),
    };
    testGateway.dispatchGameplayEvents = jest.fn();
    testGateway.triggerComAutoPlayIfNeeded = jest.fn();

    const client = {
      id: 'socket-1',
      data: {
        user: {
          id: 'user-1',
        },
      },
      emit: jest.fn(),
    } as unknown as Socket;

    await expect(
      gateway.handleStartGame(client, {
        roomId: 'room-1',
        playerId: 'victim-player',
      } as never),
    ).resolves.toEqual({ success: true });

    expect(testGateway.startGameUseCase.execute).toHaveBeenCalledWith({
      roomId: 'room-1',
      playerId: 'legit-player',
    });
  });

  it('derives moderation requester from the room roster instead of client payload', async () => {
    const gateway = createGateway();
    const testGateway = gateway as unknown as MutatingActionGatewayHarness;

    testGateway.accountActionGateService = {
      ensureActiveSocketActor: jest.fn().mockResolvedValue({ allowed: true }),
    };
    testGateway.spectatorGatewayEffectsService = {
      rejectAction: jest.fn().mockReturnValue(false),
    };
    testGateway.roomService = {
      getRoom: jest.fn().mockResolvedValue({
        id: 'room-1',
        players: [
          { playerId: 'host-player', userId: 'user-1' },
          { playerId: 'target-player', userId: 'user-2' },
        ],
      }),
    };
    testGateway.moderatePlayerUseCase = {
      execute: jest.fn().mockResolvedValue({
        success: true,
        mode: 'remove',
        playerId: 'target-player',
        roomDeleted: true,
        roomsList: [],
      }),
    };
    testGateway.turnMonitorService = {
      isPlayerIdle: jest.fn().mockReturnValue(false),
    };
    testGateway.emitRoomsListToAll = jest.fn();

    const client = {
      id: 'socket-1',
      data: {
        user: {
          id: 'user-1',
        },
      },
      emit: jest.fn(),
    } as unknown as Socket;

    await expect(
      gateway.handleModeratePlayer(client, {
        roomId: 'room-1',
        requesterPlayerId: 'target-player',
        targetPlayerId: 'target-player',
        action: 'remove',
      } as never),
    ).resolves.toEqual({ success: true });

    expect(testGateway.moderatePlayerUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: 'room-1',
        requesterPlayerId: 'host-player',
        targetPlayerId: 'target-player',
      }),
    );
  });
});
