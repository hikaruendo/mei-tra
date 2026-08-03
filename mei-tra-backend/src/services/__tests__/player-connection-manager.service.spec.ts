import { Logger } from '@nestjs/common';
import { PlayerConnectionManager } from '../player-connection-manager.service';

describe('PlayerConnectionManager', () => {
  it('disconnects only the requested player when other sockets are empty', () => {
    const manager = new PlayerConnectionManager({
      log: jest.fn(),
    } as unknown as Logger);
    manager.upsertSessionUser({
      socketId: '',
      playerId: 'host',
      name: 'Host',
      userId: 'host-user',
      isAuthenticated: true,
    });
    manager.upsertSessionUser({
      socketId: '',
      playerId: 'com-1',
      name: 'COM',
      isAuthenticated: false,
    });
    manager.upsertSessionUser({
      socketId: 'target-socket',
      playerId: 'target',
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
        playerId: 'host',
        name: 'Host',
        userId: 'host-user',
      }),
    );
    expect(manager.getSessionUsers()).toHaveLength(3);
  });
});
