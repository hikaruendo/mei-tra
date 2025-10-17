/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ChatService } from '../services/chat.service';

interface PostMessageRequest {
  userId: string;
  content: string;
  contentType?: 'text' | 'emoji' | 'system';
  replyTo?: string;
}

interface CreateRoomRequest {
  scope: 'global' | 'lobby' | 'table' | 'private';
  name?: string;
  ownerId?: string;
  visibility: 'public' | 'friends' | 'private';
  messageTtlHours?: number;
}

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('rooms')
  async listRooms(@Query('scope') scope?: string) {
    try {
      const rooms = await this.chatService.listRooms(scope);
      return { rooms: rooms.map((room) => room.toJSON()) };
    } catch (error) {
      throw new HttpException(
        'Failed to list rooms',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('rooms/:id')
  async getRoom(@Param('id') id: string) {
    try {
      const room = await this.chatService.getRoom(id);
      if (!room) {
        throw new HttpException('Room not found', HttpStatus.NOT_FOUND);
      }
      return room.toJSON();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to get room',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('rooms')
  async createRoom(@Body() body: CreateRoomRequest) {
    try {
      const room = await this.chatService.createRoom(body);
      return room.toJSON();
    } catch (error) {
      throw new HttpException(
        'Failed to create room',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('rooms/:id/messages')
  async listMessages(
    @Param('id') roomId: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    try {
      const messages = await this.chatService.listMessages({
        roomId,
        limit: limit ? parseInt(limit, 10) : undefined,
        cursor,
      });
      return { messages };
    } catch (error) {
      throw new HttpException(
        'Failed to list messages',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('rooms/:id/messages')
  async postMessage(
    @Param('id') roomId: string,
    @Body() body: PostMessageRequest,
  ) {
    try {
      const event = await this.chatService.postMessage({
        roomId,
        ...body,
      });
      return event;
    } catch (error) {
      throw new HttpException(
        'Failed to post message',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
