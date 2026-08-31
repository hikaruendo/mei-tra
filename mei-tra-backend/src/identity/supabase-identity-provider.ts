import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import {
  DeleteIdentityResult,
  IIdentityProvider,
  VerifiedIdentity,
} from './interfaces/identity-provider.interface';

@Injectable()
export class SupabaseIdentityProvider implements IIdentityProvider {
  constructor(private readonly supabaseService: SupabaseService) {}

  async verifyAccessToken(token: string): Promise<VerifiedIdentity | null> {
    const { data, error } =
      await this.supabaseService.client.auth.getUser(token);
    if (error || !data.user) {
      return null;
    }

    return {
      id: data.user.id,
      email: data.user.email,
      isAnonymous: data.user.is_anonymous ?? false,
    };
  }

  async deleteUser(userId: string): Promise<DeleteIdentityResult> {
    const { error } = await this.supabaseService.client.auth.admin.deleteUser(
      userId,
      false,
    );
    if (!error) {
      return 'deleted';
    }

    if (
      error.status === 404 &&
      error.message.toLowerCase().includes('not found')
    ) {
      return 'not-found';
    }

    throw error;
  }
}
