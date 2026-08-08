import { DeleteAccountUseCase } from '../delete-account.use-case';
import {
  AccountDeletionBlockedError,
  AccountDeletionFailedError,
} from '../interfaces/delete-account.use-case.interface';
import {
  IAccountDeletionRepository,
  IUserProfileRepository,
} from '../../repositories/interfaces/user-profile.repository.interface';
import { SupabaseService } from '../../database/supabase.service';
import { RoomStatus } from '../../types/room.types';
import { AuthService } from '../../auth/auth.service';

describe('DeleteAccountUseCase', () => {
  const createRepository = (
    overrides: Partial<
      IUserProfileRepository & IAccountDeletionRepository
    > = {},
  ): IUserProfileRepository & IAccountDeletionRepository =>
    ({
      findById: jest.fn().mockResolvedValue({
        id: 'user-1',
        username: 'user',
        displayName: 'User',
        avatarUrl:
          'https://example.supabase.co/storage/v1/object/public/avatars/user-1/avatar.webp',
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
      }),
      findByUsername: jest.fn(),
      findByUserIds: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      updateLastSeen: jest.fn(),
      updateGameStats: jest.fn(),
      searchByUsername: jest.fn(),
      findAccountDeletionBlockers: jest.fn().mockResolvedValue([]),
      markAccountDeletionStarted: jest.fn().mockResolvedValue({
        id: 'user-1',
        username: 'user',
        displayName: 'User',
        avatarUrl:
          'https://example.supabase.co/storage/v1/object/public/avatars/user-1/avatar.webp',
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z'),
        lastSeenAt: new Date('2026-04-01T00:00:00.000Z'),
        accountDeletionStartedAt: new Date('2026-04-02T00:00:00.000Z'),
        gamesPlayed: 0,
        gamesWon: 0,
        totalScore: 0,
        preferences: {
          notifications: true,
          sound: true,
          theme: 'dark',
          fontSize: 'standard',
        },
      }),
      anonymizeAccountReferences: jest.fn().mockResolvedValue({
        anonymizedRoomPlayerCount: 1,
        anonymizedRoomCount: 1,
        anonymizedGameStateCount: 1,
        anonymizedGameHistoryCount: 2,
      }),
      ...overrides,
    }) as IUserProfileRepository & IAccountDeletionRepository;

  const createSupabaseService = (
    overrides: {
      list?: jest.Mock;
      remove?: jest.Mock;
      deleteUser?: jest.Mock;
    } = {},
  ): SupabaseService => {
    const list = overrides.list ?? jest.fn().mockResolvedValue({ data: [] });
    const remove =
      overrides.remove ??
      jest.fn().mockResolvedValue({ data: [], error: null });
    const deleteUser =
      overrides.deleteUser ??
      jest.fn().mockResolvedValue({ data: { user: null }, error: null });
    const from = jest.fn(() => ({ list, remove }));

    return {
      client: {
        storage: {
          from,
        },
        auth: {
          admin: {
            deleteUser,
          },
        },
      },
    } as unknown as SupabaseService;
  };

  const createAuthService = (): jest.Mocked<AuthService> =>
    ({
      invalidateUser: jest.fn(),
    }) as unknown as jest.Mocked<AuthService>;

  it('marks deletion, deletes avatar objects, anonymizes database references, then deletes auth user', async () => {
    const repository = createRepository();
    const list = jest.fn().mockResolvedValue({
      data: [{ name: 'old-avatar.webp' }],
      error: null,
    });
    const remove = jest.fn().mockResolvedValue({ data: [], error: null });
    const deleteUser = jest
      .fn()
      .mockResolvedValue({ data: { user: null }, error: null });
    const supabaseService = createSupabaseService({
      list,
      remove,
      deleteUser,
    });
    const authService = createAuthService();
    const useCase = new DeleteAccountUseCase(
      repository,
      supabaseService,
      authService,
    );

    await expect(useCase.execute('user-1')).resolves.toEqual({
      deleted: true,
      cleanup: {
        anonymizedRoomPlayerCount: 1,
        anonymizedRoomCount: 1,
        anonymizedGameStateCount: 1,
        anonymizedGameHistoryCount: 2,
        removedAvatarObjectCount: 2,
      },
    });

    expect(remove).toHaveBeenCalledWith([
      'user-1/avatar.webp',
      'user-1/old-avatar.webp',
    ]);
    expect(list).toHaveBeenCalledWith('user-1', { limit: 1000 });
    expect(repository.markAccountDeletionStarted).toHaveBeenCalledWith(
      'user-1',
    );
    expect(repository.anonymizeAccountReferences).toHaveBeenCalledWith(
      'user-1',
    );
    expect(deleteUser).toHaveBeenCalledWith('user-1', false);
    expect(authService.invalidateUser).toHaveBeenCalledWith('user-1');
    expect(repository.findAccountDeletionBlockers).toHaveBeenCalledTimes(2);
    expect(
      (repository.markAccountDeletionStarted as jest.Mock).mock
        .invocationCallOrder[0],
    ).toBeLessThan(list.mock.invocationCallOrder[0]);
  });

  it('stops before storage, database cleanup, or auth delete when active participation exists', async () => {
    const repository = createRepository({
      findAccountDeletionBlockers: jest.fn().mockResolvedValue([
        {
          roomId: 'room-1',
          status: RoomStatus.PLAYING,
          reason: 'participant',
        },
      ]),
    });
    const deleteUser = jest.fn();
    const supabaseService = createSupabaseService({ deleteUser });
    const authService = createAuthService();
    const useCase = new DeleteAccountUseCase(
      repository,
      supabaseService,
      authService,
    );

    await expect(useCase.execute('user-1')).rejects.toBeInstanceOf(
      AccountDeletionBlockedError,
    );
    expect(repository.findById).not.toHaveBeenCalled();
    expect(repository.markAccountDeletionStarted).not.toHaveBeenCalled();
    expect(repository.anonymizeAccountReferences).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
    expect(authService.invalidateUser).not.toHaveBeenCalled();
  });

  it('rechecks active participation after marking deletion and before cleanup', async () => {
    const repository = createRepository({
      findAccountDeletionBlockers: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            roomId: 'room-1',
            status: RoomStatus.PLAYING,
            reason: 'participant',
          },
        ]),
    });
    const deleteUser = jest.fn();
    const useCase = new DeleteAccountUseCase(
      repository,
      createSupabaseService({ deleteUser }),
      createAuthService(),
    );

    await expect(useCase.execute('user-1')).rejects.toBeInstanceOf(
      AccountDeletionBlockedError,
    );
    expect(repository.anonymizeAccountReferences).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
    expect(repository.markAccountDeletionStarted).toHaveBeenCalledWith(
      'user-1',
    );
  });

  it('reports a concurrent room join detected by the marker RPC as a blocker', async () => {
    const repository = createRepository({
      findAccountDeletionBlockers: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            roomId: 'room-1',
            status: RoomStatus.WAITING,
            reason: 'participant',
          },
        ]),
      markAccountDeletionStarted: jest.fn().mockRejectedValue({
        code: 'PT409',
        message: 'account_deletion_blocked user=user-1',
      }),
    });
    const deleteUser = jest.fn();
    const useCase = new DeleteAccountUseCase(
      repository,
      createSupabaseService({ deleteUser }),
      createAuthService(),
    );

    await expect(useCase.execute('user-1')).rejects.toMatchObject({
      blockers: [
        {
          roomId: 'room-1',
          status: RoomStatus.WAITING,
          reason: 'participant',
        },
      ],
    });
    expect(repository.anonymizeAccountReferences).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('does not remove avatar URLs outside the deleting user folder', async () => {
    const repository = createRepository({
      markAccountDeletionStarted: jest.fn().mockResolvedValue({
        id: 'user-1',
        username: 'user',
        displayName: 'User',
        avatarUrl:
          'https://example.supabase.co/storage/v1/object/public/avatars/user-2/avatar.webp',
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
      }),
    });
    const remove = jest.fn();
    const useCase = new DeleteAccountUseCase(
      repository,
      createSupabaseService({
        list: jest.fn().mockResolvedValue({ data: [], error: null }),
        remove,
      }),
      createAuthService(),
    );

    await expect(useCase.execute('user-1')).resolves.toMatchObject({
      deleted: true,
      cleanup: {
        removedAvatarObjectCount: 0,
      },
    });
    expect(remove).not.toHaveBeenCalled();
  });

  it('returns deterministic storage failure without deleting auth user', async () => {
    const repository = createRepository();
    const deleteUser = jest.fn();
    const useCase = new DeleteAccountUseCase(
      repository,
      createSupabaseService({
        list: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'storage unavailable' },
        }),
        deleteUser,
      }),
      createAuthService(),
    );

    await expect(useCase.execute('user-1')).rejects.toEqual(
      new AccountDeletionFailedError('storage'),
    );
    expect(repository.markAccountDeletionStarted).toHaveBeenCalledWith(
      'user-1',
    );
    expect(repository.anonymizeAccountReferences).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('returns deterministic auth failure after database cleanup succeeds', async () => {
    const repository = createRepository();
    const authService = createAuthService();
    const useCase = new DeleteAccountUseCase(
      repository,
      createSupabaseService({
        deleteUser: jest.fn().mockResolvedValue({
          data: { user: null },
          error: { name: 'AuthApiError', status: 500 },
        }),
      }),
      authService,
    );

    await expect(useCase.execute('user-1')).rejects.toEqual(
      new AccountDeletionFailedError('auth'),
    );
    expect(repository.anonymizeAccountReferences).toHaveBeenCalledWith(
      'user-1',
    );
    expect(authService.invalidateUser).not.toHaveBeenCalled();
  });

  it('does not delete auth when the atomic anonymization RPC fails', async () => {
    const repository = createRepository({
      anonymizeAccountReferences: jest
        .fn()
        .mockRejectedValue(
          new Error('account anonymization transaction aborted'),
        ),
    });
    const deleteUser = jest.fn();
    const useCase = new DeleteAccountUseCase(
      repository,
      createSupabaseService({ deleteUser }),
      createAuthService(),
    );

    await expect(useCase.execute('user-1')).rejects.toEqual(
      new AccountDeletionFailedError('database'),
    );
    expect(deleteUser).not.toHaveBeenCalled();
    expect(repository.anonymizeAccountReferences).toHaveBeenCalledTimes(1);
  });

  it('can retry safely after cleanup succeeded but auth deletion failed', async () => {
    const repository = createRepository({
      anonymizeAccountReferences: jest
        .fn()
        .mockResolvedValueOnce({
          anonymizedRoomPlayerCount: 1,
          anonymizedRoomCount: 1,
          anonymizedGameStateCount: 1,
          anonymizedGameHistoryCount: 2,
        })
        .mockResolvedValueOnce({
          anonymizedRoomPlayerCount: 0,
          anonymizedRoomCount: 0,
          anonymizedGameStateCount: 0,
          anonymizedGameHistoryCount: 0,
        }),
    });
    const deleteUser = jest
      .fn()
      .mockResolvedValueOnce({
        data: { user: null },
        error: { name: 'AuthApiError', status: 500 },
      })
      .mockResolvedValueOnce({ data: { user: null }, error: null });
    const authService = createAuthService();
    const useCase = new DeleteAccountUseCase(
      repository,
      createSupabaseService({ deleteUser }),
      authService,
    );

    await expect(useCase.execute('user-1')).rejects.toEqual(
      new AccountDeletionFailedError('auth'),
    );
    await expect(useCase.execute('user-1')).resolves.toEqual({
      deleted: true,
      cleanup: {
        anonymizedRoomPlayerCount: 0,
        anonymizedRoomCount: 0,
        anonymizedGameStateCount: 0,
        anonymizedGameHistoryCount: 0,
        removedAvatarObjectCount: 1,
      },
    });
    expect(repository.markAccountDeletionStarted).toHaveBeenCalledTimes(2);
    expect(repository.anonymizeAccountReferences).toHaveBeenCalledTimes(2);
    expect(deleteUser).toHaveBeenCalledTimes(2);
    expect(authService.invalidateUser).toHaveBeenCalledWith('user-1');
  });

  it('treats an already-deleted auth user as an idempotent success', async () => {
    const repository = createRepository();
    const authService = createAuthService();
    const useCase = new DeleteAccountUseCase(
      repository,
      createSupabaseService({
        deleteUser: jest.fn().mockResolvedValue({
          data: { user: null },
          error: {
            name: 'AuthApiError',
            status: 404,
            message: 'User not found',
          },
        }),
      }),
      authService,
    );

    await expect(useCase.execute('user-1')).resolves.toEqual({
      deleted: true,
      cleanup: {
        anonymizedRoomPlayerCount: 1,
        anonymizedRoomCount: 1,
        anonymizedGameStateCount: 1,
        anonymizedGameHistoryCount: 2,
        removedAvatarObjectCount: 1,
      },
    });
    expect(authService.invalidateUser).toHaveBeenCalledWith('user-1');
  });
});
