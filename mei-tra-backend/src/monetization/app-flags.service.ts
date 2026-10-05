/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';
import type { AppFlagsResponse } from '@contracts/monetization';
import { SupabaseService } from '../database/supabase.service';

const CACHE_TTL_MS = 60_000;

@Injectable()
export class AppFlagsService {
  private readonly logger = new Logger(AppFlagsService.name);
  private cache: { flags: AppFlagsResponse; fetchedAt: number } | null = null;

  constructor(private readonly supabaseService: SupabaseService) {}

  // Every client polls this, so one row scan per minute is the ceiling.
  async getFlags(now: number = Date.now()): Promise<AppFlagsResponse> {
    if (this.cache && now - this.cache.fetchedAt < CACHE_TTL_MS) {
      return this.cache.flags;
    }

    const { data, error } = await (this.supabaseService.client as any)
      .from('app_flags')
      .select('key, value');

    if (error) {
      this.logger.error('Failed to load app flags', error);
      // Serve the stale copy when there is one; flags going missing must not
      // take the endpoint down.
      if (this.cache) {
        return this.cache.flags;
      }
      throw error;
    }

    const flags: AppFlagsResponse = {};
    for (const row of (data ?? []) as { key: string; value: unknown }[]) {
      flags[row.key] = row.value;
    }

    this.cache = { flags, fetchedAt: now };
    return flags;
  }
}
