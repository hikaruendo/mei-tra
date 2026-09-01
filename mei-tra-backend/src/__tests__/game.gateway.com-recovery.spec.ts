import { Socket } from 'socket.io';
import { GameGateway } from '../game.gateway';
import { asSeatId } from '../types/identity.types';
import { RoomGameActionQueueService } from '../services/room-game-action-queue.service';

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
    new RoomGameActionQueueService(),
  );
};

interface ActiveReconnectGatewayHarness {
  activityTracker: { incrementConnections: jest.Mock };
  authService: { getUserFromSocketToken: jest.Mock };
  reconnectionUseCase: {
    execute: jest.Mock;
    getActiveGameSnapshot: jest.Mock;
    getWaitingRoomSnapshot: jest.Mock;
  };
  joinRoomGatewayEffectsService: {
    buildRoomEntryEvents: jest.Mock;
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

  it('forwards the visible transition delay to the stalled-turn notifier', () => {
    const gateway = createGateway();
    const notifyTurnChanged = jest.fn();
    const testGateway = gateway as unknown as {
      dispatchEvents: jest.Mock;
      dispatchGameplayEvents: (events: object[]) => void;
      gameplayNotificationService: { notifyTurnChanged: jest.Mock };
    };
    testGateway.dispatchEvents = jest.fn();
    testGateway.gameplayNotificationService = { notifyTurnChanged };

    testGateway.dispatchGameplayEvents([
      {
        scope: 'room',
        roomId: 'room-1',
        event: 'update-turn',
        payload: 'player-2',
        delayMs: 3_000,
      },
    ]);

    expect(notifyTurnChanged).toHaveBeenCalledWith({
      roomId: 'room-1',
      seatId: 'player-2',
      transitionDelayMs: 3_000,
    });
  });

  it('does not start COM progress from a human turn acknowledgement', async () => {
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
    expect(trigger).not.toHaveBeenCalled();
  });

  it.each([
    {
      action: 'declare blow',
      configure: (gateway: GameGateway, execute: jest.Mock) => {
        const testGateway = gateway as unknown as {
          declareBlowUseCase: { execute: jest.Mock };
        };
        testGateway.declareBlowUseCase = { execute };
      },
      invoke: (gateway: GameGateway, client: Socket) =>
        gateway.handleDeclareBlow(client, {
          roomId: 'room-1',
          declaration: { trumpType: 'tra', numberOfPairs: 1 },
        }),
    },
    {
      action: 'pass blow',
      configure: (gateway: GameGateway, execute: jest.Mock) => {
        const testGateway = gateway as unknown as {
          passBlowUseCase: { execute: jest.Mock };
        };
        testGateway.passBlowUseCase = { execute };
      },
      invoke: (gateway: GameGateway, client: Socket) =>
        gateway.handlePassBlow(client, { roomId: 'room-1' }),
    },
  ])(
    'holds COM recovery until delayed events finish after $action',
    async ({ configure, invoke }) => {
      const gateway = createGateway();
      const delayedEvents = [
        {
          scope: 'room' as const,
          roomId: 'room-1',
          event: 'update-phase',
          payload: { phase: 'play' },
          delayMs: 3_000,
        },
      ];
      const execute = jest.fn().mockResolvedValue({
        success: true,
        events: [],
        delayedEvents,
      });
      const trigger = jest.fn();
      const triggerAfterDelay = jest.fn();
      const testGateway = gateway as unknown as {
        activityTracker: { recordActivity: jest.Mock };
        spectatorGatewayEffectsService: { rejectAction: jest.Mock };
        dispatchGameplayEvents: jest.Mock;
        comAutoPlayRecoveryService: {
          trigger: jest.Mock;
          triggerAfterDelay: jest.Mock;
        };
      };

      configure(gateway, execute);
      testGateway.activityTracker = { recordActivity: jest.fn() };
      testGateway.spectatorGatewayEffectsService = {
        rejectAction: jest.fn().mockReturnValue(false),
      };
      testGateway.dispatchGameplayEvents = jest.fn();
      testGateway.comAutoPlayRecoveryService = {
        trigger,
        triggerAfterDelay,
      };

      const client = {
        id: 'socket-1',
        data: { user: { id: 'user-1' } },
        emit: jest.fn(),
      } as unknown as Socket;

      await invoke(gateway, client);

      expect(triggerAfterDelay).toHaveBeenCalledWith(
        'room-1',
        expect.anything(),
        3_100,
      );
      expect(trigger).not.toHaveBeenCalled();
    },
  );

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
      getWaitingRoomSnapshot: jest.fn(),
    };
    testGateway.joinRoomGatewayEffectsService = {
      buildRoomEntryEvents: jest.fn(),
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
        seatId: 'player-1',
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
          payload: { seatId: 'player-1' },
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
      seatId: 'player-1',
      playerName: 'Player 1',
      timeoutMode: 'convert-to-com',
      membership: null,
    });
    expect(triggerRecovery).toHaveBeenCalledWith('room-1', expect.anything());
  });

  it('returns an active-game snapshot without reconnect side effects', async () => {
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
      getWaitingRoomSnapshot: jest.fn(),
    };
    testGateway.connectionGatewayEffectsService = {
      findExistingControllerSocketId: jest.fn().mockResolvedValue(null),
      sendSocketBackToLobby: jest.fn(),
    };
    testGateway.joinRoomGatewayEffectsService = {
      buildRoomEntryEvents: jest.fn(),
      buildActiveReconnectEvents: jest.fn().mockResolvedValue([]),
    };
    testGateway.startTurnAckMonitor = jest.fn().mockResolvedValue(undefined);
    testGateway.dispatchEvents = jest.fn();
    testGateway.comAutoPlayRecoveryService = { trigger: jest.fn() };
    testGateway.playerRooms = new Map();

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
    expect(
      testGateway.reconnectionUseCase.getWaitingRoomSnapshot,
    ).not.toHaveBeenCalled();
    expect(client.join).toHaveBeenCalledWith('room-1');
    expect(client.emit).toHaveBeenCalledWith('game-state', gameState);
    expect(client.emit).toHaveBeenCalledWith('reconnect-token', 'player-1');
    expect(testGateway.startTurnAckMonitor).not.toHaveBeenCalled();
    expect(
      testGateway.joinRoomGatewayEffectsService.buildActiveReconnectEvents,
    ).not.toHaveBeenCalled();
    expect(
      testGateway.comAutoPlayRecoveryService.trigger,
    ).not.toHaveBeenCalled();
  });

  it('returns a waiting-room snapshot without reconnect side effects', async () => {
    const gateway = createGateway();
    const testGateway = gateway as unknown as ActiveReconnectGatewayHarness;
    const authenticatedUser = {
      id: 'user-1',
      email: 'user@example.com',
      profile: { displayName: 'User 1' },
    };
    const room = {
      id: 'room-1',
      status: 'waiting',
      players: [],
    };
    const roomEntryEvents = [
      {
        scope: 'socket' as const,
        socketId: 'socket-1',
        event: 'room-sync',
        payload: room,
      },
    ];

    testGateway.reconnectionUseCase = {
      execute: jest.fn(),
      getActiveGameSnapshot: jest.fn().mockResolvedValue(null),
      getWaitingRoomSnapshot: jest.fn().mockResolvedValue({
        roomId: 'room-1',
        roomsList: [],
        room,
        selfSeatId: asSeatId('seat-1'),
        selfName: 'User 1',
        selfTeam: 0,
        isHost: true,
      }),
    };
    testGateway.connectionGatewayEffectsService = {
      findExistingControllerSocketId: jest.fn().mockResolvedValue(null),
      sendSocketBackToLobby: jest.fn(),
    };
    testGateway.joinRoomGatewayEffectsService = {
      buildRoomEntryEvents: jest.fn().mockResolvedValue(roomEntryEvents),
      buildActiveReconnectEvents: jest.fn(),
    };
    testGateway.dispatchEvents = jest.fn();
    testGateway.playerRooms = new Map();

    const client = {
      id: 'socket-1',
      data: { user: authenticatedUser },
      join: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
    } as unknown as Socket;

    await gateway.handleSyncGameState(client, { roomId: 'room-1' });

    expect(
      testGateway.joinRoomGatewayEffectsService.buildRoomEntryEvents,
    ).toHaveBeenCalledWith({
      clientId: 'socket-1',
      room,
      selfPlayer: {
        seatId: asSeatId('seat-1'),
        name: 'User 1',
        team: 0,
      },
      isHost: true,
      roomStatus: 'waiting',
      roomsList: [],
      roomsListScope: 'socket',
    });
    expect(testGateway.dispatchEvents).toHaveBeenCalledWith(roomEntryEvents);
    expect(testGateway.playerRooms.get('socket-1')).toBe('room-1');
    expect(testGateway.reconnectionUseCase.execute).not.toHaveBeenCalled();
    expect(
      testGateway.reconnectionUseCase.getWaitingRoomSnapshot,
    ).toHaveBeenCalledWith({ roomId: 'room-1', authenticatedUser });
    expect(client.emit).not.toHaveBeenCalledWith(
      'game-state',
      expect.anything(),
    );
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
          seatId: 'seat-1',
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
            seatId: asSeatId('seat-1'),
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
    });

    expect(testGateway.leaveRoomUseCase.execute).toHaveBeenCalledWith({
      roomId: 'room-1',
      seatId: 'seat-1',
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
