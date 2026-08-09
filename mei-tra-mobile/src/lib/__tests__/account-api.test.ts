import {
  AccountDeletionError,
  deleteAccountRequest,
} from '@/lib/account-api';

jest.mock('@/lib/config', () => ({
  config: {
    backendUrl: 'https://backend.example.com',
  },
}));

const response = (status: number, body?: unknown): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  }) as unknown as Response;

describe('deleteAccountRequest', () => {
  it('succeeds without clearing client state itself', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response(200, { deleted: true }));

    await expect(
      deleteAccountRequest('user/1', 'access-token', fetchImpl),
    ).resolves.toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://backend.example.com/api/user-profile/user%2F1',
      expect.objectContaining({
        method: 'DELETE',
        headers: { Authorization: 'Bearer access-token' },
      }),
    );
  });

  it('maps active-room conflicts and preserves the server count', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        response(409, { message: 'active rooms', activeRoomCount: 2 }),
      );

    const result = deleteAccountRequest('user-1', 'access-token', fetchImpl);

    await expect(result).rejects.toMatchObject({
      kind: 'active-room',
      status: 409,
      activeRoomCount: 2,
    });
    await expect(result).rejects.toBeInstanceOf(AccountDeletionError);
  });

  it('maps auth, server, and network failures without treating them as success', async () => {
    await expect(
      deleteAccountRequest('user-1', null, jest.fn()),
    ).rejects.toMatchObject({ kind: 'unauthorized', status: 401 });

    await expect(
      deleteAccountRequest(
        'user-1',
        'access-token',
        jest.fn().mockResolvedValue(response(500, { message: 'failed' })),
      ),
    ).rejects.toMatchObject({ kind: 'server', status: 500 });

    await expect(
      deleteAccountRequest(
        'user-1',
        'access-token',
        jest.fn().mockRejectedValue(new Error('offline')),
      ),
    ).rejects.toMatchObject({ kind: 'network' });
  });
});
