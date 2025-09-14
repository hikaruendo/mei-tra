import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Socket } from 'socket.io';
import { Request } from 'express';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const request = context.switchToHttp().getRequest();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const token = this.extractTokenFromRequest(request);

    if (!token) {
      throw new UnauthorizedException('No authentication token provided');
    }

    const user = await this.authService.validateToken(token);
    if (!user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // Attach user to request
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    request.user = user;
    return true;
  }

  private extractTokenFromRequest(request: Request): string | null {
    const authHeader = request.headers?.authorization;
    if (
      !authHeader ||
      typeof authHeader !== 'string' ||
      !authHeader.startsWith('Bearer ')
    ) {
      return null;
    }
    return authHeader.substring(7);
  }
}

@Injectable()
export class WsAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsAuthGuard.name);

  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient();
      const token = this.extractTokenFromSocket(client);

      if (!token) {
        this.logger.warn(
          'No authentication token provided in WebSocket connection',
        );
        client.emit('auth-error', 'Authentication required');
        client.disconnect();
        return false;
      }

      const user = await this.authService.getUserFromSocketToken(token);
      if (!user) {
        this.logger.warn('Invalid or expired token in WebSocket connection');
        client.emit('auth-error', 'Invalid or expired token');
        client.disconnect();
        return false;
      }

      // Attach user to socket
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      client.data.user = user;
      return true;
    } catch (error) {
      this.logger.error('Error in WebSocket authentication:', error);
      return false;
    }
  }

  private extractTokenFromSocket(client: Socket): string | null {
    // Try to get token from handshake auth
    const auth = client.handshake.auth as Record<string, unknown>;
    if (auth?.token && typeof auth.token === 'string') {
      return auth.token;
    }

    // Try to get token from headers
    const authHeader = client.handshake.headers?.authorization;
    if (
      authHeader &&
      typeof authHeader === 'string' &&
      authHeader.startsWith('Bearer ')
    ) {
      return authHeader.substring(7);
    }

    // Try to get token from query
    const queryToken = client.handshake.query?.token;
    if (queryToken && typeof queryToken === 'string') {
      return queryToken;
    }

    return null;
  }
}
