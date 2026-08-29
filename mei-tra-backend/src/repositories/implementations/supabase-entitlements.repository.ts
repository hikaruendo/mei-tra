/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';
import type { EntitlementSource } from '@contracts/monetization';
import { SupabaseService } from '../../database/supabase.service';
import type {
  EntitlementRecord,
  UpsertEntitlementInput,
} from '../../types/monetization.types';
import type { IEntitlementsRepository } from '../interfaces/entitlements.repository.interface';

interface EntitlementRow {
  id: string;
  user_id: string;
  entitlement: string;
  source: EntitlementSource;
  product_id: string | null;
  rc_app_user_id: string | null;
  will_renew: boolean;
  expires_at: string | null;
  granted_at: string;
  updated_at: string;
}

@Injectable()
export class SupabaseEntitlementsRepository implements IEntitlementsRepository {
  private readonly logger = new Logger(SupabaseEntitlementsRepository.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private get supabase() {
    return this.supabaseService.client as any;
  }

  async upsert(input: UpsertEntitlementInput): Promise<EntitlementRecord> {
    const { data, error } = await this.supabase
      .from('entitlements')
      .upsert(
        {
          user_id: input.userId,
          entitlement: input.entitlement,
          source: input.source,
          product_id: input.productId,
          rc_app_user_id: input.rcAppUserId,
          will_renew: input.willRenew,
          expires_at: input.expiresAt,
        },
        { onConflict: 'user_id,entitlement' },
      )
      .select('*')
      .single();

    if (error) {
      this.logger.error('Failed to upsert entitlement', error);
      throw error;
    }

    return this.mapRowToEntitlement(data as EntitlementRow);
  }

  async findActiveByUserId(userId: string): Promise<EntitlementRecord[]> {
    const { data, error } = await this.supabase
      .from('entitlements')
      .select('*')
      .eq('user_id', userId)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

    if (error) {
      this.logger.error('Failed to load entitlements', error);
      throw error;
    }

    return ((data ?? []) as EntitlementRow[]).map((row) =>
      this.mapRowToEntitlement(row),
    );
  }

  async deleteByUserId(userId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('entitlements')
      .delete()
      .eq('user_id', userId)
      .select('id');

    if (error) {
      this.logger.error('Failed to delete entitlements', error);
      throw error;
    }

    return ((data ?? []) as { id: string }[]).length;
  }

  private mapRowToEntitlement(row: EntitlementRow): EntitlementRecord {
    return {
      id: row.id,
      userId: row.user_id,
      entitlement: row.entitlement,
      source: row.source,
      productId: row.product_id,
      rcAppUserId: row.rc_app_user_id,
      willRenew: row.will_renew,
      expiresAt: row.expires_at,
      grantedAt: row.granted_at,
      updatedAt: row.updated_at,
    };
  }
}
