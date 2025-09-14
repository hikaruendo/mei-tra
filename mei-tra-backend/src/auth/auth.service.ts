import { Injectable, Logger, Inject } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import { IUserProfileRepository } from '../repositories/interfaces/user-profile.repository.interface';
import { AuthenticatedUser, UserProfile } from '../types/user.types';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly supabase: SupabaseService,
    @Inject('IUserProfileRepository')
    private readonly userProfileRepository: IUserProfileRepository,
  ) {}

  async validateToken(token: string): Promise<AuthenticatedUser | null> {
    try {
      // Verify JWT token with Supabase
      const { data: user, error } =
        await this.supabase.client.auth.getUser(token);

      if (error || !user.user) {
        this.logger.warn('Invalid or expired token');
        return null;
      }

      // Get user profile from database
      const profile = await this.userProfileRepository.findById(user.user.id);

      if (!profile) {
        this.logger.warn(`User profile not found for user ${user.user.id}`);
        return null;
      }

      // Update last seen timestamp
      await this.userProfileRepository.updateLastSeen(user.user.id);

      return {
        id: user.user.id,
        email: user.user.email,
        profile,
      };
    } catch (error) {
      this.logger.error('Error validating token:', error);
      return null;
    }
  }

  extractTokenFromAuthHeader(authHeader: string): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }

  async createOrUpdateUserProfile(
    userId: string,
    email?: string,
    metadata?: Record<string, unknown>,
  ): Promise<UserProfile> {
    // Check if profile already exists
    let profile = await this.userProfileRepository.findById(userId);

    if (!profile) {
      // Create new profile
      const username =
        (metadata?.username as string) ||
        email?.split('@')[0] ||
        `user_${userId.substring(0, 8)}`;

      const displayName =
        (metadata?.display_name as string) ||
        (metadata?.full_name as string) ||
        username;

      profile = await this.userProfileRepository.create(userId, {
        username,
        displayName,
        avatarUrl: metadata?.avatar_url as string,
      });
    }

    return profile;
  }

  async getUserFromSocketToken(
    token: string,
  ): Promise<AuthenticatedUser | null> {
    try {
      if (!token) {
        return null;
      }

      // For WebSocket connections, token might be passed directly
      return await this.validateToken(token);
    } catch (error) {
      this.logger.error('Error getting user from socket token:', error);
      return null;
    }
  }
}
