import type { EntitlementSource } from '@contracts/monetization';

export interface EntitlementRecord {
  id: string;
  userId: string;
  entitlement: string;
  source: EntitlementSource;
  productId: string | null;
  rcAppUserId: string | null;
  willRenew: boolean;
  expiresAt: string | null;
  grantedAt: string;
  updatedAt: string;
}

export interface UpsertEntitlementInput {
  userId: string;
  entitlement: string;
  source: EntitlementSource;
  productId: string | null;
  rcAppUserId: string | null;
  willRenew: boolean;
  expiresAt: string | null;
}
