/* eslint-disable @typescript-eslint/require-await */
import type { ChatMessagesPayload, ChatTypingEvent } from '@contracts/social';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './services/chat.service';
import { Logger } from '@nestjs/common';
import { AuthService } from './auth/auth.service';
import { AuthenticatedUser } from './types/user.types';
import { createSocketCorsOriginHandler } from './config/frontend-origins';

@WebSocketGateway({
  namespace: '/social',
  cors: {
    origin: createSocketCorsOriginHandler(),
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class SocialGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(SocialGateway.name);
  private readonly socketRooms: Map<
    string,
    { userId: string; rooms: Set<string> }
  > = new Map();

  constructor(
    private readonly chatService: ChatService,
    private readonly authService: AuthService,
  ) {}

  async handleConnection(client: Socket) {
    this.logger.log(`Social client connected: ${client.id}`);

    const auth = client.handshake.auth || {};
    const supabaseToken =
      typeof auth.token === 'string' ? auth.token : undefined;

    if (!supabaseToken) {
      this.logger.warn('[SocialAuth] No authentication token provided');
      client.emit('chat:error', { message: 'Authentication required' });
      client.disconnect();
      return;
    }

    let authenticatedUser: AuthenticatedUser | null = null;
    try {
      authenticatedUser =
        await this.authService.getUserFromSocketToken(supabaseToken);
    } catch (error) {
      this.logger.warn('[SocialAuth] Failed to authenticate user:', error);
      client.emit('chat:error', { message: 'Authentication failed' });
      client.disconnect();
      return;
    }

    if (!authenticatedUser) {
      this.logger.warn('[SocialAuth] Invalid authentication token');
      client.emit('chat:error', { message: 'Invalid authentication token' });
      client.disconnect();
      return;
    }

    (client.data as { user: AuthenticatedUser }).user = authenticatedUser;
    this.socketRooms.set(client.id, {
      userId: authenticatedUser.id,
      rooms: new Set<string>(),
    });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Social client disconnected: ${client.id}`);
    this.socketRooms.delete(client.id);
  }

  @SubscribeMessage('chat:join-room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId?: string },
  ): Promise<void> {
    try {
      const authenticatedUser = this.getAuthenticatedUser(client);
      if (!authenticatedUser) return;

      const socketState = this.socketRooms.get(client.id) ?? {
        userId: authenticatedUser.id,
        rooms: new Set<string>(),
      };
      this.socketRooms.set(client.id, socketState);

      if (socketState.rooms.has(data.roomId)) {
        client.emit('chat:joined', { roomId: data.roomId, success: true });
        return;
      }

      await client.join(data.roomId);
      socketState.rooms.add(data.roomId);
      this.logger.log(
        `User ${authenticatedUser.id} joined chat room ${data.roomId} via socket ${client.id}`,
      );
      client.emit('chat:joined', { roomId: data.roomId, success: true });
    } catch (error) {
      this.logger.error(`Failed to join room: ${error}`);
      client.emit('chat:error', { message: 'Failed to join room' });
    }
  }

  @SubscribeMessage('chat:leave-room')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId?: string },
  ): Promise<void> {
    try {
      const authenticatedUser = this.getAuthenticatedUser(client);
      if (!authenticatedUser) return;

      const socketState = this.socketRooms.get(client.id);
      if (!socketState?.rooms.has(data.roomId)) {
        client.emit('chat:left', { roomId: data.roomId, success: true });
        return;
      }

      await client.leave(data.roomId);
      socketState.rooms.delete(data.roomId);
      this.logger.log(
        `User ${authenticatedUser.id} left chat room ${data.roomId}`,
      );
      client.emit('chat:left', { roomId: data.roomId, success: true });
    } catch (error) {
      this.logger.error(`Failed to leave room: ${error}`);
      client.emit('chat:error', { message: 'Failed to leave room' });
    }
  }

  @SubscribeMessage('chat:post-message')
  async handlePostMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      roomId: string;
      userId?: string;
      content: string;
      contentType?: 'text' | 'emoji' | 'system';
      replyTo?: string;
    },
  ): Promise<void> {
    try {
      const authenticatedUser = this.getAuthenticatedUser(client);
      if (!authenticatedUser) return;

      const event = await this.chatService.postMessage({
        roomId: data.roomId,
        userId: authenticatedUser.id,
        content: data.content,
        contentType: data.contentType,
        replyTo: data.replyTo,
      });

      this.server.to(data.roomId).emit('chat:message', event);
      this.logger.log(
        `Message posted to room ${data.roomId} by user ${authenticatedUser.id}`,
      );
    } catch (error) {
      this.logGatewayError('Failed to post message', error);
      client.emit('chat:error', { message: 'Failed to post message' });
    }
  }

  @SubscribeMessage('chat:typing')
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId?: string },
  ): Promise<void> {
    const authenticatedUser = this.getAuthenticatedUser(client);
    if (!authenticatedUser) return;

    const typingEvent: ChatTypingEvent = {
      type: 'chat.typing',
      roomId: data.roomId,
      userId: authenticatedUser.id,
      startedAt: new Date().toISOString(),
    };

    client.to(data.roomId).emit('chat:typing', typingEvent);
  }

  @SubscribeMessage('chat:list-messages')
  async handleListMessages(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; limit?: number; cursor?: string },
  ): Promise<void> {
    try {
      const authenticatedUser = this.getAuthenticatedUser(client);
      if (!authenticatedUser) return;

      const messages = await this.chatService.listMessages({
        roomId: data.roomId,
        limit: data.limit,
        cursor: data.cursor,
      });

      const payload: ChatMessagesPayload = {
        roomId: data.roomId,
        messages: messages,
      };

      client.emit('chat:messages', payload);
    } catch (error) {
      this.logGatewayError('Failed to list messages', error);
      client.emit('chat:error', { message: 'Failed to list messages' });
    }
  }

  private getAuthenticatedUser(client: Socket): AuthenticatedUser | null {
    const authenticatedUser = (client.data as { user?: AuthenticatedUser })
      .user;

    if (!authenticatedUser) {
      client.emit('chat:error', { message: 'Authentication required' });
      return null;
    }

    return authenticatedUser;
  }

  private logGatewayError(message: string, error: unknown): void {
    if (error instanceof Error) {
      if (
        error.message === 'Chat room not found' ||
        error.message === 'User profile not found'
      ) {
        this.logger.warn(`${message}: ${error.message}`);
        return;
      }

      this.logger.error(`${message}: ${error.message}`);
      return;
    }

    this.logger.error(`${message}: ${String(error)}`);
  }
}
