import { Logger } from '@nestjs/common';
import { PlayerConnectionManager } from '../player-connection-manager.service';
import { asSeatId } from '../../types/identity.types';

describe('PlayerConnectionManager', () => {
  it('disconnects only the requested player when other sockets are empty', () => {
    const manager = new PlayerConnectionManager({
      log: jest.fn(),
    } as unknown as Logger);
    manager.upsertSessionUser({
      socketId: '',
      seatId: asSeatId('host'),
      name: 'Host',
      userId: 'host-user',
      isAuthenticated: true,
    });
    manager.upsertSessionUser({
      socketId: '',
      seatId: asSeatId('com-1'),
      name: 'COM',
      isAuthenticated: false,
    });
    manager.upsertSessionUser({
      socketId: 'target-socket',
      seatId: asSeatId('target'),
      name: 'Target',
      userId: 'target-user',
      isAuthenticated: true,
    });

    manager.applyConnectionState('target', 'Target', { socketId: '' });

    expect(manager.getPlayerConnectionState('target')).toEqual({
      socketId: '',
      userId: 'target-user',
      isAuthenticated: true,
    });
    expect(manager.findSessionUserByPlayerId('host')).toEqual(
      expect.objectContaining({
        seatId: asSeatId('host'),
        name: 'Host',
        userId: 'host-user',
      }),
    );
    expect(manager.getSessionUsers()).toHaveLength(3);
  });

  it('collapses a stale auth session into the resolved room seat', () => {
    const manager = new PlayerConnectionManager({
      log: jest.fn(),
    } as unknown as Logger);
    manager.upsertSessionUser({
      socketId: 'old-socket',
      seatId: asSeatId('user-1'),
      name: 'Player',
      userId: 'user-1',
      isAuthenticated: true,
    });
    manager.upsertSessionUser({
      socketId: 'room-socket',
      seatId: asSeatId('seat-1'),
      name: 'Player',
    });

    manager.upsertSessionUser({
      socketId: 'new-socket',
      seatId: asSeatId('seat-1'),
      name: 'Player',
      userId: 'user-1',
      isAuthenticated: true,
    });

    expect(manager.getSessionUsers()).toEqual([
      {
        socketId: 'new-socket',
        seatId: asSeatId('seat-1'),
        name: 'Player',
        userId: 'user-1',
        isAuthenticated: true,
      },
    ]);
    expect(manager.findSessionUserByUserId('user-1')?.seatId).toBe('seat-1');
  });

  it('removes a stale user mapping when one socket changes identity', () => {
    const manager = new PlayerConnectionManager({
      log: jest.fn(),
    } as unknown as Logger);
    manager.upsertSessionUser({
      socketId: 'shared-socket',
      seatId: asSeatId('seat-1'),
      name: 'Player 1',
      userId: 'user-1',
      isAuthenticated: true,
    });

    manager.upsertSessionUser({
      socketId: 'shared-socket',
      seatId: asSeatId('seat-2'),
      name: 'Player 2',
      userId: 'user-2',
      isAuthenticated: true,
    });

    expect(manager.findSessionUserByUserId('user-1')).toBeNull();
    expect(manager.playerIds.has('user-1')).toBe(false);
    expect(manager.playerIds.get('user-2')).toBe('seat-2');
  });
});
