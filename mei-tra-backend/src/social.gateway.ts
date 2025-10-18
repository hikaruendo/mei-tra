/* eslint-disable @typescript-eslint/require-await */
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
import { ChatTypingEvent } from './types/social-events.types';

@WebSocketGateway({
  namespace: '/social',
  cors: {
    origin: '*',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class SocialGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(SocialGateway.name);
  private readonly userRooms: Map<string, Set<string>> = new Map();

  constructor(private readonly chatService: ChatService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Social client connected: ${client.id}`);
    const userId = client.handshake.auth?.userId as string;
    if (userId) {
      if (!this.userRooms.has(userId)) {
        this.userRooms.set(userId, new Set());
      }
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Social client disconnected: ${client.id}`);
    const userId = client.handshake.auth?.userId as string;
    if (userId) {
      this.userRooms.delete(userId);
    }
  }

  @SubscribeMessage('chat:join-room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId: string },
  ): Promise<void> {
    try {
      await client.join(data.roomId);
      const userRooms = this.userRooms.get(data.userId);
      if (userRooms) {
        userRooms.add(data.roomId);
      }
      this.logger.log(
        `User ${data.userId} joined chat room ${data.roomId} via socket ${client.id}`,
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
    @MessageBody() data: { roomId: string; userId: string },
  ): Promise<void> {
    try {
      await client.leave(data.roomId);
      const userRooms = this.userRooms.get(data.userId);
      if (userRooms) {
        userRooms.delete(data.roomId);
      }
      this.logger.log(`User ${data.userId} left chat room ${data.roomId}`);
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
      userId: string;
      content: string;
      contentType?: 'text' | 'emoji' | 'system';
      replyTo?: string;
    },
  ): Promise<void> {
    try {
      const event = await this.chatService.postMessage({
        roomId: data.roomId,
        userId: data.userId,
        content: data.content,
        contentType: data.contentType,
        replyTo: data.replyTo,
      });

      this.server.to(data.roomId).emit('chat:message', event);
      this.logger.log(
        `Message posted to room ${data.roomId} by user ${data.userId}`,
      );
    } catch (error) {
      this.logger.error(`Failed to post message: ${error}`);
      client.emit('chat:error', { message: 'Failed to post message' });
    }
  }

  @SubscribeMessage('chat:typing')
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId: string },
  ): Promise<void> {
    const typingEvent: ChatTypingEvent = {
      type: 'chat.typing',
      roomId: data.roomId,
      userId: data.userId,
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
      const messages = await this.chatService.listMessages({
        roomId: data.roomId,
        limit: data.limit,
        cursor: data.cursor,
      });

      client.emit('chat:messages', {
        roomId: data.roomId,
        messages: messages,
      });
    } catch (error) {
      this.logger.error(`Failed to list messages: ${error}`);
      client.emit('chat:error', { message: 'Failed to list messages' });
    }
  }
}
