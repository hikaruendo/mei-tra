/* eslint-disable @typescript-eslint/unbound-method */
import { ChatService } from '../chat.service';
import { IChatRoomRepository } from '../../repositories/interfaces/chat-room.repository.interface';
import { IChatMessageRepository } from '../../repositories/interfaces/chat-message.repository.interface';
import { IUserProfileRepository } from '../../repositories/interfaces/user-profile.repository.interface';
import {
  ChatRoom,
  ChatMessage,
  ChatRoomId,
  UserId,
} from '../../types/social.types';

describe('ChatService', () => {
  let chatService: ChatService;
  let profileRepository: jest.Mocked<IUserProfileRepository>;
  let chatRoomRepository: jest.Mocked<IChatRoomRepository>;
  let chatMessageRepository: jest.Mocked<IChatMessageRepository>;

  beforeEach(() => {
    profileRepository = {
      findById: jest.fn(),
      findByUsername: jest.fn(),
      findByUserIds: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      updateLastSeen: jest.fn(),
      updateGameStats: jest.fn(),
      searchByUsername: jest.fn(),
    } as jest.Mocked<IUserProfileRepository>;

    chatRoomRepository = {
      findById: jest.fn(),
      create: jest.fn(),
      findByScope: jest.fn(),
      findByVisibility: jest.fn(),
      findByOwnerId: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as jest.Mocked<IChatRoomRepository>;

    chatMessageRepository = {
      findById: jest.fn(),
      findByRoomId: jest.fn(),
      create: jest.fn(),
      deleteMessagesBefore: jest.fn(),
      deleteByRoomId: jest.fn(),
    } as jest.Mocked<IChatMessageRepository>;

    chatService = new ChatService(
      profileRepository,
      chatRoomRepository,
      chatMessageRepository,
    );
  });

  describe('postMessage', () => {
    it('should successfully post a message', async () => {
      const roomId = 'test-room-id';
      const userId = 'test-user-id';
      const content = 'Hello, world!';

      const mockRoom = ChatRoom.create({
        id: ChatRoomId.create(roomId),
        scope: 'table',
        name: 'Test Room',
        visibility: 'private',
        messageTtlHours: 24,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const mockMessage = ChatMessage.create({
        id: 'message-id',
        roomId: ChatRoomId.create(roomId),
        senderId: UserId.create(userId),
        content,
        contentType: 'text',
        createdAt: new Date(),
      });

      chatRoomRepository.findById.mockResolvedValue(mockRoom);
      profileRepository.findById.mockResolvedValue({
        id: userId,
        username: 'testuser',
        displayName: 'Test User',
        avatarUrl: 'https://example.com/avatar.jpg',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSeenAt: new Date(),
        gamesPlayed: 0,
        gamesWon: 0,
        totalScore: 0,
        preferences: { notifications: true, sound: true, theme: 'light' },
      });
      chatMessageRepository.create.mockResolvedValue(mockMessage);

      const result = await chatService.postMessage({
        roomId,
        userId,
        content,
      });

      expect(result.type).toBe('chat.message');
      expect(result.roomId).toBe(roomId);
      expect(result.message.content).toBe(content);
      expect(result.message.sender.userId).toBe(userId);
      expect(result.message.sender.displayName).toBe('Test User');
    });

    it('should throw error if chat room not found', async () => {
      chatRoomRepository.findById.mockResolvedValue(null);

      await expect(
        chatService.postMessage({
          roomId: 'non-existent-room',
          userId: 'user-id',
          content: 'Hello',
        }),
      ).rejects.toThrow('Chat room not found');
    });

    it('should throw error if user profile not found', async () => {
      const mockRoom = ChatRoom.create({
        id: ChatRoomId.create('room-id'),
        scope: 'global',
        visibility: 'public',
        messageTtlHours: 24,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      chatRoomRepository.findById.mockResolvedValue(mockRoom);
      profileRepository.findById.mockResolvedValue(null);

      await expect(
        chatService.postMessage({
          roomId: 'room-id',
          userId: 'non-existent-user',
          content: 'Hello',
        }),
      ).rejects.toThrow('User profile not found');
    });

    it('should handle emoji content type', async () => {
      const roomId = 'test-room-id';
      const userId = 'test-user-id';

      const mockRoom = ChatRoom.create({
        id: ChatRoomId.create(roomId),
        scope: 'lobby',
        visibility: 'public',
        messageTtlHours: 24,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const mockMessage = ChatMessage.create({
        id: 'emoji-message-id',
        roomId: ChatRoomId.create(roomId),
        senderId: UserId.create(userId),
        content: '😀',
        contentType: 'emoji',
        createdAt: new Date(),
      });

      chatRoomRepository.findById.mockResolvedValue(mockRoom);
      profileRepository.findById.mockResolvedValue({
        id: userId,
        username: 'emojiuser',
        displayName: 'Emoji User',
        avatarUrl: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSeenAt: new Date(),
        gamesPlayed: 0,
        gamesWon: 0,
        totalScore: 0,
        preferences: { notifications: true, sound: true, theme: 'light' },
      });
      chatMessageRepository.create.mockResolvedValue(mockMessage);

      const result = await chatService.postMessage({
        roomId,
        userId,
        content: '😀',
        contentType: 'emoji',
      });

      expect(result.message.contentType).toBe('emoji');
    });
  });

  describe('listMessages', () => {
    it('should return messages with sender profiles', async () => {
      const roomId = 'test-room-id';
      const userId1 = 'user-1';
      const userId2 = 'user-2';

      const mockMessages = [
        ChatMessage.create({
          id: 'msg-1',
          roomId: ChatRoomId.create(roomId),
          senderId: UserId.create(userId1),
          content: 'First message',
          contentType: 'text',
          createdAt: new Date('2025-01-01T10:00:00Z'),
        }),
        ChatMessage.create({
          id: 'msg-2',
          roomId: ChatRoomId.create(roomId),
          senderId: UserId.create(userId2),
          content: 'Second message',
          contentType: 'text',
          createdAt: new Date('2025-01-01T10:01:00Z'),
        }),
      ];

      const mockProfiles = [
        {
          userId: userId1,
          displayName: 'User One',
          avatarUrl: 'https://example.com/user1.jpg',
          countryCode: 'JP',
          rankTier: 'gold',
        },
        {
          userId: userId2,
          displayName: 'User Two',
          avatarUrl: undefined,
          countryCode: undefined,
          rankTier: 'silver',
        },
      ];

      chatMessageRepository.findByRoomId.mockResolvedValue(mockMessages);
      profileRepository.findByUserIds.mockResolvedValue(mockProfiles);

      const result = await chatService.listMessages({ roomId });

      expect(result).toHaveLength(2);
      expect(result[0].sender.displayName).toBe('User One');
      expect(result[1].sender.displayName).toBe('User Two');
      expect(
        jest.mocked(profileRepository.findByUserIds),
      ).toHaveBeenCalledTimes(1);
    });

    it('should handle system messages without sender', async () => {
      const roomId = 'test-room-id';

      const mockMessages = [
        ChatMessage.create({
          id: 'system-msg',
          roomId: ChatRoomId.create(roomId),
          senderId: undefined,
          content: 'Game started',
          contentType: 'system',
          createdAt: new Date(),
        }),
      ];

      chatMessageRepository.findByRoomId.mockResolvedValue(mockMessages);
      profileRepository.findByUserIds.mockResolvedValue([]);

      const result = await chatService.listMessages({ roomId });

      expect(result).toHaveLength(1);
      expect(result[0].sender.userId).toBe('system');
      expect(result[0].sender.displayName).toBe('System');
    });

    it('should batch fetch profiles to avoid N+1 queries', async () => {
      const roomId = 'test-room-id';
      const userId1 = 'user-1';
      const userId2 = 'user-2';

      // Create 10 messages from 2 users (5 each)
      const mockMessages = Array.from({ length: 10 }, (_, i) => {
        const userId = i % 2 === 0 ? userId1 : userId2;
        return ChatMessage.create({
          id: `msg-${i}`,
          roomId: ChatRoomId.create(roomId),
          senderId: UserId.create(userId),
          content: `Message ${i}`,
          contentType: 'text',
          createdAt: new Date(),
        });
      });

      const mockProfiles = [
        {
          userId: userId1,
          displayName: 'User One',
          avatarUrl: undefined,
          countryCode: undefined,
          rankTier: 'gold',
        },
        {
          userId: userId2,
          displayName: 'User Two',
          avatarUrl: undefined,
          countryCode: undefined,
          rankTier: 'silver',
        },
      ];

      chatMessageRepository.findByRoomId.mockResolvedValue(mockMessages);
      profileRepository.findByUserIds.mockResolvedValue(mockProfiles);

      await chatService.listMessages({ roomId });

      // Should only call findByUserIds once (batch query), not 10 times
      const mockedFindByUserIds = jest.mocked(profileRepository.findByUserIds);
      expect(mockedFindByUserIds).toHaveBeenCalledTimes(1);
      expect(mockedFindByUserIds).toHaveBeenCalledWith(
        expect.arrayContaining([userId1, userId2]),
      );
    });

    it('should handle missing profiles gracefully', async () => {
      const roomId = 'test-room-id';
      const userId = 'user-1';

      const mockMessages = [
        ChatMessage.create({
          id: 'msg-1',
          roomId: ChatRoomId.create(roomId),
          senderId: UserId.create(userId),
          content: 'Message from unknown user',
          contentType: 'text',
          createdAt: new Date(),
        }),
      ];

      chatMessageRepository.findByRoomId.mockResolvedValue(mockMessages);
      profileRepository.findByUserIds.mockResolvedValue([]);

      const result = await chatService.listMessages({ roomId });

      expect(result).toHaveLength(1);
      expect(result[0].sender.userId).toBe(userId);
      expect(result[0].sender.displayName).toBe('Unknown');
    });
  });

  describe('createRoom', () => {
    it('should create room with custom ID', async () => {
      const customId = 'custom-room-id';
      const mockRoom = ChatRoom.create({
        id: ChatRoomId.create(customId),
        scope: 'table',
        name: 'Custom Room',
        visibility: 'private',
        messageTtlHours: 24,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      chatRoomRepository.create.mockResolvedValue(mockRoom);

      const result = await chatService.createRoom({
        id: customId,
        scope: 'table',
        name: 'Custom Room',
        visibility: 'private',
      });

      expect(result.getId().getValue()).toBe(customId);
      expect(jest.mocked(chatRoomRepository.create)).toHaveBeenCalled();
    });

    it('should create room with auto-generated ID', async () => {
      const mockRoom = ChatRoom.create({
        id: ChatRoomId.create('auto-generated-id'),
        scope: 'global',
        visibility: 'public',
        messageTtlHours: 24,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      chatRoomRepository.create.mockResolvedValue(mockRoom);

      const result = await chatService.createRoom({
        scope: 'global',
        visibility: 'public',
      });

      expect(result.getId().getValue()).toBeTruthy();
      expect(jest.mocked(chatRoomRepository.create)).toHaveBeenCalled();
    });

    it('should set default messageTtlHours to 24', async () => {
      const mockRoom = ChatRoom.create({
        id: ChatRoomId.create('room-id'),
        scope: 'lobby',
        visibility: 'public',
        messageTtlHours: 24,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      chatRoomRepository.create.mockResolvedValue(mockRoom);

      await chatService.createRoom({
        scope: 'lobby',
        visibility: 'public',
      });

      const mockedCreate = jest.mocked(chatRoomRepository.create);
      const createCall = mockedCreate.mock.calls[0]?.[0];
      expect(createCall?.getMessageTtlHours()).toBe(24);
    });
  });

  describe('getRoom', () => {
    it('should return room by ID', async () => {
      const roomId = 'test-room-id';
      const mockRoom = ChatRoom.create({
        id: ChatRoomId.create(roomId),
        scope: 'table',
        visibility: 'private',
        messageTtlHours: 24,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      chatRoomRepository.findById.mockResolvedValue(mockRoom);

      const result = await chatService.getRoom(roomId);

      expect(result).toBe(mockRoom);
      expect(jest.mocked(chatRoomRepository.findById)).toHaveBeenCalledWith(
        expect.objectContaining({ value: roomId }),
      );
    });

    it('should return null if room not found', async () => {
      chatRoomRepository.findById.mockResolvedValue(null);

      const result = await chatService.getRoom('non-existent-room');

      expect(result).toBeNull();
    });
  });

  describe('listRooms', () => {
    it('should list rooms by scope', async () => {
      const mockRooms = [
        ChatRoom.create({
          id: ChatRoomId.create('room-1'),
          scope: 'lobby',
          visibility: 'public',
          messageTtlHours: 24,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ];

      chatRoomRepository.findByScope.mockResolvedValue(mockRooms);

      const result = await chatService.listRooms('lobby');

      expect(result).toHaveLength(1);
      expect(jest.mocked(chatRoomRepository.findByScope)).toHaveBeenCalledWith(
        'lobby',
      );
    });

    it('should list public rooms when no scope provided', async () => {
      const mockRooms = [
        ChatRoom.create({
          id: ChatRoomId.create('room-1'),
          scope: 'global',
          visibility: 'public',
          messageTtlHours: 24,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ];

      chatRoomRepository.findByVisibility.mockResolvedValue(mockRooms);

      const result = await chatService.listRooms();

      expect(result).toHaveLength(1);
      expect(
        jest.mocked(chatRoomRepository.findByVisibility),
      ).toHaveBeenCalledWith('public');
    });
  });
});
