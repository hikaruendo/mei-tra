import { Injectable } from '@nestjs/common';

const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS_API_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const EXPO_BATCH_SIZE = 100;
const EXPO_RECEIPT_BATCH_SIZE = 1_000;

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data: Record<string, string | number>;
  sound: 'default';
}

export interface ExpoPushSendResult {
  token: string;
  status: 'ok' | 'error';
  ticketId?: string;
  error?: string;
  message?: string;
}

export interface ExpoPushReceiptResult {
  receiptId: string;
  status: 'ok' | 'error';
  error?: string;
  message?: string;
}

export class ExpoPushApiError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'ExpoPushApiError';
  }
}

interface ExpoPushApiResponse {
  data?: Array<{
    status?: unknown;
    id?: unknown;
    message?: unknown;
    details?: { error?: unknown };
  }>;
}

interface ExpoPushReceiptApiResponse {
  data?: Record<
    string,
    {
      status?: unknown;
      message?: unknown;
      details?: { error?: unknown };
    }
  >;
}

export interface IExpoPushClient {
  send(messages: ExpoPushMessage[]): Promise<ExpoPushSendResult[]>;
  getReceipts(receiptIds: readonly string[]): Promise<ExpoPushReceiptResult[]>;
}

@Injectable()
export class ExpoPushClient implements IExpoPushClient {
  async send(messages: ExpoPushMessage[]): Promise<ExpoPushSendResult[]> {
    const results: ExpoPushSendResult[] = [];

    for (let offset = 0; offset < messages.length; offset += EXPO_BATCH_SIZE) {
      const batch = messages.slice(offset, offset + EXPO_BATCH_SIZE);
      const response = await fetch(EXPO_PUSH_API_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batch),
      });

      if (!response.ok) {
        throw new ExpoPushApiError(
          `Expo push API returned HTTP ${response.status}`,
          response.status === 429 || response.status >= 500,
        );
      }

      let payload: ExpoPushApiResponse;
      try {
        payload = (await response.json()) as ExpoPushApiResponse;
      } catch (error) {
        throw new ExpoPushApiError(
          'Expo push API returned invalid JSON',
          true,
          error instanceof Error ? error : undefined,
        );
      }
      if (
        !Array.isArray(payload.data) ||
        payload.data.length !== batch.length
      ) {
        throw new ExpoPushApiError(
          'Expo push API returned an invalid ticket response',
          true,
        );
      }

      payload.data.forEach((ticket, index) => {
        const status = ticket.status === 'ok' ? 'ok' : 'error';
        if (status === 'ok' && typeof ticket.id !== 'string') {
          throw new ExpoPushApiError(
            'Expo push API returned an ok ticket without a receipt id',
            true,
          );
        }
        results.push({
          token: batch[index].to,
          status,
          ticketId: typeof ticket.id === 'string' ? ticket.id : undefined,
          error:
            typeof ticket.details?.error === 'string'
              ? ticket.details.error
              : undefined,
          message:
            typeof ticket.message === 'string' ? ticket.message : undefined,
        });
      });
    }

    return results;
  }

  async getReceipts(
    receiptIds: readonly string[],
  ): Promise<ExpoPushReceiptResult[]> {
    const results: ExpoPushReceiptResult[] = [];

    for (
      let offset = 0;
      offset < receiptIds.length;
      offset += EXPO_RECEIPT_BATCH_SIZE
    ) {
      const batch = receiptIds.slice(offset, offset + EXPO_RECEIPT_BATCH_SIZE);
      if (batch.length === 0) {
        continue;
      }

      let response: Response;
      try {
        response = await fetch(EXPO_RECEIPTS_API_URL, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ids: batch }),
        });
      } catch (error) {
        throw new ExpoPushApiError(
          'Expo receipt API request failed',
          true,
          error instanceof Error ? error : undefined,
        );
      }

      if (!response.ok) {
        throw new ExpoPushApiError(
          `Expo receipt API returned HTTP ${response.status}`,
          response.status === 429 || response.status >= 500,
        );
      }

      let payload: ExpoPushReceiptApiResponse;
      try {
        payload = (await response.json()) as ExpoPushReceiptApiResponse;
      } catch (error) {
        throw new ExpoPushApiError(
          'Expo receipt API returned invalid JSON',
          true,
          error instanceof Error ? error : undefined,
        );
      }

      if (!payload.data || typeof payload.data !== 'object') {
        throw new ExpoPushApiError(
          'Expo receipt API returned an invalid receipt response',
          true,
        );
      }

      batch.forEach((receiptId) => {
        const receipt = payload.data?.[receiptId];
        if (!receipt || typeof receipt !== 'object') {
          return;
        }

        results.push({
          receiptId,
          status: receipt.status === 'ok' ? 'ok' : 'error',
          error:
            typeof receipt.details?.error === 'string'
              ? receipt.details.error
              : undefined,
          message:
            typeof receipt.message === 'string' ? receipt.message : undefined,
        });
      });
    }

    return results;
  }
}
