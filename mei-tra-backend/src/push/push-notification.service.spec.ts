import type { IPushTokenRepository } from '../repositories/interfaces/push-token.repository.interface';
import type { PushTokenRecord } from '../types/push.types';
import type { ExpoPushMessage, IExpoPushClient } from './expo-push.client';
import { PushNotificationService } from './push-notification.service';

const token = (overrides: Partial<PushTokenRecord> = {}): PushTokenRecord => ({
  id: 'token-id',
  userId: 'user-id',
  deviceId: 'device-id',
  platform: 'ios',
  expoPushToken: 'ExpoPushToken[abc123]',
  appVersion: '1.0.0',
  createdAt: '2026-07-23T00:00:00.000Z',
  updatedAt: '2026-07-23T00:00:00.000Z',
  lastSeenAt: '2026-07-23T00:00:00.000Z',
  ...overrides,
});

const message = {
  title: 'Title',
  body: 'Body',
  data: { type: 'example', roomId: 'room-1' },
};

describe('PushNotificationService', () => {
  let repository: jest.Mocked<IPushTokenRepository>;
  let client: jest.Mocked<IExpoPushClient>;
  let service: PushNotificationService;

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
    client = { send: jest.fn(), getReceipts: jest.fn() };
    service = new PushNotificationService(repository, client);
  });

  it('deduplicates users and sends the message to each token', async () => {
    repository.findByUserIds.mockResolvedValue([token()]);
    client.send.mockResolvedValue([
      {
        token: token().expoPushToken,
        status: 'ok',
        ticketId: 'receipt-1',
      },
    ]);

    const result = await service.sendToUsers(['user-id', 'user-id'], message);

    expect(repository.findByUserIds).toHaveBeenCalledWith(['user-id']);
    expect(client.send).toHaveBeenCalledWith([
      expect.objectContaining({
        to: 'ExpoPushToken[abc123]',
        sound: 'default',
        ...message,
      }),
    ] satisfies ExpoPushMessage[]);
    expect(repository.upsertReceipts).toHaveBeenCalledWith([
      expect.objectContaining({
        receiptId: 'receipt-1',
        pushTokenId: 'token-id',
        userId: 'user-id',
        deviceId: 'device-id',
        expoPushToken: 'ExpoPushToken[abc123]',
      }),
    ]);
    expect(client.getReceipts).not.toHaveBeenCalled();
    expect(result).toEqual({
      targetedTokenCount: 1,
      acceptedTokenCount: 1,
      rejectedTokenCount: 0,
      invalidTokenCount: 0,
      removedTokenCount: 0,
    });
  });

  it('removes tokens that Expo reports as not registered', async () => {
    const invalidToken = token({ expoPushToken: 'ExponentPushToken[invalid]' });
    repository.findByUserIds.mockResolvedValue([invalidToken]);
    client.send.mockResolvedValue([
      {
        token: invalidToken.expoPushToken,
        status: 'error',
        error: 'DeviceNotRegistered',
      },
    ]);
    repository.deleteByExpoPushToken.mockResolvedValue(1);

    const result = await service.sendToUsers(['user-id'], message);

    expect(repository.deleteByExpoPushToken).toHaveBeenCalledWith(
      invalidToken.expoPushToken,
    );
    expect(result.invalidTokenCount).toBe(1);
    expect(result.removedTokenCount).toBe(1);
    expect(result.rejectedTokenCount).toBe(1);
  });

  it('does not throw when Expo is unavailable', async () => {
    repository.findByUserIds.mockResolvedValue([token()]);
    client.send.mockRejectedValue(new Error('network down'));

    await expect(
      service.sendToUsers(['user-id'], message),
    ).resolves.toMatchObject({
      targetedTokenCount: 1,
      acceptedTokenCount: 0,
      rejectedTokenCount: 1,
    });
  });

  it('persists tickets without starting receipt polling in the gameplay flow', async () => {
    repository.findByUserIds.mockResolvedValue([token()]);
    repository.upsertReceipts.mockResolvedValue(undefined);
    client.send.mockResolvedValue([
      {
        token: token().expoPushToken,
        status: 'ok',
        ticketId: 'receipt-async',
      },
    ]);
    await expect(
      service.sendToUsers(['user-id'], message),
    ).resolves.toMatchObject({ targetedTokenCount: 1 });
    expect(repository.upsertReceipts).toHaveBeenCalledTimes(1);
    expect(client.getReceipts).not.toHaveBeenCalled();
  });

  it('does not throw or send when token loading fails', async () => {
    repository.findByUserIds.mockRejectedValue(new Error('database down'));

    await expect(service.sendToUsers(['user-id'], message)).resolves.toEqual({
      targetedTokenCount: 0,
      acceptedTokenCount: 0,
      rejectedTokenCount: 0,
      invalidTokenCount: 0,
      removedTokenCount: 0,
    });
    expect(client.send).not.toHaveBeenCalled();
  });

  it('reports invalid tokens even when cleanup fails', async () => {
    const invalidToken = token({ expoPushToken: 'ExpoPushToken[invalid]' });
    repository.findByUserIds.mockResolvedValue([invalidToken]);
    client.send.mockResolvedValue([
      {
        token: invalidToken.expoPushToken,
        status: 'error',
        error: 'DeviceNotRegistered',
      },
    ]);
    repository.deleteByExpoPushToken.mockRejectedValue(
      new Error('delete failed'),
    );

    await expect(
      service.sendToUsers(['user-id'], message),
    ).resolves.toMatchObject({
      targetedTokenCount: 1,
      acceptedTokenCount: 0,
      rejectedTokenCount: 1,
      invalidTokenCount: 1,
      removedTokenCount: 0,
    });
  });
});
