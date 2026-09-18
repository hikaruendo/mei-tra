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

    manager.applyConnectionState(asSeatId('target'), 'Target', {
      socketId: '',
    });

    expect(manager.getPlayerConnectionState(asSeatId('target'))).toEqual({
      socketId: '',
      userId: 'target-user',
      isAuthenticated: true,
    });
    expect(manager.findSessionUserBySeatId(asSeatId('host'))).toEqual(
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
    expect(manager.seatIdsByToken.has('user-1')).toBe(false);
    expect(manager.seatIdsByToken.get('user-2')).toBe('seat-2');
  });

  it('detaches a seat occupant so only the seat id still resolves to the seat', () => {
    const manager = new PlayerConnectionManager({
      log: jest.fn(),
    } as unknown as Logger);
    const seatId = asSeatId('seat-1');
    const players = [
      {
        seatId,
        name: 'COM',
        team: 0 as const,
        hand: [],
        isCOM: true,
        isPasser: false,
        hasBroken: false,
        hasRequiredBroken: false,
      },
    ];
    manager.registerSeatToken(seatId, seatId);
    manager.upsertSessionUser({
      socketId: 'socket-1',
      seatId,
      name: 'User 1',
      userId: 'user-1',
      isAuthenticated: true,
    });
    manager.upsertSessionUser({
      socketId: 'socket-2',
      seatId: asSeatId('seat-2'),
      name: 'User 2',
      userId: 'user-2',
      isAuthenticated: true,
    });

    manager.detachSeatOccupant(seatId);

    expect(manager.getPlayerConnectionState(seatId)).toBeNull();
    expect(manager.findSessionUserByUserId('user-1')).toBeNull();
    expect(manager.findPlayerByReconnectToken(players, 'user-1')).toBeNull();
    expect(manager.findPlayerByReconnectToken(players, seatId)?.seatId).toBe(
      seatId,
    );
    expect(manager.seatIdsByToken.get('user-2')).toBe('seat-2');
    expect(manager.findSessionUserByUserId('user-2')?.seatId).toBe('seat-2');
  });
});
