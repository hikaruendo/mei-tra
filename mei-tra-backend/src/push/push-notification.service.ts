import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
  GameStartedPushPayload,
  PushNotificationResult,
  TurnPushPayload,
} from '@contracts/push';
import type { IPushTokenRepository } from '../repositories/interfaces/push-token.repository.interface';
import type {
  PushReceiptRegistration,
  PushTokenRecord,
} from '../types/push.types';
import {
  type ExpoPushMessage,
  type ExpoPushSendResult,
  IExpoPushClient,
} from './expo-push.client';

export const PUSH_TOKEN_REPOSITORY = 'PUSH_TOKEN_REPOSITORY';
export const EXPO_PUSH_CLIENT = 'EXPO_PUSH_CLIENT';

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);

  constructor(
    @Inject(PUSH_TOKEN_REPOSITORY)
    private readonly tokenRepository: IPushTokenRepository,
    @Inject(EXPO_PUSH_CLIENT)
    private readonly expoPushClient: IExpoPushClient,
  ) {}

  async sendGameStarted(
    userIds: readonly string[],
    payload: GameStartedPushPayload,
  ): Promise<PushNotificationResult> {
    return this.sendToUsers(userIds, {
      title: 'Game started',
      body: 'Your Meitra game is ready.',
      data: {
        type: 'game-started',
        eventId: payload.eventId,
        roomId: payload.roomId,
        roundNumber: payload.roundNumber,
      },
    });
  }

  async sendTurnNotification(
    userIds: readonly string[],
    payload: TurnPushPayload,
  ): Promise<PushNotificationResult> {
    return this.sendToUsers(userIds, {
      title: "It's your turn",
      body: 'Open Meitra to continue the game.',
      data: {
        type: 'turn',
        eventId: payload.eventId,
        roomId: payload.roomId,
        roundNumber: payload.roundNumber,
        phase: payload.phase,
      },
    });
  }

  private async sendToUsers(
    userIds: readonly string[],
    message: Omit<ExpoPushMessage, 'to' | 'sound'>,
  ): Promise<PushNotificationResult> {
    const distinctUserIds = [...new Set(userIds)].filter(Boolean);
    if (distinctUserIds.length === 0) {
      return this.emptyResult();
    }

    let tokens: PushTokenRecord[];
    try {
      tokens = await this.tokenRepository.findByUserIds(distinctUserIds);
    } catch (error) {
      this.logger.error('Failed to load push tokens', error);
      return this.emptyResult();
    }

    const messages = tokens.map<ExpoPushMessage>((token) => ({
      ...message,
      to: token.expoPushToken,
      sound: 'default',
    }));

    if (messages.length === 0) {
      return this.emptyResult();
    }

    let tickets: ExpoPushSendResult[];
    try {
      tickets = await this.expoPushClient.send(messages);
    } catch (error) {
      this.logger.error('Failed to send Expo push notifications', error);
      return {
        ...this.emptyResult(),
        targetedTokenCount: messages.length,
        rejectedTokenCount: messages.length,
      };
    }

    const invalidTokens = [
      ...new Set(
        tickets
          .filter(
            (ticket) =>
              ticket.status === 'error' &&
              ticket.error === 'DeviceNotRegistered',
          )
          .map((ticket) => ticket.token),
      ),
    ];

    let removedTokenCount = 0;
    const cleanupResults = await Promise.allSettled(
      invalidTokens.map((token) =>
        this.tokenRepository.deleteByExpoPushToken(token),
      ),
    );
    cleanupResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        removedTokenCount += result.value;
      } else {
        this.logger.error(
          'Failed to clean up invalid push token',
          result.reason,
        );
      }
    });

    const tokensByExpoToken = new Map(
      tokens.map((token) => [token.expoPushToken, token]),
    );
    const receiptRegistrations: PushReceiptRegistration[] = tickets.flatMap(
      (ticket) => {
        if (ticket.status !== 'ok' || !ticket.ticketId) {
          return [];
        }

        const token = tokensByExpoToken.get(ticket.token);
        if (!token) {
          this.logger.warn(
            `Received Expo receipt ${ticket.ticketId} for an unknown push token`,
          );
          return [];
        }

        return [
          {
            receiptId: ticket.ticketId,
            pushTokenId: token.id,
            userId: token.userId,
            deviceId: token.deviceId,
            platform: token.platform,
            expoPushToken: token.expoPushToken,
          },
        ];
      },
    );

    if (receiptRegistrations.length > 0) {
      try {
        await this.tokenRepository.upsertReceipts(receiptRegistrations);
      } catch (error) {
        this.logger.error('Failed to persist Expo push receipts', error);
      }
    }

    const acceptedTokenCount = tickets.filter(
      (ticket) => ticket.status === 'ok',
    ).length;
    const rejectedTokenCount = tickets.length - acceptedTokenCount;

    return {
      targetedTokenCount: messages.length,
      acceptedTokenCount,
      rejectedTokenCount,
      invalidTokenCount: invalidTokens.length,
      removedTokenCount,
    };
  }

  private emptyResult(): PushNotificationResult {
    return {
      targetedTokenCount: 0,
      acceptedTokenCount: 0,
      rejectedTokenCount: 0,
      invalidTokenCount: 0,
      removedTokenCount: 0,
    };
  }
}
