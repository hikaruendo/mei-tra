import { Injectable, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import supabaseConfig from '../config/supabase.config';
import { Database } from '../types/database.types';

@Injectable()
export class SupabaseService {
  private supabase: SupabaseClient<Database>;

  constructor(
    @Inject(supabaseConfig.KEY)
    private config: ConfigType<typeof supabaseConfig>,
  ) {
    if (!this.config.url || !this.config.serviceRoleKey) {
      throw new Error(
        'Supabase configuration is missing. Please check your environment variables.',
      );
    }

    this.supabase = createClient<Database>(
      this.config.url,
      this.config.serviceRoleKey, // Use service role key for backend operations
    );
  }

  get client(): SupabaseClient<Database> {
    return this.supabase;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const { error } = await this.supabase.from('rooms').select('id').limit(1);
      return !error;
    } catch {
      return false;
    }
  }
}
