/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { io, Socket as ClientSocket } from 'socket.io-client';
import { SocialModule } from '../src/social.module';
import { IChatRoomRepository } from '../src/repositories/interfaces/chat-room.repository.interface';
import { IChatMessageRepository } from '../src/repositories/interfaces/chat-message.repository.interface';
import { IUserProfileRepository } from '../src/repositories/interfaces/user-profile.repository.interface';
import {
  ChatRoom,
  ChatMessage,
  ChatRoomId,
  UserId,
} from '../src/types/social.types';

describe('SocialGateway (e2e)', () => {
  let app: INestApplication;
  let clientSocket: ClientSocket;
  let mockChatRoomRepository: jest.Mocked<IChatRoomRepository>;
  let mockChatMessageRepository: jest.Mocked<IChatMessageRepository>;
  let mockProfileRepository: jest.Mocked<IUserProfileRepository>;

  beforeEach(async () => {
    mockChatRoomRepository = {
      findById: jest.fn(),
      create: jest.fn(),
      findByScope: jest.fn(),
      findByVisibility: jest.fn(),
      findByOwnerId: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as jest.Mocked<IChatRoomRepository>;

    mockChatMessageRepository = {
      findById: jest.fn(),
      findByRoomId: jest.fn(),
      create: jest.fn(),
      deleteMessagesBefore: jest.fn(),
      deleteByRoomId: jest.fn(),
    } as jest.Mocked<IChatMessageRepository>;

    mockProfileRepository = {
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

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [SocialModule],
    })
      .overrideProvider('IChatRoomRepository')
      .useValue(mockChatRoomRepository)
      .overrideProvider('IChatMessageRepository')
      .useValue(mockChatMessageRepository)
      .overrideProvider('IUserProfileRepository')
      .useValue(mockProfileRepository)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.listen(0);

    const address = app.getHttpServer().address() as { port: number };
    const port = address.port;
    const url = `http://localhost:${port}/social`;

    clientSocket = io(url, {
      transports: ['websocket'],
      auth: {
        userId: 'test-user-id',
      },
    });

    await new Promise<void>((resolve) => {
      clientSocket.on('connect', () => resolve());
    });
  });

  afterEach(async () => {
    if (clientSocket?.connected) {
      clientSocket.disconnect();
    }
    if (app) {
      await app.close();
    }
  });

  describe('Connection', () => {
    it('should connect successfully', () => {
      expect(clientSocket.connected).toBe(true);
    });

    it('should disconnect successfully', (done) => {
      clientSocket.on('disconnect', () => {
        expect(clientSocket.connected).toBe(false);
        done();
      });
      clientSocket.disconnect();
    });
  });

  describe('chat:join-room', () => {
    it('should join a chat room successfully', (done) => {
      const roomId = 'test-room-1';

      clientSocket.on(
        'chat:joined',
        (data: { roomId: string; success: boolean }) => {
          expect(data.roomId).toBe(roomId);
          expect(data.success).toBe(true);
          done();
        },
      );

      clientSocket.emit('chat:join-room', {
        roomId,
        userId: 'test-user-id',
      });
    });

    it('should handle join room errors', (done) => {
      clientSocket.on('chat:error', (data: { message: string }) => {
        expect(data.message).toBeDefined();
        done();
      });

      // Emit with invalid data to trigger error
      clientSocket.emit('chat:join-room', {});
    });
  });

  describe('chat:leave-room', () => {
    it('should leave a chat room successfully', (done) => {
      const roomId = 'test-room-2';

      // First join the room
      clientSocket.emit('chat:join-room', {
        roomId,
        userId: 'test-user-id',
      });

      clientSocket.on('chat:joined', () => {
        clientSocket.on(
          'chat:left',
          (data: { roomId: string; success: boolean }) => {
            expect(data.roomId).toBe(roomId);
            expect(data.success).toBe(true);
            done();
          },
        );

        clientSocket.emit('chat:leave-room', {
          roomId,
          userId: 'test-user-id',
        });
      });
    });
  });

  describe('chat:post-message', () => {
    it('should post and broadcast message successfully', (done) => {
      const roomId = 'test-room-3';
      const userId = 'test-user-id';
      const content = 'Hello, world!';

      const mockRoom = ChatRoom.create({
        id: ChatRoomId.create(roomId),
        scope: 'table',
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

      mockChatRoomRepository.findById.mockResolvedValue(mockRoom);
      mockProfileRepository.findById.mockResolvedValue({
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
      mockChatMessageRepository.create.mockResolvedValue(mockMessage);

      // First join the room
      clientSocket.emit('chat:join-room', {
        roomId,
        userId,
      });

      clientSocket.on('chat:joined', () => {
        clientSocket.on('chat:message', (data) => {
          expect(data.type).toBe('chat.message');
          expect(data.roomId).toBe(roomId);
          expect(data.message.content).toBe(content);
          expect(data.message.sender.userId).toBe(userId);
          done();
        });

        clientSocket.emit('chat:post-message', {
          roomId,
          userId,
          content,
        });
      });
    });

    it('should broadcast to multiple users in the same room', (done) => {
      const roomId = 'test-room-4';
      const userId1 = 'user-1';
      const userId2 = 'user-2';
      const content = 'Message to all';

      const address = app.getHttpServer().address() as { port: number };
      const port = address.port;
      const url = `http://localhost:${port}/social`;

      const client2 = io(url, {
        transports: ['websocket'],
        auth: { userId: userId2 },
      });

      const mockRoom = ChatRoom.create({
        id: ChatRoomId.create(roomId),
        scope: 'table',
        visibility: 'private',
        messageTtlHours: 24,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const mockMessage = ChatMessage.create({
        id: 'broadcast-msg',
        roomId: ChatRoomId.create(roomId),
        senderId: UserId.create(userId1),
        content,
        contentType: 'text',
        createdAt: new Date(),
      });

      mockChatRoomRepository.findById.mockResolvedValue(mockRoom);
      mockProfileRepository.findById.mockResolvedValue({
        id: userId1,
        username: 'userone',
        displayName: 'User One',
        avatarUrl: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSeenAt: new Date(),
        gamesPlayed: 0,
        gamesWon: 0,
        totalScore: 0,
        preferences: { notifications: true, sound: true, theme: 'light' },
      });
      mockChatMessageRepository.create.mockResolvedValue(mockMessage);

      let messagesReceived = 0;

      client2.on('connect', () => {
        // Both clients join the same room
        clientSocket.emit('chat:join-room', { roomId, userId: userId1 });
        client2.emit('chat:join-room', { roomId, userId: userId2 });

        let joinedCount = 0;
        const checkBothJoined = () => {
          joinedCount++;
          if (joinedCount === 2) {
            // Send message from client 1
            clientSocket.emit('chat:post-message', {
              roomId,
              userId: userId1,
              content,
            });
          }
        };

        clientSocket.on('chat:joined', checkBothJoined);
        client2.on('chat:joined', checkBothJoined);

        // Both clients should receive the message
        const handleMessage = (data: {
          message: { content: string };
          roomId: string;
        }) => {
          expect(data.message.content).toBe(content);
          messagesReceived++;
          if (messagesReceived === 2) {
            client2.disconnect();
            done();
          }
        };

        clientSocket.on('chat:message', handleMessage);
        client2.on('chat:message', handleMessage);
      });
    });
  });

  describe('chat:typing', () => {
    it('should broadcast typing event to other users', (done) => {
      const roomId = 'test-room-5';
      const userId1 = 'user-1';
      const userId2 = 'user-2';

      const address = app.getHttpServer().address() as { port: number };
      const port = address.port;
      const url = `http://localhost:${port}/social`;

      const client2 = io(url, {
        transports: ['websocket'],
        auth: { userId: userId2 },
      });

      client2.on('connect', () => {
        clientSocket.emit('chat:join-room', { roomId, userId: userId1 });
        client2.emit('chat:join-room', { roomId, userId: userId2 });

        let joinedCount = 0;
        const checkBothJoined = () => {
          joinedCount++;
          if (joinedCount === 2) {
            clientSocket.emit('chat:typing', {
              roomId,
              userId: userId1,
              isTyping: true,
            });
          }
        };

        clientSocket.on('chat:joined', checkBothJoined);
        client2.on('chat:joined', checkBothJoined);

        client2.on(
          'chat:user-typing',
          (data: { userId: string; isTyping: boolean }) => {
            expect(data.userId).toBe(userId1);
            expect(data.isTyping).toBe(true);
            client2.disconnect();
            done();
          },
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing chat room error', (done) => {
      const roomId = 'non-existent-room';
      const userId = 'test-user-id';

      mockChatRoomRepository.findById.mockResolvedValue(null);

      clientSocket.on('chat:error', (data: { message: string }) => {
        expect(data.message).toContain('room');
        done();
      });

      clientSocket.emit('chat:join-room', { roomId, userId });

      setTimeout(() => {
        clientSocket.emit('chat:post-message', {
          roomId,
          userId,
          content: 'Test',
        });
      }, 100);
    });
  });
});
