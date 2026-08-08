import {
  cleanupAfterAccountDeletion,
  cleanupBeforeLocalSignOut,
} from '@/lib/session-cleanup';

describe('cleanupBeforeLocalSignOut', () => {
  it('removes the notification token before room/session cleanup', async () => {
    const events: string[] = [];

    await cleanupBeforeLocalSignOut({
      getAccessToken: async () => 'access-token',
      unregisterPushToken: async (accessToken) => {
        events.push(`notification:${accessToken}`);
      },
      clearRoom: async () => {
        events.push('room');
      },
      signOut: async () => {
        events.push('session');
      },
    });

    expect(events).toEqual([
      'notification:access-token',
      'room',
      'session',
    ]);
  });

  it('still clears the local room and session when remote token removal fails', async () => {
    const clearRoom = jest.fn().mockResolvedValue(undefined);
    const signOut = jest.fn().mockResolvedValue(undefined);

    await expect(
      cleanupBeforeLocalSignOut({
        getAccessToken: async () => 'access-token',
        unregisterPushToken: async () => {
          throw new Error('offline');
        },
        clearRoom,
        signOut,
      }),
    ).resolves.toBeUndefined();
    expect(clearRoom).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});

describe('cleanupAfterAccountDeletion', () => {
  it('clears local caches without calling remote logout', async () => {
    const events: string[] = [];

    await cleanupAfterAccountDeletion({
      clearLocalNotificationRegistration: async () => {
        events.push('notification');
      },
      clearRoom: async () => {
        events.push('room');
      },
      clearLocalSession: async () => {
        events.push('session');
      },
    });

    expect(events).toEqual(['notification', 'room', 'session']);
  });

  it('continues local cleanup when an earlier cache clear fails', async () => {
    const clearRoom = jest.fn().mockResolvedValue(undefined);
    const clearLocalSession = jest.fn().mockResolvedValue(undefined);

    await expect(
      cleanupAfterAccountDeletion({
        clearLocalNotificationRegistration: async () => {
          throw new Error('notification cache unavailable');
        },
        clearRoom,
        clearLocalSession,
      }),
    ).resolves.toBeUndefined();

    expect(clearRoom).toHaveBeenCalledTimes(1);
    expect(clearLocalSession).toHaveBeenCalledTimes(1);
  });
});
