import { Server } from 'socket.io';
import { TurnMonitorService } from '../turn-monitor.service';
import { IRoomService } from '../interfaces/room-service.interface';
import { RoomStatus } from '../../types/room.types';

describe('TurnMonitorService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('emits idle-cleared after a valid ack', async () => {
    const emit = jest.fn();
    const roomService = {
      getRoom: jest.fn().mockResolvedValue({ status: RoomStatus.PLAYING }),
      getRoomGameState: jest.fn().mockResolvedValue({
        getState: () => ({
          players: [
            {
              playerId: 'p1',
              socketId: 'socket-1',
              userId: 'user-1',
              isCOM: false,
              name: 'Player 1',
            },
          ],
          currentPlayerIndex: 0,
          gamePhase: 'play',
        }),
        getPlayerConnectionState: () => ({
          socketId: 'socket-1',
          userId: 'user-1',
          isAuthenticated: true,
        }),
      }),
    } as Partial<IRoomService> as IRoomService;
    const server = {
      to: jest.fn().mockReturnValue({ emit }),
    } as unknown as Server;
    const service = new TurnMonitorService(roomService);

    await service.startMonitor('room-1', 'p1', server, jest.fn());
    jest.advanceTimersByTime(46000);
    await Promise.resolve();

    await service.acknowledge('room-1', 'socket-1', 'user-1');

    expect(emit).toHaveBeenCalledWith('player-idle-cleared', {
      playerId: 'p1',
      roomId: 'room-1',
    });
  });
});
