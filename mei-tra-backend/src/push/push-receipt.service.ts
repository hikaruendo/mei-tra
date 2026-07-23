import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { IPushTokenRepository } from '../repositories/interfaces/push-token.repository.interface';
import type { PushReceiptRecord } from '../types/push.types';
import {
  ExpoPushApiError,
  type ExpoPushReceiptResult,
  type IExpoPushClient,
} from './expo-push.client';

const RECEIPT_CLAIM_LIMIT = 100;
const RECEIPT_LOCK_SECONDS = 90;
const MAX_RECEIPT_ATTEMPTS = 8;
const RETRY_BACKOFF_MS = [
  5 * 60_000,
  15 * 60_000,
  30 * 60_000,
  60 * 60_000,
  120 * 60_000,
  240 * 60_000,
  480 * 60_000,
];

@Injectable()
export class PushReceiptService {
  private readonly logger = new Logger(PushReceiptService.name);
  private readonly workerId =
    `${hostname()}:${process.pid}:${randomUUID()}`.slice(0, 128);
  private inFlightPoll: Promise<void> | null = null;

  constructor(
    @Inject('PUSH_TOKEN_REPOSITORY')
    private readonly tokenRepository: IPushTokenRepository,
    @Inject('EXPO_PUSH_CLIENT')
    private readonly expoPushClient: IExpoPushClient,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async pollScheduledReceipts(): Promise<void> {
    await this.processPendingReceipts();
  }

  async processPendingReceipts(): Promise<void> {
    if (this.inFlightPoll) {
      return this.inFlightPoll;
    }

    const poll = this.processPendingReceiptsInternal();
    const trackedPoll = poll.finally(() => {
      this.inFlightPoll = null;
    });
    this.inFlightPoll = trackedPoll;
    return trackedPoll;
  }

  private async processPendingReceiptsInternal(): Promise<void> {
    let claimedReceipts: PushReceiptRecord[];
    try {
      claimedReceipts = await this.tokenRepository.claimPendingReceipts({
        limit: RECEIPT_CLAIM_LIMIT,
        workerId: this.workerId,
        lockSeconds: RECEIPT_LOCK_SECONDS,
      });
    } catch (error) {
      this.logger.error('Failed to claim Expo push receipts', error);
      return;
    }

    if (claimedReceipts.length === 0) {
      return;
    }

    let providerReceipts: ExpoPushReceiptResult[];
    try {
      providerReceipts = await this.expoPushClient.getReceipts(
        claimedReceipts.map((receipt) => receipt.receiptId),
      );
    } catch (error) {
      const providerErrorCode =
        error instanceof ExpoPushApiError && !error.retryable
          ? 'ExpoReceiptLookupRejected'
          : 'ExpoReceiptLookupRetryable';

      await Promise.allSettled(
        claimedReceipts.map((receipt) =>
          this.retryOrExpire(receipt, providerErrorCode),
        ),
      );
      return;
    }

    const receiptsById = new Map(
      providerReceipts.map((receipt) => [receipt.receiptId, receipt]),
    );

    await Promise.allSettled(
      claimedReceipts.map((receipt) =>
        this.processProviderReceipt(
          receipt,
          receiptsById.get(receipt.receiptId),
        ),
      ),
    );
  }

  private async processProviderReceipt(
    storedReceipt: PushReceiptRecord,
    providerReceipt: ExpoPushReceiptResult | undefined,
  ): Promise<void> {
    if (!providerReceipt) {
      await this.retryOrExpire(storedReceipt, 'ExpoReceiptNotReady');
      return;
    }

    if (providerReceipt.status === 'ok') {
      await this.complete(storedReceipt, 'delivered');
      return;
    }

    await this.complete(
      storedReceipt,
      'failed',
      this.normalizeProviderErrorCode(providerReceipt.error),
    );
  }

  private async retryOrExpire(
    receipt: PushReceiptRecord,
    providerErrorCode: string,
  ): Promise<void> {
    if (receipt.attemptCount >= MAX_RECEIPT_ATTEMPTS) {
      await this.complete(receipt, 'expired', 'ReceiptPollingExhausted');
      return;
    }

    const backoffIndex = Math.min(
      receipt.attemptCount - 1,
      RETRY_BACKOFF_MS.length - 1,
    );
    const nextAttemptAt = new Date(
      Date.now() + RETRY_BACKOFF_MS[Math.max(backoffIndex, 0)],
    ).toISOString();

    try {
      await this.tokenRepository.rescheduleReceipt({
        id: receipt.id,
        workerId: this.workerId,
        nextAttemptAt,
        providerErrorCode,
      });
    } catch (error) {
      this.logger.error(
        `Failed to reschedule Expo push receipt ${receipt.receiptId}`,
        error,
      );
    }
  }

  private async complete(
    receipt: PushReceiptRecord,
    status: 'delivered' | 'failed' | 'expired',
    providerErrorCode?: string,
  ): Promise<void> {
    try {
      await this.tokenRepository.completeReceipt({
        id: receipt.id,
        workerId: this.workerId,
        status,
        providerErrorCode,
      });
    } catch (error) {
      this.logger.error(
        `Failed to complete Expo push receipt ${receipt.receiptId}`,
        error,
      );
    }
  }

  private normalizeProviderErrorCode(errorCode?: string): string {
    if (
      errorCode &&
      errorCode.length <= 100 &&
      /^[A-Za-z0-9_.-]+$/.test(errorCode)
    ) {
      return errorCode;
    }

    return 'ExpoReceiptError';
  }
}
