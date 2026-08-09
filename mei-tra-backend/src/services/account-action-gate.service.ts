import { Inject, Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedUser } from '../types/user.types';
import { IAccountStatusRepository } from '../repositories/interfaces/user-profile.repository.interface';

export interface AccountActionGateResult {
  allowed: boolean;
  authenticatedUser?: AuthenticatedUser;
  errorMessage?: string;
}

@Injectable()
export class AccountActionGateService {
  private readonly logger = new Logger(AccountActionGateService.name);
  private readonly inactiveAccountMessage =
    'Account deletion is in progress. Please finish deleting this account before continuing.';

  constructor(
    private readonly authService: AuthService,
    @Inject('IUserProfileRepository')
    private readonly accountStatusRepository: IAccountStatusRepository,
  ) {}

  async ensureActiveSocketActor(
    client: Socket,
    action: string,
  ): Promise<AccountActionGateResult> {
    const cachedUser = this.getCachedUser(client);
    if (cachedUser) {
      return this.ensureUserIsActive(cachedUser, action);
    }

    const token = this.extractTokenFromSocket(client);
    if (!token) {
      return {
        allowed: false,
        errorMessage: 'Authentication required',
      };
    }

    const authenticatedUser = await this.authService.getUserFromSocketToken(
      token,
      { bypassCache: true },
    );
    if (!authenticatedUser) {
      return {
        allowed: false,
        errorMessage: this.inactiveAccountMessage,
      };
    }

    return {
      allowed: true,
      authenticatedUser,
    };
  }

  private async ensureUserIsActive(
    user: AuthenticatedUser,
    action: string,
  ): Promise<AccountActionGateResult> {
    const isActive = await this.accountStatusRepository.isAccountActive(
      user.id,
    );
    if (isActive) {
      return {
        allowed: true,
        authenticatedUser: user,
      };
    }

    this.logger.warn(
      `Rejecting ${action} for inactive or deleting account ${user.id}`,
    );
    return {
      allowed: false,
      errorMessage: this.inactiveAccountMessage,
    };
  }

  private getCachedUser(client: Socket): AuthenticatedUser | undefined {
    return (client.data as { user?: AuthenticatedUser }).user;
  }

  private extractTokenFromSocket(client: Socket): string | null {
    const auth = client.handshake.auth as Record<string, unknown>;
    if (auth?.token && typeof auth.token === 'string') {
      return auth.token;
    }

    const authHeader = client.handshake.headers?.authorization;
    if (
      authHeader &&
      typeof authHeader === 'string' &&
      authHeader.startsWith('Bearer ')
    ) {
      return authHeader.substring(7);
    }

    const queryToken = client.handshake.query?.token;
    if (queryToken && typeof queryToken === 'string') {
      return queryToken;
    }

    return null;
  }
}
