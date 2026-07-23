import { AuthService } from './auth.service';
import { SupabaseService } from '../database/supabase.service';
import { IUserProfileRepository } from '../repositories/interfaces/user-profile.repository.interface';
import { UserProfile } from '../types/user.types';

describe('AuthService', () => {
  const profile: UserProfile = {
    id: 'user-1',
    username: 'user',
    displayName: 'User',
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
    updatedAt: new Date('2026-04-01T00:00:00.000Z'),
    lastSeenAt: new Date('2026-04-01T00:00:00.000Z'),
    gamesPlayed: 0,
    gamesWon: 0,
    totalScore: 0,
    preferences: {
      notifications: true,
      sound: true,
      theme: 'dark',
      fontSize: 'standard',
    },
  };

  const createSupabaseService = (getUser: jest.Mock): SupabaseService =>
    ({
      client: {
        auth: {
          getUser,
        },
      },
    }) as unknown as SupabaseService;

  const createRepository = (
    overrides: Partial<jest.Mocked<IUserProfileRepository>> = {},
  ): jest.Mocked<IUserProfileRepository> =>
    ({
      findById: jest.fn().mockResolvedValue(profile),
      findByUsername: jest.fn(),
      findByUserIds: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      updateLastSeen: jest.fn().mockResolvedValue(undefined),
      updateGameStats: jest.fn(),
      searchByUsername: jest.fn(),
      ...overrides,
    }) as unknown as jest.Mocked<IUserProfileRepository>;

  const createGetUser = () =>
    jest.fn().mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: 'user@example.com',
          user_metadata: {},
        },
      },
      error: null,
    });

  it('rechecks profile existence before accepting a cached token', async () => {
    const getUser = createGetUser();
    const repository = createRepository({
      findById: jest
        .fn()
        .mockResolvedValueOnce(profile)
        .mockResolvedValueOnce(null),
    });
    const authService = new AuthService(
      createSupabaseService(getUser),
      repository,
    );

    await expect(authService.validateToken('token')).resolves.toMatchObject({
      id: 'user-1',
    });
    await expect(authService.validateToken('token')).resolves.toBeNull();

    expect(getUser).toHaveBeenCalledTimes(1);
    expect(repository.findById).toHaveBeenCalledTimes(2);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects an invalidated already-issued token even if Supabase still returns the user', async () => {
    const getUser = createGetUser();
    const repository = createRepository();
    const authService = new AuthService(
      createSupabaseService(getUser),
      repository,
    );

    authService.invalidateUser('user-1');

    await expect(authService.validateToken('token')).resolves.toBeNull();

    expect(getUser).toHaveBeenCalledTimes(1);
    expect(repository.findById).not.toHaveBeenCalled();
    expect(repository.updateLastSeen).not.toHaveBeenCalled();
  });

  it('rejects uncached tokens when the profile row is gone', async () => {
    const getUser = createGetUser();
    const repository = createRepository({
      findById: jest.fn().mockResolvedValue(null),
    });
    const authService = new AuthService(
      createSupabaseService(getUser),
      repository,
    );

    await expect(authService.validateToken('token')).resolves.toBeNull();

    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.updateLastSeen).not.toHaveBeenCalled();
  });

  it('rejects deleting accounts for normal authenticated actions', async () => {
    const getUser = createGetUser();
    const repository = createRepository({
      findById: jest.fn().mockResolvedValue({
        ...profile,
        accountDeletionStartedAt: new Date('2026-04-02T00:00:00.000Z'),
      }),
    });
    const authService = new AuthService(
      createSupabaseService(getUser),
      repository,
    );

    await expect(authService.validateToken('token')).resolves.toBeNull();

    expect(repository.updateLastSeen).not.toHaveBeenCalled();
  });

  it('allows deleting accounts only when the caller opts into delete retry auth', async () => {
    const getUser = createGetUser();
    const repository = createRepository({
      findById: jest.fn().mockResolvedValue({
        ...profile,
        accountDeletionStartedAt: new Date('2026-04-02T00:00:00.000Z'),
      }),
    });
    const authService = new AuthService(
      createSupabaseService(getUser),
      repository,
    );

    await expect(
      authService.validateToken('token', { allowDeletingAccount: true }),
    ).resolves.toMatchObject({ id: 'user-1' });

    expect(repository.updateLastSeen).toHaveBeenCalledWith('user-1');
  });
});
