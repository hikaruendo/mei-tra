import type {
  EntitlementRecord,
  UpsertEntitlementInput,
} from '../../types/monetization.types';

export interface IEntitlementsRepository {
  upsert(input: UpsertEntitlementInput): Promise<EntitlementRecord>;
  findActiveByUserId(userId: string): Promise<EntitlementRecord[]>;
  deleteByUserId(userId: string): Promise<number>;
}
