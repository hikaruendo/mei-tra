export const ENTITLEMENT_SOURCES = ["app_store", "play", "web", "promo"] as const;

export type EntitlementSource = (typeof ENTITLEMENT_SOURCES)[number];

export interface EntitlementContract {
  entitlement: string;
  source: EntitlementSource;
  willRenew: boolean;
  /** ISO timestamp; null means the grant does not expire. */
  expiresAt: string | null;
}

export interface EntitlementsMeResponse {
  entitlements: EntitlementContract[];
}

/** Server-owned runtime flags. Read known keys defensively. */
export type AppFlagsResponse = Record<string, unknown>;
