import {
  Injectable,
  Logger,
  Inject,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { IUserProfileRepository } from '../repositories/interfaces/user-profile.repository.interface';
import { AuthenticatedUser, UserProfile } from '../types/user.types';
import { IIdentityProvider } from '../identity/interfaces/identity-provider.interface';

interface CachedTokenValidation {
  user: AuthenticatedUser;
  expiresAt: number;
}

interface TokenValidationOptions {
  bypassCache?: boolean;
  allowDeletingAccount?: boolean;
}

@Injectable()
export class AuthService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuthService.name);
  private readonly tokenCache = new Map<string, CachedTokenValidation>();
  private readonly invalidatedUserIds = new Set<string>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 100;
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor(
    @Inject('IIdentityProvider')
    private readonly identityProvider: IIdentityProvider,
    @Inject('IUserProfileRepository')
    private readonly userProfileRepository: IUserProfileRepository,
  ) {}

  onModuleInit() {
    this.cleanupInterval = setInterval(
      () => this.cleanupExpiredCache(),
      5 * 60 * 1000,
    );
  }

  onModuleDestroy() {
    clearInterval(this.cleanupInterval);
  }

  async validateToken(
    token: string,
    options?: TokenValidationOptions,
  ): Promise<AuthenticatedUser | null> {
    try {
      // Check cache first
      const cached = this.tokenCache.get(token);
      if (!options?.bypassCache && cached && cached.expiresAt > Date.now()) {
        if (this.invalidatedUserIds.has(cached.user.id)) {
          this.tokenCache.delete(token);
          return null;
        }

        const profile = await this.userProfileRepository.findById(
          cached.user.id,
        );
        if (!profile || this.isAccountDeleting(profile, options)) {
          this.logger.warn(
            `[AuthService] Cached token rejected because profile is unavailable for user ${cached.user.id}`,
          );
          this.tokenCache.delete(token);
          return null;
        }

        cached.user.profile = profile;
        this.logger.debug(
          `[AuthService] Using cached token for user: ${cached.user.id}`,
        );
        return cached.user;
      }

      this.logger.debug(
        `[AuthService] Validating token with length: ${token?.length || 0}`,
      );

      const identity = await this.identityProvider.verifyAccessToken(token);
      if (!identity) {
        this.logger.warn('[AuthService] Identity provider rejected token');
        this.tokenCache.delete(token);
        return null;
      }

      this.logger.debug(
        `[AuthService] Token validated for user: ${identity.id}`,
      );

      if (this.invalidatedUserIds.has(identity.id)) {
        this.logger.warn(
          `[AuthService] Token rejected for invalidated user: ${identity.id}`,
        );
        this.tokenCache.delete(token);
        return null;
      }

      const profile = await this.userProfileRepository.findById(identity.id);

      if (!profile || this.isAccountDeleting(profile, options)) {
        this.logger.warn(
          `[AuthService] Token rejected because profile is unavailable for user ${identity.id}`,
        );
        this.tokenCache.delete(token);
        return null;
      }

      // Update last seen timestamp
      await this.userProfileRepository.updateLastSeen(identity.id);

      this.logger.debug(
        `[AuthService] Successfully validated user: ${identity.id} with profile: ${profile.displayName}`,
      );

      const authenticatedUser: AuthenticatedUser = {
        id: identity.id,
        email: identity.email,
        isAnonymous: identity.isAnonymous,
        profile,
      };

      // Cache the result
      this.tokenCache.set(token, {
        user: authenticatedUser,
        expiresAt: Date.now() + this.CACHE_TTL_MS,
      });

      // Evict oldest entries if cache exceeds max size
      if (this.tokenCache.size > this.MAX_CACHE_SIZE) {
        this.evictOldestEntries();
      }

      // Clean up expired cache entries periodically
      this.cleanupExpiredCache();

      return authenticatedUser;
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

  invalidateUser(userId: string): void {
    this.invalidatedUserIds.add(userId);

    for (const [token, cached] of this.tokenCache.entries()) {
      if (cached.user.id === userId) {
        this.tokenCache.delete(token);
      }
    }
  }

  private isAccountDeleting(
    profile: UserProfile,
    options?: TokenValidationOptions,
  ): boolean {
    return (
      Boolean(profile.accountDeletionStartedAt) &&
      !options?.allowDeletingAccount
    );
  }

  private cleanupExpiredCache(): void {
    const now = Date.now();
    for (const [token, cached] of this.tokenCache.entries()) {
      if (cached.expiresAt <= now) {
        this.tokenCache.delete(token);
      }
    }
  }

  private evictOldestEntries(): void {
    const entriesToRemove = this.tokenCache.size - this.MAX_CACHE_SIZE;
    if (entriesToRemove <= 0) return;

    const entries = [...this.tokenCache.entries()].sort(
      (a, b) => a[1].expiresAt - b[1].expiresAt,
    );

    for (let i = 0; i < entriesToRemove; i++) {
      this.tokenCache.delete(entries[i][0]);
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
    options?: TokenValidationOptions,
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
      const result = await this.validateToken(token, options);

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
