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
      this.logger.debug(
        `[AuthService] Validating token with length: ${token?.length || 0}`,
      );

      // Verify JWT token with Supabase
      const { data: user, error } =
        await this.supabase.client.auth.getUser(token);

      if (error) {
        this.logger.warn(
          `[AuthService] Supabase auth error: ${error.message}`,
          {
            errorCode: error.name,
            tokenLength: token?.length || 0,
          },
        );
        return null;
      }

      if (!user.user) {
        this.logger.warn('[AuthService] No user data returned from Supabase');
        return null;
      }

      this.logger.debug(
        `[AuthService] Token validated for user: ${user.user.id}`,
      );

      // Get user profile from database, create if missing
      let profile = await this.userProfileRepository.findById(user.user.id);

      if (!profile) {
        this.logger.warn(
          `[AuthService] User profile not found for user ${user.user.id}, creating default profile`,
        );

        // Create profile using existing method
        try {
          profile = await this.createOrUpdateUserProfile(
            user.user.id,
            user.user.email,
            user.user.user_metadata,
          );
        } catch {
          this.logger.error(
            `[AuthService] Failed to create profile for user ${user.user.id}`,
          );
          return null;
        }
      }

      // Update last seen timestamp
      await this.userProfileRepository.updateLastSeen(user.user.id);

      this.logger.debug(
        `[AuthService] Successfully validated user: ${user.user.id} with profile: ${profile.displayName}`,
      );

      return {
        id: user.user.id,
        email: user.user.email,
        profile,
      };
    } catch (error: unknown) {
      const err = error as { message?: string; stack?: string } | undefined;
      this.logger.error(
        `[AuthService] Error validating token: ${err?.message}`,
        {
          error: err?.stack,
          tokenLength: token?.length || 0,
        },
      );
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
        this.logger.warn(
          '[AuthService] No token provided to getUserFromSocketToken',
        );
        return null;
      }

      this.logger.debug(
        `[AuthService] Getting user from socket token, length: ${token.length}`,
      );

      // For WebSocket connections, token might be passed directly
      const result = await this.validateToken(token);

      if (!result) {
        this.logger.warn('[AuthService] Token validation returned null');
      }

      return result;
    } catch (error: unknown) {
      const err = error as { message?: string; stack?: string } | undefined;
      this.logger.error(
        `[AuthService] Error getting user from socket token: ${err?.message}`,
        {
          error: err?.stack,
          tokenLength: token?.length || 0,
        },
      );
      return null;
    }
  }
}
