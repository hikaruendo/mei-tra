import type { IPushTokenRepository } from '../repositories/interfaces/push-token.repository.interface';
import type { PushReceiptRecord } from '../types/push.types';
import { ExpoPushApiError, type IExpoPushClient } from './expo-push.client';
import { PushReceiptService } from './push-receipt.service';

const receipt = (
  overrides: Partial<PushReceiptRecord> = {},
): PushReceiptRecord => ({
  id: 'row-1',
  receiptId: 'expo-receipt-1',
  pushTokenId: 'token-1',
  userId: 'user-1',
  deviceId: 'device-1',
  platform: 'ios',
  expoPushToken: 'ExpoPushToken[abc123]',
  status: 'processing',
  attemptCount: 1,
  nextAttemptAt: '2026-07-24T00:00:00.000Z',
  workerId: null,
  lockedUntil: '2026-07-24T00:01:30.000Z',
  providerErrorCode: null,
  processedAt: null,
  createdAt: '2026-07-24T00:00:00.000Z',
  updatedAt: '2026-07-24T00:00:00.000Z',
  ...overrides,
});

describe('PushReceiptService', () => {
  const now = new Date('2026-07-24T00:00:00.000Z');
  let repository: jest.Mocked<IPushTokenRepository>;
  let client: jest.Mocked<IExpoPushClient>;
  let service: PushReceiptService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
    repository = {
      upsertForUser: jest.fn(),
      deleteForUser: jest.fn(),
      findByUserIds: jest.fn(),
      deleteByExpoPushToken: jest.fn(),
      upsertReceipts: jest.fn(),
      claimPendingReceipts: jest.fn(),
      rescheduleReceipt: jest.fn().mockResolvedValue(true),
      completeReceipt: jest.fn().mockResolvedValue(true),
    };
    client = {
      send: jest.fn(),
      getReceipts: jest.fn(),
    };
    service = new PushReceiptService(repository, client);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('completes delayed DeviceNotRegistered receipts for atomic token cleanup', async () => {
    repository.claimPendingReceipts.mockResolvedValue([receipt()]);
    client.getReceipts.mockResolvedValue([
      {
        receiptId: 'expo-receipt-1',
        status: 'error',
        error: 'DeviceNotRegistered',
      },
    ]);

    await service.processPendingReceipts();

    expect(repository.completeReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'row-1',
        status: 'failed',
        providerErrorCode: 'DeviceNotRegistered',
      }),
    );
    expect(repository.deleteByExpoPushToken).not.toHaveBeenCalled();
  });

  it('retries a missing first receipt five minutes after the 15-minute poll', async () => {
    repository.claimPendingReceipts.mockResolvedValue([receipt()]);
    client.getReceipts.mockResolvedValue([]);

    await service.processPendingReceipts();

    expect(repository.rescheduleReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'row-1',
        providerErrorCode: 'ExpoReceiptNotReady',
        nextAttemptAt: '2026-07-24T00:05:00.000Z',
      }),
    );
    expect(repository.completeReceipt).not.toHaveBeenCalled();
  });

  it('keeps transient receipt lookup failures retryable through attempt seven', async () => {
    repository.claimPendingReceipts.mockResolvedValue([
      receipt({ attemptCount: 7 }),
    ]);
    client.getReceipts.mockRejectedValue(
      new ExpoPushApiError('temporary', true),
    );

    await service.processPendingReceipts();

    expect(repository.rescheduleReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        providerErrorCode: 'ExpoReceiptLookupRetryable',
        nextAttemptAt: '2026-07-24T08:00:00.000Z',
      }),
    );
    expect(repository.completeReceipt).not.toHaveBeenCalled();
  });

  it('expires missing or transient receipts on attempt eight', async () => {
    repository.claimPendingReceipts.mockResolvedValue([
      receipt({ attemptCount: 8 }),
    ]);
    client.getReceipts.mockResolvedValue([]);

    await service.processPendingReceipts();

    expect(repository.completeReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'expired',
        providerErrorCode: 'ReceiptPollingExhausted',
      }),
    );
  });

  it('does not overlap polls in one instance', async () => {
    let releaseClaim: (() => void) | undefined;
    repository.claimPendingReceipts.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseClaim = () => resolve([]);
        }),
    );

    const firstPoll = service.processPendingReceipts();
    const secondPoll = service.processPendingReceipts();

    expect(repository.claimPendingReceipts).toHaveBeenCalledTimes(1);
    releaseClaim?.();
    await Promise.all([firstPoll, secondPoll]);
  });

  it('does not retry non-retryable receipt lookup failures forever', async () => {
    repository.claimPendingReceipts.mockResolvedValue([receipt()]);
    client.getReceipts.mockRejectedValue(
      new ExpoPushApiError('invalid request', false),
    );

    await service.processPendingReceipts();

    expect(repository.rescheduleReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        providerErrorCode: 'ExpoReceiptLookupRejected',
      }),
    );
  });
});
