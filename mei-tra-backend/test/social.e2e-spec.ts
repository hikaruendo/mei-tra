/* eslint-disable @typescript-eslint/no-unsafe-call */

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
import { AuthService } from '../src/auth/auth.service';
import { SupabaseService } from '../src/database/supabase.service';
import {
  AuthenticatedUser,
  ChatProfileDto,
  UserProfile,
} from '../src/types/user.types';

describe('SocialGateway (e2e)', () => {
  let app: INestApplication;
  let clientSocket: ClientSocket;
  let clients: ClientSocket[];
  let mockChatRoomRepository: jest.Mocked<IChatRoomRepository>;
  let mockChatMessageRepository: jest.Mocked<IChatMessageRepository>;
  let mockProfileRepository: jest.Mocked<IUserProfileRepository>;
  let mockAuthService: { getUserFromSocketToken: jest.Mock };

  const profiles: Record<string, UserProfile> = {
    'user-1': {
      id: 'user-1',
      username: 'userone',
      displayName: 'User One',
      avatarUrl: undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSeenAt: new Date(),
      gamesPlayed: 0,
      gamesWon: 0,
      totalScore: 0,
      preferences: {
        notifications: true,
        sound: true,
        theme: 'light',
        fontSize: 'standard',
      },
    },
    'user-2': {
      id: 'user-2',
      username: 'usertwo',
      displayName: 'User Two',
      avatarUrl: undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSeenAt: new Date(),
      gamesPlayed: 0,
      gamesWon: 0,
      totalScore: 0,
      preferences: {
        notifications: true,
        sound: true,
        theme: 'light',
        fontSize: 'standard',
      },
    },
  };

  const authenticatedUsersByToken: Record<string, AuthenticatedUser> = {
    'token-user-1': {
      id: 'user-1',
      email: 'user-1@example.com',
      profile: profiles['user-1'],
    },
    'token-user-2': {
      id: 'user-2',
      email: 'user-2@example.com',
      profile: profiles['user-2'],
    },
  };

  const chatProfiles: Record<string, ChatProfileDto> = {
    'user-1': {
      userId: 'user-1',
      displayName: 'User One',
      avatarUrl: undefined,
      rankTier: 'bronze',
    },
    'user-2': {
      userId: 'user-2',
      displayName: 'User Two',
      avatarUrl: undefined,
      rankTier: 'bronze',
    },
  };

  const waitForConnect = (socket: ClientSocket) =>
    new Promise<void>((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', (error) => reject(error));
    });

  const createClient = async (token: string) => {
    const address = app.getHttpServer().address() as { port: number };
    const socket = io(`http://localhost:${address.port}/social`, {
      transports: ['websocket'],
      auth: { token },
      extraHeaders: {
        origin: 'http://localhost:3000',
      },
      reconnection: false,
      forceNew: true,
    });

    clients.push(socket);
    await waitForConnect(socket);
    return socket;
  };

  beforeEach(async () => {
    process.env.FRONTEND_URL_DEV = 'http://localhost:3000';
    process.env.FRONTEND_URL_PROD = 'https://mei-tra.example.com';

    clients = [];

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
      create: jest.fn(async (message) => message),
      deleteMessagesBefore: jest.fn(),
      deleteByRoomId: jest.fn(),
    } as jest.Mocked<IChatMessageRepository>;

    mockProfileRepository = {
      findById: jest.fn(async (id: string) => profiles[id] ?? null),
      findByUsername: jest.fn(),
      findByUserIds: jest.fn(async (userIds: string[]) =>
        userIds
          .map((userId) => chatProfiles[userId])
          .filter((profile): profile is ChatProfileDto => Boolean(profile)),
      ),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      updateLastSeen: jest.fn(),
      updateGameStats: jest.fn(),
      searchByUsername: jest.fn(),
    } as jest.Mocked<IUserProfileRepository>;

    mockAuthService = {
      getUserFromSocketToken: jest.fn(
        async (token: string) => authenticatedUsersByToken[token] ?? null,
      ),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [SocialModule],
    })
      .overrideProvider('IChatRoomRepository')
      .useValue(mockChatRoomRepository)
      .overrideProvider('IChatMessageRepository')
      .useValue(mockChatMessageRepository)
      .overrideProvider('IUserProfileRepository')
      .useValue(mockProfileRepository)
      .overrideProvider(AuthService)
      .useValue(mockAuthService)
      .overrideProvider(SupabaseService)
      .useValue({})
      .compile();

    app = moduleFixture.createNestApplication();
    await app.listen(0);

    clientSocket = await createClient('token-user-1');
  });

  afterEach(async () => {
    await Promise.all(
      clients.map(
        (socket) =>
          new Promise<void>((resolve) => {
            if (!socket.connected) {
              socket.close();
              resolve();
              return;
            }

            socket.once('disconnect', () => resolve());
            socket.disconnect();
          }),
      ),
    );

    clients = [];

    if (app) {
      await app.close();
    }
  });

  describe('Connection', () => {
    it('should connect successfully', () => {
      expect(clientSocket.connected).toBe(true);
      expect(mockAuthService.getUserFromSocketToken).toHaveBeenCalledWith(
        'token-user-1',
      );
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

      clientSocket.emit('chat:join-room', { roomId });
    });

    it('should treat duplicate joins as idempotent', (done) => {
      const roomId = 'test-room-repeat';
      let joinCount = 0;

      clientSocket.on(
        'chat:joined',
        (data: { roomId: string; success: boolean }) => {
          expect(data.roomId).toBe(roomId);
          expect(data.success).toBe(true);
          joinCount += 1;
          if (joinCount === 1) {
            clientSocket.emit('chat:join-room', { roomId });
            return;
          }
          done();
        },
      );

      clientSocket.emit('chat:join-room', { roomId });
    });
  });

  describe('chat:leave-room', () => {
    it('should leave a chat room successfully', (done) => {
      const roomId = 'test-room-2';

      clientSocket.emit('chat:join-room', { roomId });

      clientSocket.on('chat:joined', () => {
        clientSocket.on(
          'chat:left',
          (data: { roomId: string; success: boolean }) => {
            expect(data.roomId).toBe(roomId);
            expect(data.success).toBe(true);
            done();
          },
        );

        clientSocket.emit('chat:leave-room', { roomId });
      });
    });
  });

  describe('chat:post-message', () => {
    it('should post and broadcast message successfully', (done) => {
      const roomId = 'test-room-3';
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
        senderId: UserId.create('user-1'),
        content,
        contentType: 'text',
        createdAt: new Date(),
      });

      mockChatRoomRepository.findById.mockResolvedValue(mockRoom);
      mockChatMessageRepository.create.mockResolvedValue(mockMessage);

      clientSocket.emit('chat:join-room', { roomId });

      clientSocket.on('chat:joined', () => {
        clientSocket.on('chat:message', (data) => {
          expect(data.type).toBe('chat.message');
          expect(data.roomId).toBe(roomId);
          expect(data.message.content).toBe(content);
          expect(data.message.sender.userId).toBe('user-1');
          done();
        });

        clientSocket.emit('chat:post-message', {
          roomId,
          content,
        });
      });
    });

    it('should broadcast to multiple users in the same room', async () => {
      const roomId = 'test-room-4';
      const content = 'Message to all';
      const client2 = await createClient('token-user-2');

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
        senderId: UserId.create('user-1'),
        content,
        contentType: 'text',
        createdAt: new Date(),
      });

      mockChatRoomRepository.findById.mockResolvedValue(mockRoom);
      mockChatMessageRepository.create.mockResolvedValue(mockMessage);

      await new Promise<void>((resolve) => {
        let joinedCount = 0;
        const onJoined = () => {
          joinedCount += 1;
          if (joinedCount === 2) {
            resolve();
          }
        };

        clientSocket.once('chat:joined', onJoined);
        client2.once('chat:joined', onJoined);

        clientSocket.emit('chat:join-room', { roomId });
        client2.emit('chat:join-room', { roomId });
      });

      await new Promise<void>((resolve) => {
        let messagesReceived = 0;
        const handleMessage = (data: {
          message: { content: string };
          roomId: string;
        }) => {
          expect(data.message.content).toBe(content);
          expect(data.roomId).toBe(roomId);
          messagesReceived += 1;
          if (messagesReceived === 2) {
            resolve();
          }
        };

        clientSocket.once('chat:message', handleMessage);
        client2.once('chat:message', handleMessage);

        clientSocket.emit('chat:post-message', {
          roomId,
          content,
        });
      });
    });
  });

  describe('chat:typing', () => {
    it('should broadcast typing event to other users', async () => {
      const roomId = 'test-room-5';
      const client2 = await createClient('token-user-2');

      await new Promise<void>((resolve) => {
        let joinedCount = 0;
        const onJoined = () => {
          joinedCount += 1;
          if (joinedCount === 2) {
            resolve();
          }
        };

        clientSocket.once('chat:joined', onJoined);
        client2.once('chat:joined', onJoined);

        clientSocket.emit('chat:join-room', { roomId });
        client2.emit('chat:join-room', { roomId });
      });

      await new Promise<void>((resolve) => {
        client2.once(
          'chat:typing',
          (data: { type: string; roomId: string; userId: string }) => {
            expect(data.type).toBe('chat.typing');
            expect(data.roomId).toBe(roomId);
            expect(data.userId).toBe('user-1');
            resolve();
          },
        );

        clientSocket.emit('chat:typing', { roomId });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing chat room error', (done) => {
      const roomId = 'non-existent-room';

      mockChatRoomRepository.findById.mockResolvedValue(null);

      clientSocket.on('chat:joined', () => {
        clientSocket.once('chat:error', (data: { message: string }) => {
          expect(data.message).toBe('Failed to post message');
          done();
        });

        clientSocket.emit('chat:post-message', {
          roomId,
          content: 'Test',
        });
      });

      clientSocket.emit('chat:join-room', { roomId });
    });
  });
});
