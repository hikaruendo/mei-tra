import type { PushPlatform } from '@contracts/push';

export type PushReceiptStatus =
  | 'pending'
  | 'processing'
  | 'delivered'
  | 'failed'
  | 'expired';

export type PushReceiptCompletionStatus = 'delivered' | 'failed' | 'expired';

export interface PushTokenRecord {
  id: string;
  userId: string;
  deviceId: string;
  platform: PushPlatform;
  expoPushToken: string;
  appVersion: string | null;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string;
}

export interface PushReceiptRegistration {
  receiptId: string;
  pushTokenId: string | null;
  userId: string;
  deviceId: string;
  platform: PushPlatform;
  expoPushToken: string;
}

export interface PushReceiptRecord extends PushReceiptRegistration {
  id: string;
  status: PushReceiptStatus;
  attemptCount: number;
  nextAttemptAt: string;
  workerId: string | null;
  lockedUntil: string | null;
  providerErrorCode: string | null;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
