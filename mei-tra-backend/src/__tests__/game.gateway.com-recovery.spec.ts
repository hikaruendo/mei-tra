import { Socket } from 'socket.io';
import { GameGateway } from '../game.gateway';

const createGateway = (): GameGateway => {
  const GatewayConstructor = GameGateway as unknown as new (
    ...dependencies: object[]
  ) => GameGateway;
  const connectionGatewayEffectsService = {
    findExistingControllerSocketId: jest.fn(),
    sendBackToLobby: jest.fn(),
    sendRoomPlayersBackToLobby: jest.fn(),
    sendSocketBackToLobby: jest.fn(),
    sendUserSocketsBackToLobby: jest.fn(),
  };
  const gameplayNotificationService = {
    notifyGameStarted: jest.fn(),
    notifyTurnChanged: jest.fn(),
  };
  const accountActionGateService = {
    ensureActiveSocketActor: jest.fn().mockResolvedValue({ allowed: true }),
  };
  return new GatewayConstructor(
    ...Array.from({ length: 31 }, () => ({})),
    connectionGatewayEffectsService,
    gameplayNotificationService,
    accountActionGateService,
  );
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
  connectionGatewayEffectsService: {
    findExistingControllerSocketId: jest.Mock;
    sendSocketBackToLobby: jest.Mock;
  };
  comAutoPlayRecoveryService: { trigger: jest.Mock };
  dispatchEvents: jest.Mock;
  startTurnAckMonitor: jest.Mock;
  roomService: {
    getRoom: jest.Mock;
    getRoomGameState: jest.Mock;
  };
  playerRooms: Map<string, string>;
  server: {
    sockets: { sockets: Map<string, Socket> };
  };
}

