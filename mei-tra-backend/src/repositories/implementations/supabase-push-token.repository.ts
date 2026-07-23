/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';
import type { RegisterPushTokenInput } from '@contracts/push';
import { SupabaseService } from '../../database/supabase.service';
import type {
  PushReceiptCompletionStatus,
  PushReceiptRecord,
  PushReceiptRegistration,
  PushTokenRecord,
} from '../../types/push.types';
import type { IPushTokenRepository } from '../interfaces/push-token.repository.interface';

interface PushTokenRow {
  id: string;
  user_id: string;
  device_id: string;
  platform: 'ios' | 'android';
  expo_push_token: string;
  app_version: string | null;
  created_at: string;
  updated_at: string;
  last_seen_at: string;
}

interface PushReceiptRow {
  id: string;
  expo_receipt_id: string;
  push_token_id: string | null;
  user_id: string;
  device_id: string;
  platform: 'ios' | 'android';
  expo_push_token: string;
  status: PushReceiptRecord['status'];
  attempt_count: number;
  next_attempt_at: string;
  worker_id: string | null;
  locked_until: string | null;
  provider_error_code: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class SupabasePushTokenRepository implements IPushTokenRepository {
  private readonly logger = new Logger(SupabasePushTokenRepository.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private get supabase() {
    return this.supabaseService.client as any;
  }

  async upsertForUser(
    userId: string,
    input: RegisterPushTokenInput,
  ): Promise<PushTokenRecord> {
    const { data, error } = await this.supabase.rpc('upsert_push_token', {
      p_user_id: userId,
      p_device_id: input.deviceId,
      p_platform: input.platform,
      p_expo_push_token: input.expoPushToken,
      p_app_version: input.appVersion ?? null,
    });

    if (error) {
      this.logger.error('Failed to upsert push token', error);
      throw error;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      throw new Error('Push token upsert returned no row');
    }

    return this.toRecord(row as PushTokenRow);
  }

  async deleteForUser(
    userId: string,
    deviceId: string,
    platform: RegisterPushTokenInput['platform'],
  ): Promise<number> {
    const { data, error } = await this.supabase
      .from('push_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('device_id', deviceId)
      .eq('platform', platform)
      .select('id');

    if (error) {
      this.logger.error('Failed to delete push token for user', error);
      throw error;
    }

    return Array.isArray(data) ? data.length : 0;
  }

  async findByUserIds(userIds: string[]): Promise<PushTokenRecord[]> {
    if (userIds.length === 0) {
      return [];
    }

    const { data, error } = await this.supabase
      .from('push_tokens')
      .select(
        'id,user_id,device_id,platform,expo_push_token,app_version,created_at,updated_at,last_seen_at',
      )
      .in('user_id', userIds);

    if (error) {
      this.logger.error('Failed to find push tokens for users', error);
      throw error;
    }

    return (data ?? []).map((row: PushTokenRow) => this.toRecord(row));
  }

  async deleteByExpoPushToken(expoPushToken: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('push_tokens')
      .delete()
      .eq('expo_push_token', expoPushToken)
      .select('id');

    if (error) {
      this.logger.error('Failed to delete invalid push token', error);
      throw error;
    }

    return Array.isArray(data) ? data.length : 0;
  }

  async upsertReceipts(
    receipts: readonly PushReceiptRegistration[],
  ): Promise<void> {
    if (receipts.length === 0) {
      return;
    }

    const rows = receipts.map((receipt) => ({
      expo_receipt_id: receipt.receiptId,
      push_token_id: receipt.pushTokenId,
      user_id: receipt.userId,
      device_id: receipt.deviceId,
      platform: receipt.platform,
      expo_push_token: receipt.expoPushToken,
    }));

    const { error } = await this.supabase
      .from('push_receipts')
      .upsert(rows, { onConflict: 'expo_receipt_id', ignoreDuplicates: true });

    if (!error) {
      return;
    }

    if (error.code !== '23503') {
      this.logger.error('Failed to persist Expo push receipts', error);
      throw error;
    }

    const { error: historicalReferenceError } = await this.supabase
      .from('push_receipts')
      .upsert(
        rows.map((row) => ({ ...row, push_token_id: null })),
        { onConflict: 'expo_receipt_id', ignoreDuplicates: true },
      );

    if (historicalReferenceError) {
      this.logger.error(
        'Failed to persist Expo push receipts without token row references',
        historicalReferenceError,
      );
      throw historicalReferenceError;
    }
  }

  async claimPendingReceipts(input: {
    limit: number;
    workerId: string;
    lockSeconds: number;
  }): Promise<PushReceiptRecord[]> {
    const { data, error } = await this.supabase.rpc('claim_push_receipts', {
      p_limit: input.limit,
      p_worker_id: input.workerId,
      p_lock_seconds: input.lockSeconds,
    });

    if (error) {
      this.logger.error('Failed to claim Expo push receipts', error);
      throw error;
    }

    return (data ?? []).map((row: PushReceiptRow) => this.toReceiptRecord(row));
  }

  async rescheduleReceipt(input: {
    id: string;
    workerId: string;
    nextAttemptAt: string;
    providerErrorCode?: string;
  }): Promise<boolean> {
    const { data, error } = await this.supabase.rpc('reschedule_push_receipt', {
      p_receipt_row_id: input.id,
      p_worker_id: input.workerId,
      p_next_attempt_at: input.nextAttemptAt,
      p_provider_error_code: input.providerErrorCode ?? null,
    });

    if (error) {
      this.logger.error('Failed to reschedule Expo push receipt', error);
      throw error;
    }

    return data === true;
  }

  async completeReceipt(input: {
    id: string;
    workerId: string;
    status: PushReceiptCompletionStatus;
    providerErrorCode?: string;
  }): Promise<boolean> {
    const { data, error } = await this.supabase.rpc('complete_push_receipt', {
      p_receipt_row_id: input.id,
      p_worker_id: input.workerId,
      p_status: input.status,
      p_provider_error_code: input.providerErrorCode ?? null,
    });

    if (error) {
      this.logger.error('Failed to complete Expo push receipt', error);
      throw error;
    }

    return data === true;
  }

  private toRecord(row: PushTokenRow): PushTokenRecord {
    return {
      id: row.id,
      userId: row.user_id,
      deviceId: row.device_id,
      platform: row.platform,
      expoPushToken: row.expo_push_token,
      appVersion: row.app_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastSeenAt: row.last_seen_at,
    };
  }

  private toReceiptRecord(row: PushReceiptRow): PushReceiptRecord {
    return {
      id: row.id,
      receiptId: row.expo_receipt_id,
      pushTokenId: row.push_token_id,
      userId: row.user_id,
      deviceId: row.device_id,
      platform: row.platform,
      expoPushToken: row.expo_push_token,
      status: row.status,
      attemptCount: row.attempt_count,
      nextAttemptAt: row.next_attempt_at,
      workerId: row.worker_id,
      lockedUntil: row.locked_until,
      providerErrorCode: row.provider_error_code,
      processedAt: row.processed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
