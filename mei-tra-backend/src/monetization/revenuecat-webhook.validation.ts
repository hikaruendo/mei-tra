import { BadRequestException } from '@nestjs/common';
import type { EntitlementSource } from '@contracts/monetization';

// The event types the service acts on. Anything else is acknowledged and
// logged — RevenueCat retries on 5xx, so an unknown type must not error.
export const REVENUECAT_GRANT_EVENTS = [
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'NON_RENEWING_PURCHASE',
  'PRODUCT_CHANGE',
] as const;

export type RevenueCatGrantEventType = (typeof REVENUECAT_GRANT_EVENTS)[number];

export interface ParsedRevenueCatEvent {
  /** Known values include the grant events plus CANCELLATION, EXPIRATION and
   *  TRANSFER; unknown types flow through and are ignored downstream. */
  type: string;
  /** Supabase user id, when app_user_id is one. */
  userId: string | null;
  rcAppUserId: string | null;
  entitlements: string[];
  productId: string | null;
  source: EntitlementSource;
  /** ISO timestamp or null when the grant has no expiration. */
  expiresAt: string | null;
  transferredFromUserIds: string[];
  transferredToUserIds: string[];
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const asObject = (value: unknown, label: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException(`${label} must be an object`);
  }

  return value as Record<string, unknown>;
};

const optionalText = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

const textArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];

export const asSupabaseUserId = (value: string | null): string | null =>
  value !== null && UUID_PATTERN.test(value) ? value : null;

const toIso = (value: unknown): string | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return new Date(value).toISOString();
};

const SOURCE_BY_STORE: Record<string, EntitlementSource> = {
  APP_STORE: 'app_store',
  MAC_APP_STORE: 'app_store',
  PLAY_STORE: 'play',
  STRIPE: 'web',
  RC_BILLING: 'web',
  PROMOTIONAL: 'promo',
};

const toSource = (value: unknown): EntitlementSource =>
  (typeof value === 'string' && SOURCE_BY_STORE[value]) || 'promo';

export const parseRevenueCatWebhook = (
  value: unknown,
): ParsedRevenueCatEvent => {
  const body = asObject(value, 'Request body');
  const event = asObject(body.event, 'event');

  const type = event.type;
  if (typeof type !== 'string' || type.length === 0) {
    throw new BadRequestException('event.type must be a string');
  }

  const rcAppUserId = optionalText(event.app_user_id);
  const entitlements = textArray(event.entitlement_ids);
  const legacyEntitlement = optionalText(event.entitlement_id);
  if (entitlements.length === 0 && legacyEntitlement !== null) {
    entitlements.push(legacyEntitlement);
  }

  return {
    type,
    userId: asSupabaseUserId(rcAppUserId),
    rcAppUserId,
    entitlements,
    productId: optionalText(event.product_id),
    source: toSource(event.store),
    expiresAt: toIso(event.expiration_at_ms),
    transferredFromUserIds: textArray(event.transferred_from)
      .map((id) => asSupabaseUserId(id))
      .filter((id): id is string => id !== null),
    transferredToUserIds: textArray(event.transferred_to)
      .map((id) => asSupabaseUserId(id))
      .filter((id): id is string => id !== null),
  };
};
