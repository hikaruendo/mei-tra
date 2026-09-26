import { Inject, Injectable } from '@nestjs/common';
import type { ChatBlockedUser } from '@contracts/social';
import { IChatMessageRepository } from '../repositories/interfaces/chat-message.repository.interface';
import { IChatModerationRepository } from '../repositories/interfaces/chat-moderation.repository.interface';
import { IUserProfileRepository } from '../repositories/interfaces/user-profile.repository.interface';

@Injectable()
export class ChatModerationService {
  constructor(
    @Inject('IChatMessageRepository')
    private readonly messages: IChatMessageRepository,
    @Inject('IChatModerationRepository')
    private readonly moderation: IChatModerationRepository,
    @Inject('IUserProfileRepository')
    private readonly profiles: IUserProfileRepository,
  ) {}

  listBlockedUserIds(userId: string): Promise<string[]> {
    return this.moderation.findBlockedUserIds(userId);
  }

  async listBlockedUsers(userId: string): Promise<ChatBlockedUser[]> {
    const ids = await this.listBlockedUserIds(userId);
    const profiles = await this.profiles.findByUserIds(ids);
    const names = new Map(
      profiles.map((profile) => [profile.userId, profile.displayName]),
    );
    return ids.map((id) => ({
      userId: id,
      displayName: names.get(id) || id.slice(0, 8),
    }));
  }

  listUsersBlockingSender(userId: string): Promise<string[]> {
    return this.moderation.findUsersBlockingSender(userId);
  }

  async blockUser(blockerId: string, blockedId: string): Promise<void> {
    if (!blockedId || blockerId === blockedId)
      throw new Error('Invalid block target');
    await this.moderation.blockUser(blockerId, blockedId);
  }

  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    await this.moderation.unblockUser(blockerId, blockedId);
  }

  async reportMessage(input: {
    reporterId: string;
    roomId: string;
    messageId: string;
    reason: 'offensive' | 'harassment' | 'other';
  }): Promise<void> {
    if (!['offensive', 'harassment', 'other'].includes(input.reason)) {
      throw new Error('Invalid report reason');
    }
    const message = await this.messages.findById(input.messageId);
    const senderId = message?.getSenderId()?.getValue();
    if (
      !message ||
      !senderId ||
      senderId === input.reporterId ||
      message.getRoomId().getValue() !== input.roomId
    ) {
      throw new Error('Invalid report target');
    }
    await this.moderation.createReport({
      reporterId: input.reporterId,
      reportedSenderId: senderId,
      messageId: input.messageId,
      roomId: input.roomId,
      contentSnapshot: message.getContent(),
      reason: input.reason,
    });
  }
}
