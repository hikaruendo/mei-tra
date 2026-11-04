import type { IEntitlementsRepository } from '../repositories/interfaces/entitlements.repository.interface';
import type { EntitlementRecord } from '../types/monetization.types';
import { EntitlementsService } from './entitlements.service';
import type { ParsedRevenueCatEvent } from './revenuecat-webhook.validation';

const USER_ID = '11111111-2222-3333-4444-555555555555';
const OTHER_USER_ID = '66666666-7777-8888-9999-aaaaaaaaaaaa';

const baseEvent = (
  overrides: Partial<ParsedRevenueCatEvent>,
): ParsedRevenueCatEvent => ({
  type: 'INITIAL_PURCHASE',
  userId: USER_ID,
  rcAppUserId: USER_ID,
  entitlements: ['membership'],
  productId: 'meitra_membership_monthly',
  source: 'app_store',
  expiresAt: '2026-10-01T00:00:00.000Z',
  transferredFromUserIds: [],
  transferredToUserIds: [],
  ...overrides,
});

const record = (overrides: Partial<EntitlementRecord>): EntitlementRecord => ({
  id: 'row-1',
  userId: USER_ID,
  entitlement: 'membership',
  source: 'app_store',
  productId: 'meitra_membership_monthly',
  rcAppUserId: USER_ID,
  willRenew: true,
  expiresAt: '2026-10-01T00:00:00.000Z',
  grantedAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  ...overrides,
});

describe('EntitlementsService', () => {
  let repository: jest.Mocked<IEntitlementsRepository>;
  let service: EntitlementsService;

  beforeEach(() => {
    repository = {
      upsert: jest.fn().mockResolvedValue(record({})),
      findActiveByUserId: jest.fn().mockResolvedValue([]),
      deleteByUserId: jest.fn().mockResolvedValue(0),
    };
    service = new EntitlementsService(repository);
  });

  it.each(['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE'])(
    'grants with renewal on %s',
    async (type) => {
      await service.applyEvent(baseEvent({ type }));

      expect(repository.upsert).toHaveBeenCalledWith({
        userId: USER_ID,
        entitlement: 'membership',
        source: 'app_store',
        productId: 'meitra_membership_monthly',
        rcAppUserId: USER_ID,
        willRenew: true,
        expiresAt: '2026-10-01T00:00:00.000Z',
      });
    },
  );

  it('keeps access but stops renewal on CANCELLATION', async () => {
    await service.applyEvent(baseEvent({ type: 'CANCELLATION' }));

    expect(repository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        willRenew: false,
        expiresAt: '2026-10-01T00:00:00.000Z',
      }),
    );
  });

  it('records the expiration timestamp on EXPIRATION', async () => {
    await service.applyEvent(
      baseEvent({ type: 'EXPIRATION', expiresAt: '2026-09-15T00:00:00.000Z' }),
    );

    expect(repository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        willRenew: false,
        expiresAt: '2026-09-15T00:00:00.000Z',
      }),
    );
  });

  it('ignores events without a mapped Supabase user', async () => {
    await service.applyEvent(
      baseEvent({ userId: null, rcAppUserId: '$RCAnonymousID:abc' }),
    );

    expect(repository.upsert).not.toHaveBeenCalled();
  });

  it('ignores unknown event types', async () => {
    await service.applyEvent(baseEvent({ type: 'BILLING_ISSUE' }));

    expect(repository.upsert).not.toHaveBeenCalled();
  });

  it('moves active grants on TRANSFER', async () => {
    repository.findActiveByUserId.mockResolvedValue([record({})]);

    await service.applyEvent(
      baseEvent({
        type: 'TRANSFER',
        userId: null,
        rcAppUserId: OTHER_USER_ID,
        entitlements: [],
        transferredFromUserIds: [USER_ID],
        transferredToUserIds: [OTHER_USER_ID],
      }),
    );

    expect(repository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: OTHER_USER_ID,
        entitlement: 'membership',
      }),
    );
    expect(repository.deleteByUserId).toHaveBeenCalledWith(USER_ID);
  });

  it('still revokes the source user when a TRANSFER has no destination', async () => {
    repository.findActiveByUserId.mockResolvedValue([record({})]);

    await service.applyEvent(
      baseEvent({
        type: 'TRANSFER',
        userId: null,
        entitlements: [],
        transferredFromUserIds: [USER_ID],
        transferredToUserIds: [],
      }),
    );

    expect(repository.upsert).not.toHaveBeenCalled();
    expect(repository.deleteByUserId).toHaveBeenCalledWith(USER_ID);
  });
});
