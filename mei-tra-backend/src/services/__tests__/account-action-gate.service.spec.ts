import { Socket } from 'socket.io';
import { AccountActionGateService } from '../account-action-gate.service';
import { AuthService } from '../../auth/auth.service';
import { IAccountStatusRepository } from '../../repositories/interfaces/user-profile.repository.interface';
import { AuthenticatedUser } from '../../types/user.types';

describe('AccountActionGateService', () => {
  const authenticatedUser: AuthenticatedUser = {
    id: 'user-1',
    email: 'user@example.com',
    isAnonymous: false,
    profile: {
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
    },
  };

  const createService = (
    overrides: {
      authService?: Partial<jest.Mocked<AuthService>>;
      repository?: Partial<jest.Mocked<IAccountStatusRepository>>;
    } = {},
  ) => {
    const authService = {
      getUserFromSocketToken: jest.fn(),
      ...overrides.authService,
    } as unknown as jest.Mocked<AuthService>;
    const repository = {
      isAccountActive: jest.fn().mockResolvedValue(true),
      ...overrides.repository,
    } as unknown as jest.Mocked<IAccountStatusRepository>;
    return {
      service: new AccountActionGateService(authService, repository),
      authService,
      repository,
    };
  };

  it('rejects a pre-authenticated socket after deletion starts', async () => {
    const { service, repository } = createService({
      repository: {
        isAccountActive: jest.fn().mockResolvedValue(false),
      },
    });
    const socket = {
      data: { user: authenticatedUser },
      handshake: { auth: {}, headers: {}, query: {} },
    } as unknown as Socket;

    await expect(
      service.ensureActiveSocketActor(socket, 'play a card'),
    ).resolves.toMatchObject({
      allowed: false,
      errorMessage:
        'Account deletion is in progress. Please finish deleting this account before continuing.',
    });
    expect(repository.isAccountActive).toHaveBeenCalledWith('user-1');
  });

  it('revalidates uncached socket auth without using stale token cache', async () => {
    const { service, authService } = createService({
      authService: {
        getUserFromSocketToken: jest.fn().mockResolvedValue(authenticatedUser),
      },
    });
    const socket = {
      data: {},
      handshake: { auth: { token: 'token' }, headers: {}, query: {} },
    } as unknown as Socket;

    await expect(
      service.ensureActiveSocketActor(socket, 'join room'),
    ).resolves.toMatchObject({
      allowed: true,
      authenticatedUser,
    });
    expect(authService.getUserFromSocketToken).toHaveBeenCalledWith('token', {
      bypassCache: true,
    });
  });
});
