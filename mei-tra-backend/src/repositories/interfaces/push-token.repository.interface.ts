import type { RegisterPushTokenInput } from '@contracts/push';
import type {
  PushReceiptCompletionStatus,
  PushReceiptRecord,
  PushReceiptRegistration,
  PushTokenRecord,
} from '../../types/push.types';

export interface IPushTokenRepository {
  upsertForUser(
    userId: string,
    input: RegisterPushTokenInput,
  ): Promise<PushTokenRecord>;
  deleteForUser(
    userId: string,
    deviceId: string,
    platform: RegisterPushTokenInput['platform'],
  ): Promise<number>;
  findByUserIds(userIds: string[]): Promise<PushTokenRecord[]>;
  deleteByExpoPushToken(expoPushToken: string): Promise<number>;
  upsertReceipts(receipts: readonly PushReceiptRegistration[]): Promise<void>;
  claimPendingReceipts(input: {
    limit: number;
    workerId: string;
    lockSeconds: number;
  }): Promise<PushReceiptRecord[]>;
  rescheduleReceipt(input: {
    id: string;
    workerId: string;
    nextAttemptAt: string;
    providerErrorCode?: string;
  }): Promise<boolean>;
  completeReceipt(input: {
    id: string;
    workerId: string;
    status: PushReceiptCompletionStatus;
    providerErrorCode?: string;
  }): Promise<boolean>;
}
