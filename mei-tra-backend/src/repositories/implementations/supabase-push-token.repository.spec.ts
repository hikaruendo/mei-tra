import type { RegisterPushTokenInput } from '@contracts/push';
import { SupabaseService } from '../../database/supabase.service';
import { SupabasePushTokenRepository } from './supabase-push-token.repository';

describe('SupabasePushTokenRepository', () => {
  it('uses the atomic registration RPC and maps its row', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: {
        id: 'registration-id',
        user_id: 'user-id',
        device_id: 'device-id',
        platform: 'ios',
        expo_push_token: 'ExpoPushToken[token]',
        app_version: '1.0.0',
        created_at: '2026-07-23T00:00:00.000Z',
        updated_at: '2026-07-23T00:00:00.000Z',
        last_seen_at: '2026-07-23T00:00:00.000Z',
      },
      error: null,
    });
    const repository = new SupabasePushTokenRepository({
      client: { rpc },
    } as unknown as SupabaseService);
    const input: RegisterPushTokenInput = {
      deviceId: 'device-id',
      platform: 'ios',
      expoPushToken: 'ExpoPushToken[token]',
      appVersion: '1.0.0',
    };

    await expect(repository.upsertForUser('user-id', input)).resolves.toEqual({
      id: 'registration-id',
      userId: 'user-id',
      deviceId: 'device-id',
      platform: 'ios',
      expoPushToken: 'ExpoPushToken[token]',
      appVersion: '1.0.0',
      createdAt: '2026-07-23T00:00:00.000Z',
      updatedAt: '2026-07-23T00:00:00.000Z',
      lastSeenAt: '2026-07-23T00:00:00.000Z',
    });

    expect(rpc).toHaveBeenCalledWith('upsert_push_token', {
      p_user_id: 'user-id',
      p_device_id: 'device-id',
      p_platform: 'ios',
      p_expo_push_token: 'ExpoPushToken[token]',
      p_app_version: '1.0.0',
    });
  });

  it('persists receipt identity without notification content', async () => {
    const upsert = jest.fn().mockResolvedValue({ error: null });
    const repository = new SupabasePushTokenRepository({
      client: {
        from: jest.fn().mockReturnValue({
          upsert,
        }),
      },
    } as unknown as SupabaseService);

    await repository.upsertReceipts([
      {
        receiptId: 'receipt-1',
        pushTokenId: 'token-id',
        userId: 'user-id',
        deviceId: 'device-id',
        platform: 'ios',
        expoPushToken: 'ExpoPushToken[token]',
      },
    ]);

    expect(upsert).toHaveBeenCalledWith(
      [
        {
          expo_receipt_id: 'receipt-1',
          push_token_id: 'token-id',
          user_id: 'user-id',
          device_id: 'device-id',
          platform: 'ios',
          expo_push_token: 'ExpoPushToken[token]',
        },
      ],
      { onConflict: 'expo_receipt_id', ignoreDuplicates: true },
    );
  });

  it('uses locked claim and completion RPCs for receipt processing', async () => {
    const rpc = jest
      .fn()
      .mockResolvedValueOnce({
        data: [
          {
            id: 'row-id',
            expo_receipt_id: 'receipt-1',
            push_token_id: 'token-id',
            user_id: 'user-id',
            device_id: 'device-id',
            platform: 'ios',
            expo_push_token: 'ExpoPushToken[token]',
            status: 'processing',
            attempt_count: 1,
            next_attempt_at: '2026-07-24T00:00:00.000Z',
            worker_id: 'worker-1',
            locked_until: '2026-07-24T00:01:30.000Z',
            provider_error_code: null,
            processed_at: null,
            created_at: '2026-07-24T00:00:00.000Z',
            updated_at: '2026-07-24T00:00:00.000Z',
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({ data: true, error: null });
    const repository = new SupabasePushTokenRepository({
      client: { rpc },
    } as unknown as SupabaseService);

    await expect(
      repository.claimPendingReceipts({
        limit: 100,
        workerId: 'worker-1',
        lockSeconds: 90,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'row-id',
        receiptId: 'receipt-1',
        userId: 'user-id',
        expoPushToken: 'ExpoPushToken[token]',
      }),
    ]);
    await expect(
      repository.completeReceipt({
        id: 'row-id',
        workerId: 'worker-1',
        status: 'failed',
        providerErrorCode: 'DeviceNotRegistered',
      }),
    ).resolves.toBe(true);

    expect(rpc).toHaveBeenNthCalledWith(1, 'claim_push_receipts', {
      p_limit: 100,
      p_worker_id: 'worker-1',
      p_lock_seconds: 90,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, 'complete_push_receipt', {
      p_receipt_row_id: 'row-id',
      p_worker_id: 'worker-1',
      p_status: 'failed',
      p_provider_error_code: 'DeviceNotRegistered',
    });
  });

  it('keeps receipt persistence when the historical token row disappeared', async () => {
    const upsert = jest
      .fn()
      .mockResolvedValueOnce({
        error: { code: '23503', message: 'push token no longer exists' },
      })
      .mockResolvedValueOnce({ error: null });
    const from = jest.fn().mockReturnValue({ upsert });
    const repository = new SupabasePushTokenRepository({
      client: { from },
    } as unknown as SupabaseService);

    await repository.upsertReceipts([
      {
        receiptId: 'receipt-2',
        pushTokenId: 'deleted-token-id',
        userId: 'user-id',
        deviceId: 'device-id',
        platform: 'ios',
        expoPushToken: 'ExpoPushToken[token-2]',
      },
    ]);

    expect(upsert).toHaveBeenNthCalledWith(
      2,
      [
        expect.objectContaining({
          expo_receipt_id: 'receipt-2',
          push_token_id: null,
          user_id: 'user-id',
          device_id: 'device-id',
          expo_push_token: 'ExpoPushToken[token-2]',
        }),
      ],
      { onConflict: 'expo_receipt_id', ignoreDuplicates: true },
    );
  });
});
