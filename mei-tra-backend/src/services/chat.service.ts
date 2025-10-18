import { Injectable, Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  ChatMessage,
  ChatRoom,
  ChatRoomId,
  UserId,
} from '../types/social.types';
import { IUserProfileRepository } from '../repositories/interfaces/user-profile.repository.interface';
import { IChatRoomRepository } from '../repositories/interfaces/chat-room.repository.interface';
import { IChatMessageRepository } from '../repositories/interfaces/chat-message.repository.interface';
import { ChatMessageEvent, BasicProfile } from '../types/social-events.types';

export interface PostMessageDto {
  roomId: string;
  userId: string;
  content: string;
  contentType?: 'text' | 'emoji' | 'system';
  replyTo?: string;
}

export interface ListMessagesDto {
  roomId: string;
  limit?: number;
  cursor?: string;
}

export interface CreateRoomDto {
  id?: string;
  scope: 'global' | 'lobby' | 'table' | 'private';
  name?: string;
  ownerId?: string;
  visibility: 'public' | 'friends' | 'private';
  messageTtlHours?: number;
}

@Injectable()
export class ChatService {
  constructor(
    @Inject('IUserProfileRepository')
    private readonly profileRepository: IUserProfileRepository,
    @Inject('IChatRoomRepository')
    private readonly chatRoomRepository: IChatRoomRepository,
    @Inject('IChatMessageRepository')
    private readonly chatMessageRepository: IChatMessageRepository,
  ) {}

  async postMessage(dto: PostMessageDto): Promise<ChatMessageEvent> {
    const roomId = ChatRoomId.create(dto.roomId);
    const userId = UserId.create(dto.userId);

    const room = await this.chatRoomRepository.findById(roomId);
    if (!room) {
      throw new Error('Chat room not found');
    }

    const profile = await this.profileRepository.findById(userId.getValue());
    if (!profile) {
      throw new Error('User profile not found');
    }

    const message = ChatMessage.create({
      id: randomUUID(),
      roomId,
      senderId: userId,
      content: dto.content,
      contentType: dto.contentType || 'text',
      replyTo: dto.replyTo,
      createdAt: new Date(),
    });

    const savedMessage = await this.chatMessageRepository.create(message);

    const basicProfile: BasicProfile = {
      userId: profile.id,
      displayName: profile.displayName || 'Unknown',
      avatarUrl: profile.avatarUrl,
      countryCode: undefined,
      rankTier: 'bronze',
    };

    return {
      type: 'chat.message',
      roomId: dto.roomId,
      message: {
        id: savedMessage.getId(),
        sender: basicProfile,
        content: savedMessage.getContent(),
        contentType: savedMessage.getContentType(),
        createdAt: savedMessage.getCreatedAt().toISOString(),
        replyTo: savedMessage.getReplyTo(),
      },
    };
  }

  async listMessages(dto: ListMessagesDto): Promise<
    Array<{
      id: string;
      sender: BasicProfile;
      content: string;
      contentType: string;
      createdAt: string;
      replyTo?: string;
    }>
  > {
    const roomId = ChatRoomId.create(dto.roomId);
    const messages = await this.chatMessageRepository.findByRoomId(
      roomId,
      dto.limit || 50,
      dto.cursor,
    );

    // Batch fetch all unique sender profiles in one query (N+1 optimization)
    // Instead of 50+ queries (1 for messages + 1 per sender), we make 2 queries total
    // Filter out null/undefined (system messages have no sender)
    const uniqueSenderIds = Array.from(
      new Set(
        messages
          .map((msg) => msg.getSenderId()?.getValue())
          .filter((id): id is string => id != null),
      ),
    );

    const profiles =
      await this.profileRepository.findByUserIds(uniqueSenderIds);

    // Create a Map for O(1) profile lookup
    const profileMap = new Map<string, BasicProfile>();
    profiles.forEach((profile) => {
      profileMap.set(profile.userId, {
        userId: profile.userId,
        displayName: profile.displayName || 'Unknown',
        avatarUrl: profile.avatarUrl,
        countryCode: profile.countryCode,
        rankTier: profile.rankTier || 'bronze',
      });
    });

    // Convert messages using cached profiles
    const messagesWithProfiles = messages.map((msg) => {
      const senderId = msg.getSenderId();
      let basicProfile: BasicProfile;

      if (senderId) {
        basicProfile = profileMap.get(senderId.getValue()) || {
          userId: senderId.getValue(),
          displayName: 'Unknown',
          rankTier: 'bronze',
        };
      } else {
        basicProfile = {
          userId: 'system',
          displayName: 'System',
          rankTier: 'bronze',
        };
      }

      return {
        id: msg.getId(),
        sender: basicProfile,
        content: msg.getContent(),
        contentType: msg.getContentType(),
        createdAt: msg.getCreatedAt().toISOString(),
        replyTo: msg.getReplyTo(),
      };
    });

    return messagesWithProfiles;
  }

  async createRoom(dto: CreateRoomDto): Promise<ChatRoom> {
    const room = ChatRoom.create({
      id: dto.id ? ChatRoomId.create(dto.id) : ChatRoomId.create(randomUUID()),
      scope: dto.scope,
      name: dto.name,
      ownerId: dto.ownerId ? UserId.create(dto.ownerId) : undefined,
      visibility: dto.visibility,
      messageTtlHours: dto.messageTtlHours || 24,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return this.chatRoomRepository.create(room);
  }

  async listRooms(scope?: string): Promise<ChatRoom[]> {
    if (scope) {
      return this.chatRoomRepository.findByScope(
        scope as 'global' | 'lobby' | 'table' | 'private',
      );
    }
    return this.chatRoomRepository.findByVisibility('public');
  }

  async getRoom(roomId: string): Promise<ChatRoom | null> {
    return this.chatRoomRepository.findById(ChatRoomId.create(roomId));
  }
}
