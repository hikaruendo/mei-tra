import { Server, Socket } from 'socket.io';
import { SpectatorGatewayEffectsService } from '../spectator-gateway-effects.service';

describe('SpectatorGatewayEffectsService', () => {
  const gameState = {
    players: [],
    gamePhase: 'play' as const,
    currentField: null,
    currentTurn: null,
    blowState: {
      currentTrump: null,
      currentHighestDeclaration: null,
      declarations: [],
      actionHistory: [],
      lastPasser: null,
      isRoundCancelled: false,
      currentBlowIndex: 0,
    },
    teamScores: {
      0: { play: 0, total: 0 },
      1: { play: 0, total: 0 },
    },
    you: null,
    isSpectator: true,
    negriCard: null,
    fields: [],
    roomId: 'room-1',
    pointsToWin: 5,
  };

  const createSocket = (id = 'socket-1') =>
    ({
      id,
      join: jest.fn().mockResolvedValue(undefined),
      leave: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
    }) as unknown as Socket;

  it('registers a socket as a spectator and emits the provided snapshot', async () => {
    const service = new SpectatorGatewayEffectsService();
    const socket = createSocket();

    await service.watchRoom(socket, 'room-1', gameState);

    expect(service.isSpectatorSocket('socket-1')).toBe(true);
    expect(socket.join).toHaveBeenCalledWith('spectators:room-1');
    expect(socket.emit).toHaveBeenCalledWith('game-state', gameState);
  });

  it('queues a spectator snapshot without knowing how to build it', async () => {
    jest.useFakeTimers();
    const service = new SpectatorGatewayEffectsService();
    const emit = jest.fn();
    const server = {
      sockets: {
        adapter: {
          rooms: new Map([['spectators:room-1', new Set(['socket-1'])]]),
        },
      },
      to: jest.fn(() => ({ emit })),
    } as unknown as Server;
    const buildSnapshot = jest.fn().mockResolvedValue(gameState);

    service.queueSnapshot(server, 'room-1', buildSnapshot);
    jest.runOnlyPendingTimers();
    await Promise.resolve();

    expect(buildSnapshot).toHaveBeenCalledTimes(1);
    expect(server.to).toHaveBeenCalledWith('spectators:room-1');
    expect(emit).toHaveBeenCalledWith('game-state', gameState);

    jest.useRealTimers();
  });
});
