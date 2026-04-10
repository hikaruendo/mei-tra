import { Server, Socket } from 'socket.io';
import { SocialGateway } from '../social.gateway';
import { ChatService } from '../services/chat.service';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedUser } from '../types/user.types';

type MockSocket = {
  id: string;
  handshake: { auth: Record<string, string> };
  emit: jest.Mock;
  disconnect: jest.Mock;
  join: jest.Mock;
  leave: jest.Mock;
  to: jest.Mock;
  data: { user?: AuthenticatedUser };
};

describe('SocialGateway', () => {
  let gateway: SocialGateway;
  let chatService: jest.Mocked<
    Pick<ChatService, 'postMessage' | 'listMessages'>
  >;
  let authService: jest.Mocked<Pick<AuthService, 'getUserFromSocketToken'>>;
  let serverEmit: jest.Mock;
  let serverTo: jest.Mock;

  const authenticatedUser: AuthenticatedUser = {
    id: 'user-1',
    email: 'user@example.com',
    profile: {
      id: 'user-1',
      username: 'user1',
      displayName: 'User One',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSeenAt: new Date(),
      gamesPlayed: 0,
      gamesWon: 0,
      totalScore: 0,
      preferences: { notifications: true, sound: true, theme: 'dark' },
    },
  };

  const asSocket = (socket: MockSocket): Socket => socket as unknown as Socket;

  const createSocket = (token?: string): MockSocket => {
    const socketToEmit = jest.fn();

    return {
      id: 'socket-1',
      handshake: {
        auth: token ? { token } : {},
      },
      data: {},
      emit: jest.fn(),
      disconnect: jest.fn(),
      join: jest.fn().mockResolvedValue(undefined),
      leave: jest.fn().mockResolvedValue(undefined),
      to: jest.fn().mockReturnValue({ emit: socketToEmit }),
    };
  };

  beforeEach(() => {
    chatService = {
      postMessage: jest.fn(),
      listMessages: jest.fn(),
    };
    authService = {
      getUserFromSocketToken: jest.fn(),
    };
    serverEmit = jest.fn();
    serverTo = jest.fn().mockReturnValue({ emit: serverEmit });

    gateway = new SocialGateway(
      chatService as unknown as ChatService,
      authService as unknown as AuthService,
    );
    gateway.server = {
      to: serverTo,
    } as unknown as Server;
  });

  describe('handleConnection', () => {
    it('disconnects when token is missing', async () => {
      const socket = createSocket();

      await gateway.handleConnection(asSocket(socket));

      expect(authService.getUserFromSocketToken).not.toHaveBeenCalled();
      expect(socket.emit).toHaveBeenCalledWith('chat:error', {
        message: 'Authentication required',
      });
      expect(socket.disconnect).toHaveBeenCalled();
    });

    it('disconnects when token is invalid', async () => {
      const socket = createSocket('invalid-token');
      authService.getUserFromSocketToken.mockResolvedValue(null);

      await gateway.handleConnection(asSocket(socket));

      expect(authService.getUserFromSocketToken).toHaveBeenCalledWith(
        'invalid-token',
      );
      expect(socket.emit).toHaveBeenCalledWith('chat:error', {
        message: 'Invalid authentication token',
      });
      expect(socket.disconnect).toHaveBeenCalled();
    });

    it('stores authenticated user when token is valid', async () => {
      const socket = createSocket('valid-token');
      authService.getUserFromSocketToken.mockResolvedValue(authenticatedUser);

      await gateway.handleConnection(asSocket(socket));

      expect(socket.data.user).toEqual(authenticatedUser);
      expect(socket.disconnect).not.toHaveBeenCalled();
    });
  });

  it('posts messages as the authenticated user and ignores spoofed userId', async () => {
    const socket = createSocket('valid-token');
    socket.data.user = authenticatedUser;
    const event = {
      type: 'chat.message' as const,
      roomId: 'room-1',
      message: {
        id: 'message-1',
        sender: {
          userId: 'user-1',
          displayName: 'User One',
          rankTier: 'bronze',
        },
        content: 'hello',
        contentType: 'text' as const,
        createdAt: new Date().toISOString(),
      },
    };
    chatService.postMessage.mockResolvedValue(event);

    await gateway.handlePostMessage(asSocket(socket), {
      roomId: 'room-1',
      userId: 'attacker-user',
      content: 'hello',
      contentType: 'text',
    });

    expect(chatService.postMessage).toHaveBeenCalledWith({
      roomId: 'room-1',
      userId: 'user-1',
      content: 'hello',
      contentType: 'text',
      replyTo: undefined,
    });
    expect(serverTo).toHaveBeenCalledWith('room-1');
    expect(serverEmit).toHaveBeenCalledWith('chat:message', event);
  });

  it('sends typing events as the authenticated user and ignores spoofed userId', async () => {
    const socket = createSocket('valid-token');
    socket.data.user = authenticatedUser;

    await gateway.handleTyping(asSocket(socket), {
      roomId: 'room-1',
      userId: 'attacker-user',
    });

    expect(socket.to).toHaveBeenCalledWith('room-1');
    const socketToTarget = socket.to.mock.results[0].value as {
      emit: jest.Mock;
    };
    expect(socketToTarget.emit).toHaveBeenCalledWith(
      'chat:typing',
      expect.objectContaining({
        type: 'chat.typing',
        roomId: 'room-1',
        userId: 'user-1',
      }),
    );
  });
});
