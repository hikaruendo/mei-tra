import { ChatModerationService } from '../chat-moderation.service';
import { ChatMessage, ChatRoomId, UserId } from '../../types/social.types';
import { IChatMessageRepository } from '../../repositories/interfaces/chat-message.repository.interface';
import { IChatModerationRepository } from '../../repositories/interfaces/chat-moderation.repository.interface';
import { IUserProfileRepository } from '../../repositories/interfaces/user-profile.repository.interface';

describe('ChatModerationService', () => {
  const messages = { findById: jest.fn() };
  const moderation = {
    createReport: jest.fn(),
    blockUser: jest.fn(),
    unblockUser: jest.fn(),
    findBlockedUserIds: jest.fn(),
    findUsersBlockingSender: jest.fn(),
  };
  const profiles = { findByUserIds: jest.fn() };
  const service = new ChatModerationService(
    messages as unknown as IChatMessageRepository,
    moderation as unknown as IChatModerationRepository,
    profiles as unknown as IUserProfileRepository,
  );

  beforeEach(() => jest.clearAllMocks());

  it('reports only another user’s message in the joined room and snapshots its content', async () => {
    messages.findById.mockResolvedValue(
      ChatMessage.create({
        id: 'message-1',
        roomId: ChatRoomId.create('room-1'),
        senderId: UserId.create('sender-1'),
        content: 'offensive post',
        contentType: 'text',
        createdAt: new Date(),
      }),
    );
    await service.reportMessage({
      reporterId: 'reporter-1',
      roomId: 'room-1',
      messageId: 'message-1',
      reason: 'offensive',
    });
    expect(moderation.createReport).toHaveBeenCalledWith({
      reporterId: 'reporter-1',
      roomId: 'room-1',
      messageId: 'message-1',
      reportedSenderId: 'sender-1',
      contentSnapshot: 'offensive post',
      reason: 'offensive',
    });
    await expect(
      service.reportMessage({
        reporterId: 'sender-1',
        roomId: 'room-1',
        messageId: 'message-1',
        reason: 'offensive',
      }),
    ).rejects.toThrow();
    await expect(
      service.reportMessage({
        reporterId: 'reporter-1',
        roomId: 'another-room',
        messageId: 'message-1',
        reason: 'offensive',
      }),
    ).rejects.toThrow();
  });

  it('does not allow self-blocking', async () => {
    await expect(service.blockUser('user-1', 'user-1')).rejects.toThrow();
    expect(moderation.blockUser).not.toHaveBeenCalled();
  });
});
