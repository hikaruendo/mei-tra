import { Inject, Injectable, Logger } from '@nestjs/common';
import type { IEntitlementsRepository } from '../repositories/interfaces/entitlements.repository.interface';
import type { EntitlementRecord } from '../types/monetization.types';
import {
  REVENUECAT_GRANT_EVENTS,
  type ParsedRevenueCatEvent,
  type RevenueCatGrantEventType,
} from './revenuecat-webhook.validation';

export const ENTITLEMENTS_REPOSITORY = Symbol('ENTITLEMENTS_REPOSITORY');

@Injectable()
export class EntitlementsService {
  private readonly logger = new Logger(EntitlementsService.name);

  constructor(
    @Inject(ENTITLEMENTS_REPOSITORY)
    private readonly repository: IEntitlementsRepository,
  ) {}

  findActiveForUser(userId: string): Promise<EntitlementRecord[]> {
    return this.repository.findActiveByUserId(userId);
  }

  async applyEvent(event: ParsedRevenueCatEvent): Promise<void> {
    if (event.type === 'TRANSFER') {
      await this.applyTransfer(event);
      return;
    }

    if (event.userId === null) {
      // RevenueCat anonymous ids ($RCAnonymousID:...) cannot be tied to an
      // account. The mobile app logs purchases in under the Supabase user id,
      // so these should not occur; acknowledge and keep the evidence in logs.
      this.logger.warn(
        `Ignoring ${event.type} for unmapped app_user_id ${event.rcAppUserId ?? '(none)'}`,
      );
      return;
    }

    if (this.isGrantEvent(event.type)) {
      await this.upsertAll(event, event.userId, true);
      return;
    }

    if (event.type === 'CANCELLATION') {
      // Auto-renew turned off; access continues until expires_at.
      await this.upsertAll(event, event.userId, false);
      return;
    }

    if (event.type === 'EXPIRATION') {
      await this.upsertAll(event, event.userId, false);
      return;
    }

    this.logger.log(`Ignoring RevenueCat event type ${event.type}`);
  }

  private isGrantEvent(type: string): type is RevenueCatGrantEventType {
    return (REVENUECAT_GRANT_EVENTS as readonly string[]).includes(type);
  }

  private async upsertAll(
    event: ParsedRevenueCatEvent,
    userId: string,
    willRenew: boolean,
  ): Promise<void> {
    if (event.entitlements.length === 0) {
      this.logger.warn(`${event.type} event carried no entitlement ids`);
      return;
    }

    for (const entitlement of event.entitlements) {
      await this.repository.upsert({
        userId,
        entitlement,
        source: event.source,
        productId: event.productId,
        rcAppUserId: event.rcAppUserId,
        willRenew,
        expiresAt: event.expiresAt,
      });
    }
  }

  private async applyTransfer(event: ParsedRevenueCatEvent): Promise<void> {
    const toUserId = event.transferredToUserIds[0] ?? null;

    for (const fromUserId of event.transferredFromUserIds) {
      const active = await this.repository.findActiveByUserId(fromUserId);

      if (toUserId !== null) {
        for (const record of active) {
          await this.repository.upsert({
            userId: toUserId,
            entitlement: record.entitlement,
            source: record.source,
            productId: record.productId,
            rcAppUserId: event.rcAppUserId ?? record.rcAppUserId,
            willRenew: record.willRenew,
            expiresAt: record.expiresAt,
          });
        }
      }

      await this.repository.deleteByUserId(fromUserId);
    }

    if (event.transferredFromUserIds.length === 0) {
      this.logger.warn('TRANSFER event carried no mappable source user');
    }
  }
}
