import type { AuthenticatedUser } from '../types/user.types';
import type { IPushTokenRepository } from '../repositories/interfaces/push-token.repository.interface';
import { PushTokenController } from './push-token.controller';

describe('PushTokenController', () => {
  const user = { id: 'user-id' } as AuthenticatedUser;
  let repository: jest.Mocked<IPushTokenRepository>;
  let controller: PushTokenController;

  beforeEach(() => {
    repository = {
      upsertForUser: jest.fn(),
      deleteForUser: jest.fn(),
      findByUserIds: jest.fn(),
      deleteByExpoPushToken: jest.fn(),
      upsertReceipts: jest.fn(),
      claimPendingReceipts: jest.fn(),
      rescheduleReceipt: jest.fn(),
      completeReceipt: jest.fn(),
    };
    controller = new PushTokenController(repository);
  });

  it('registers only against the authenticated user', async () => {
    repository.upsertForUser.mockResolvedValue({
      id: 'registration-id',
      userId: user.id,
      deviceId: 'device-id',
      platform: 'ios',
      expoPushToken: 'ExpoPushToken[secret]',
      appVersion: '1.0.0',
      createdAt: '2026-07-23T00:00:00.000Z',
      updatedAt: '2026-07-23T00:00:00.000Z',
      lastSeenAt: '2026-07-23T00:00:00.000Z',
    });

    await expect(
      controller.register(user, {
        deviceId: 'device-id',
        platform: 'ios',
        expoPushToken: 'ExpoPushToken[secret]',
        appVersion: '1.0.0',
      }),
    ).resolves.toEqual({
      id: 'registration-id',
      deviceId: 'device-id',
      platform: 'ios',
      appVersion: '1.0.0',
      createdAt: '2026-07-23T00:00:00.000Z',
      updatedAt: '2026-07-23T00:00:00.000Z',
    });

    expect(repository.upsertForUser).toHaveBeenCalledWith(user.id, {
      deviceId: 'device-id',
      platform: 'ios',
      expoPushToken: 'ExpoPushToken[secret]',
      appVersion: '1.0.0',
    });
  });

  it('deletes only the authenticated user device registration', async () => {
    repository.deleteForUser.mockResolvedValue(1);

    await expect(
      controller.remove(user, 'device-id', 'android'),
    ).resolves.toEqual({ deleted: true });

    expect(repository.deleteForUser).toHaveBeenCalledWith(
      user.id,
      'device-id',
      'android',
    );
  });
});