describe('GameGateway COM recovery integration', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('retries COM progress after a turn acknowledgement', async () => {
    const gateway = createGateway();
    const testGateway = gateway as unknown as {
      spectatorGatewayEffectsService: { isSpectatorSocket: jest.Mock };
      turnMonitorService: { acknowledge: jest.Mock };
      comAutoPlayRecoveryService: { trigger: jest.Mock };
    };
    const acknowledge = jest.fn().mockResolvedValue(undefined);
    const trigger = jest.fn();

    testGateway.spectatorGatewayEffectsService = {
      isSpectatorSocket: jest.fn().mockReturnValue(false),
    };
    testGateway.turnMonitorService = { acknowledge };
    testGateway.comAutoPlayRecoveryService = { trigger };

    const client = {
      id: 'socket-1',
      data: { user: { id: 'user-1' } },
    } as unknown as Socket;

    await gateway.handleTurnAck(client, { roomId: 'room-1' });

    expect(acknowledge).toHaveBeenCalledWith('room-1', 'socket-1', 'user-1');
    expect(trigger).toHaveBeenCalledWith('room-1', expect.anything());
  });

  it('delegates COM recovery after an active-game reconnection', async () => {
    const gateway = createGateway();
    const testGateway = gateway as unknown as ActiveReconnectGatewayHarness;
    const startTurnAckMonitor = jest.fn().mockResolvedValue(undefined);
    const triggerRecovery = jest.fn();
    const previousSocket = {
      id: 'socket-old',
      data: {
        user: {
          id: 'user-1',
          email: 'user@example.com',
          profile: { displayName: 'User 1' },
        },
      },
      leave: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
    } as unknown as Socket;
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
        selfSeatId: 'user-1',
        reconnectToken: 'user-1',
        currentTurnSeatId: 'com-1',
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
    testGateway.connectionGatewayEffectsService = {
      findExistingControllerSocketId: jest.fn().mockResolvedValue('socket-old'),
      sendSocketBackToLobby: jest.fn(
        async ({
          server,
          playerRooms,
          socketId,
          roomId,
        }: {
          server: { sockets: { sockets: Map<string, Socket> } };
          playerRooms: Map<string, string>;
          socketId: string;
          roomId: string;
        }) => {
          playerRooms.delete(socketId);
          const socket = server.sockets.sockets.get(socketId);
          if (socket) {
            await socket.leave(roomId);
            socket.emit('back-to-lobby');
          }
        },
      ),
    };
    testGateway.playerRooms = new Map([['socket-old', 'room-1']]);
    testGateway.server = {
      sockets: { sockets: new Map([['socket-old', previousSocket]]) },
    };

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
    expect(previousSocket.leave).toHaveBeenCalledWith('room-1');
    expect(previousSocket.emit).toHaveBeenCalledWith('back-to-lobby');
    expect(testGateway.playerRooms.has('socket-old')).toBe(false);
  });

  it('delegates COM recovery after disconnect timeout converts the current player to COM', async () => {
    jest.useFakeTimers();

    const gateway = createGateway();
    const testGateway = gateway as unknown as {
      activityTracker: { decrementConnections: jest.Mock };
      spectatorGatewayEffectsService: { handleDisconnect: jest.Mock };
      disconnectGatewayEffectsService: {
        prepareDisconnect: jest.Mock;
        buildTimeoutEvents: jest.Mock;
      };
      turnMonitorService: { isMonitoringPlayer: jest.Mock };
      clearTurnAckMonitor: jest.Mock;
      dispatchEvents: jest.Mock;
      comAutoPlayRecoveryService: { trigger: jest.Mock };
      playerRooms: Map<string, string>;
    };
    const triggerRecovery = jest.fn();
    const roomGameState = {
      setDisconnectTimeout: jest.fn(),
    };

    testGateway.activityTracker = { decrementConnections: jest.fn() };
    testGateway.spectatorGatewayEffectsService = {
      handleDisconnect: jest.fn().mockResolvedValue(false),
    };
    testGateway.disconnectGatewayEffectsService = {
      prepareDisconnect: jest.fn().mockResolvedValue({
        playerId: 'player-1',
        playerName: 'Player 1',
        roomGameState,
        timeoutMode: 'convert-to-com',
        membership: null,
        events: [],
      }),
      buildTimeoutEvents: jest.fn().mockResolvedValue([
        {
          scope: 'room',
          roomId: 'room-1',
          event: 'player-converted-to-com',
          payload: { playerId: 'player-1' },
        },
      ]),
    };
    testGateway.turnMonitorService = {
      isMonitoringPlayer: jest.fn().mockReturnValue(false),
    };
    testGateway.clearTurnAckMonitor = jest.fn();
    testGateway.dispatchEvents = jest.fn();
    testGateway.comAutoPlayRecoveryService = { trigger: triggerRecovery };
    testGateway.playerRooms = new Map([['socket-1', 'room-1']]);

    const client = {
      id: 'socket-1',
      data: { user: { profile: { displayName: 'Player 1' } } },
      leave: jest.fn().mockResolvedValue(undefined),
    } as unknown as Socket;

    await gateway.handleDisconnect(client);
    await jest.advanceTimersByTimeAsync(2 * 60 * 1000);

    expect(
      testGateway.disconnectGatewayEffectsService.buildTimeoutEvents,
    ).toHaveBeenCalledWith({
      roomId: 'room-1',
      playerId: 'player-1',
      playerName: 'Player 1',
      timeoutMode: 'convert-to-com',
      membership: null,
    });
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
        selfSeatId: 'user-1',
        reconnectToken: 'player-1',
        currentTurnSeatId: 'player-2',
        gameState,
      }),
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

  it('returns every player tab to the lobby when the room is deleted', async () => {
    const gateway = createGateway();
    const socketOne = {
      id: 'socket-1',
      data: { user: { id: 'user-1' } },
      leave: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
    } as unknown as Socket;
    const socketTwo = {
      id: 'socket-2',
      leave: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
    } as unknown as Socket;
    const testGateway = gateway as unknown as {
      leaveRoomUseCase: { execute: jest.Mock };
      turnMonitorService: { clearMonitor: jest.Mock };
      comAutoPlayRecoveryService: { clearRoom: jest.Mock };
      spectatorGatewayEffectsService: { sendRoomBackToLobby: jest.Mock };
      roomService: { getRoom: jest.Mock };
      connectionGatewayEffectsService: {
        sendRoomPlayersBackToLobby: jest.Mock;
      };
      playerRooms: Map<string, string>;
      server: {
        sockets: { sockets: Map<string, Socket> };
      };
      emitRoomsListToAll: jest.Mock;
    };
    testGateway.leaveRoomUseCase = {
      execute: jest.fn().mockResolvedValue({
        success: true,
        data: {
          playerId: 'seat-1',
          roomDeleted: true,
          roomsList: [],
        },
      }),
    };
    testGateway.turnMonitorService = { clearMonitor: jest.fn() };
    testGateway.comAutoPlayRecoveryService = { clearRoom: jest.fn() };
    testGateway.spectatorGatewayEffectsService = {
      sendRoomBackToLobby: jest.fn().mockResolvedValue(undefined),
    };
    testGateway.roomService = {
      getRoom: jest.fn().mockResolvedValue({
        players: [
          {
            playerId: 'seat-1',
            userId: 'user-1',
            isCOM: false,
          },
        ],
      }),
    };
    testGateway.connectionGatewayEffectsService = {
      sendRoomPlayersBackToLobby: jest.fn(
        async ({
          server,
          playerRooms,
          roomId,
        }: {
          server: { sockets: { sockets: Map<string, Socket> } };
          playerRooms: Map<string, string>;
          roomId: string;
        }) => {
          const socketIds = Array.from(playerRooms.entries())
            .filter(([, mappedRoomId]) => mappedRoomId === roomId)
            .map(([socketId]) => socketId);
          for (const socketId of socketIds) {
            playerRooms.delete(socketId);
            const socket = server.sockets.sockets.get(socketId);
            if (socket) {
              await socket.leave(roomId);
              socket.emit('back-to-lobby');
            }
          }
        },
      ),
    };
    testGateway.playerRooms = new Map([
      ['socket-1', 'room-1'],
      ['socket-2', 'room-1'],
      ['socket-other', 'room-2'],
    ]);
    testGateway.server = {
      sockets: {
        sockets: new Map([
          ['socket-1', socketOne],
          ['socket-2', socketTwo],
        ]),
      },
    };
    testGateway.emitRoomsListToAll = jest.fn();

    await gateway.handleLeaveRoom(socketOne, {
      roomId: 'room-1',
      playerId: 'user-1',
    });

    expect(testGateway.leaveRoomUseCase.execute).toHaveBeenCalledWith({
      roomId: 'room-1',
      playerId: 'seat-1',
    });
    expect(socketOne.leave).toHaveBeenCalledWith('room-1');
    expect(socketTwo.leave).toHaveBeenCalledWith('room-1');
    expect(socketOne.emit).toHaveBeenCalledWith('back-to-lobby');
    expect(socketTwo.emit).toHaveBeenCalledWith('back-to-lobby');
    expect(testGateway.playerRooms.has('socket-1')).toBe(false);
    expect(testGateway.playerRooms.has('socket-2')).toBe(false);
    expect(testGateway.playerRooms.get('socket-other')).toBe('room-2');
  });
});
