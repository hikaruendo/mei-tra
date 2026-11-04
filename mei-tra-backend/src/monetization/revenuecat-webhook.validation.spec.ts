import { BadRequestException } from '@nestjs/common';
import { parseRevenueCatWebhook } from './revenuecat-webhook.validation';

const USER_ID = '11111111-2222-3333-4444-555555555555';

describe('revenuecat webhook validation', () => {
  it('parses a purchase event', () => {
    expect(
      parseRevenueCatWebhook({
        api_version: '1.0',
        event: {
          type: 'INITIAL_PURCHASE',
          app_user_id: USER_ID,
          entitlement_ids: ['membership'],
          product_id: 'meitra_membership_monthly',
          store: 'APP_STORE',
          expiration_at_ms: 1790000000000,
        },
      }),
    ).toEqual({
      type: 'INITIAL_PURCHASE',
      userId: USER_ID,
      rcAppUserId: USER_ID,
      entitlements: ['membership'],
      productId: 'meitra_membership_monthly',
      source: 'app_store',
      expiresAt: new Date(1790000000000).toISOString(),
      transferredFromUserIds: [],
      transferredToUserIds: [],
    });
  });

  it('keeps a RevenueCat anonymous id out of userId', () => {
    const parsed = parseRevenueCatWebhook({
      event: {
        type: 'RENEWAL',
        app_user_id: '$RCAnonymousID:abc123',
        entitlement_ids: ['membership'],
        store: 'PLAY_STORE',
      },
    });

    expect(parsed.userId).toBeNull();
    expect(parsed.rcAppUserId).toBe('$RCAnonymousID:abc123');
    expect(parsed.source).toBe('play');
    expect(parsed.expiresAt).toBeNull();
  });

  it('falls back to the legacy entitlement_id field', () => {
    expect(
      parseRevenueCatWebhook({
        event: {
          type: 'EXPIRATION',
          app_user_id: USER_ID,
          entitlement_id: 'membership',
          store: 'STRIPE',
        },
      }).entitlements,
    ).toEqual(['membership']);
  });

  it('maps transfer arrays to Supabase user ids only', () => {
    const parsed = parseRevenueCatWebhook({
      event: {
        type: 'TRANSFER',
        transferred_from: ['$RCAnonymousID:zzz', USER_ID],
        transferred_to: ['66666666-7777-8888-9999-aaaaaaaaaaaa'],
      },
    });

    expect(parsed.transferredFromUserIds).toEqual([USER_ID]);
    expect(parsed.transferredToUserIds).toEqual([
      '66666666-7777-8888-9999-aaaaaaaaaaaa',
    ]);
  });

  it('rejects bodies without an event object', () => {
    expect(() => parseRevenueCatWebhook({})).toThrow(BadRequestException);
    expect(() => parseRevenueCatWebhook('nope')).toThrow(BadRequestException);
    expect(() =>
      parseRevenueCatWebhook({ event: { app_user_id: USER_ID } }),
    ).toThrow(BadRequestException);
  });

  it('treats an unknown store as promo', () => {
    expect(
      parseRevenueCatWebhook({
        event: {
          type: 'INITIAL_PURCHASE',
          app_user_id: USER_ID,
          entitlement_ids: ['membership'],
          store: 'AMAZON',
        },
      }).source,
    ).toBe('promo');
  });
});
