import { SupabaseService } from '../database/supabase.service';
import { SupabaseIdentityProvider } from './supabase-identity-provider';

describe('SupabaseIdentityProvider', () => {
  const createProvider = (
    options: {
      getUser?: jest.Mock;
      deleteUser?: jest.Mock;
    } = {},
  ) => {
    const getUser =
      options.getUser ??
      jest.fn().mockResolvedValue({
        data: {
          user: {
            id: 'user-1',
            email: 'user@example.com',
            is_anonymous: true,
          },
        },
        error: null,
      });
    const deleteUser =
      options.deleteUser ??
      jest.fn().mockResolvedValue({ data: {}, error: null });
    const provider = new SupabaseIdentityProvider({
      client: {
        auth: {
          getUser,
          admin: { deleteUser },
        },
      },
    } as unknown as SupabaseService);

    return { provider, getUser, deleteUser };
  };

  it('maps Supabase users to provider-neutral identities', async () => {
    const { provider, getUser } = createProvider();

    await expect(provider.verifyAccessToken('token')).resolves.toEqual({
      id: 'user-1',
      email: 'user@example.com',
      isAnonymous: true,
    });
    expect(getUser).toHaveBeenCalledWith('token');
  });

  it('returns null for rejected or empty token responses', async () => {
    const rejected = createProvider({
      getUser: jest.fn().mockResolvedValue({
        data: { user: null },
        error: new Error('invalid token'),
      }),
    });
    const empty = createProvider({
      getUser: jest.fn().mockResolvedValue({
        data: { user: null },
        error: null,
      }),
    });

    await expect(
      rejected.provider.verifyAccessToken('bad'),
    ).resolves.toBeNull();
    await expect(empty.provider.verifyAccessToken('empty')).resolves.toBeNull();
  });

  it('maps a successful admin deletion to deleted', async () => {
    const { provider, deleteUser } = createProvider();

    await expect(provider.deleteUser('user-1')).resolves.toBe('deleted');
    expect(deleteUser).toHaveBeenCalledWith('user-1', false);
  });

  it('maps an already missing user to an idempotent result', async () => {
    const { provider } = createProvider({
      deleteUser: jest.fn().mockResolvedValue({
        data: {},
        error: { status: 404, message: 'User not found' },
      }),
    });

    await expect(provider.deleteUser('user-1')).resolves.toBe('not-found');
  });

  it('throws other provider errors', async () => {
    const providerError = { status: 503, message: 'unavailable' };
    const { provider } = createProvider({
      deleteUser: jest.fn().mockResolvedValue({
        data: {},
        error: providerError,
      }),
    });

    await expect(provider.deleteUser('user-1')).rejects.toBe(providerError);
  });
});
