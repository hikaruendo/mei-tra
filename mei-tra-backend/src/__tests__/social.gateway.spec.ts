import { Server, Socket } from 'socket.io';
import { SocialGateway } from '../social.gateway';
import { ChatService } from '../services/chat.service';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedUser } from '../types/user.types';
import { AccountActionGateService } from '../services/account-action-gate.service';
import { ChatModerationService } from '../services/chat-moderation.service';

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
  let accountActionGateService: jest.Mocked<
    Pick<AccountActionGateService, 'ensureActiveSocketActor'>
  >;
  let chatModerationService: jest.Mocked<
    Pick<
      ChatModerationService,
      | 'listBlockedUserIds'
      | 'listBlockedUsers'
      | 'listUsersBlockingSender'
      | 'reportMessage'
      | 'blockUser'
      | 'unblockUser'
    >
  >;
  let serverEmit: jest.Mock;
  let serverTo: jest.Mock;
  let serverExcept: jest.Mock;

  const authenticatedUser: AuthenticatedUser = {
    id: 'user-1',
    email: 'user@example.com',
    isAnonymous: false,
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
      preferences: {
        notifications: true,
        sound: true,
        theme: 'dark',
        fontSize: 'standard',
      },
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
    accountActionGateService = {
      ensureActiveSocketActor: jest.fn().mockResolvedValue({
        allowed: true,
        authenticatedUser,
      }),
    };
    chatModerationService = {
      listBlockedUserIds: jest.fn().mockResolvedValue([]),
      listBlockedUsers: jest.fn().mockResolvedValue([]),
      listUsersBlockingSender: jest.fn().mockResolvedValue([]),
      reportMessage: jest.fn(),
      blockUser: jest.fn(),
      unblockUser: jest.fn(),
    };
    serverEmit = jest.fn();
    serverExcept = jest.fn().mockReturnValue({ emit: serverEmit });
    serverTo = jest.fn().mockReturnValue({
      except: serverExcept,
      emit: serverEmit,
    });

    gateway = new SocialGateway(
      chatService as unknown as ChatService,
      authService as unknown as AuthService,
      accountActionGateService as unknown as AccountActionGateService,
      chatModerationService as unknown as ChatModerationService,
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
    expect(
      accountActionGateService.ensureActiveSocketActor,
    ).toHaveBeenCalledWith(socket, 'post a chat message');
    expect(socket.emit).toHaveBeenCalledWith('chat:message', event);
    expect(serverTo).not.toHaveBeenCalled();
  });

  it('does not deliver new messages to a user who blocked the sender', async () => {
    const sender = createSocket('sender');
    const recipient = createSocket('recipient');
    recipient.id = 'socket-2';
    authService.getUserFromSocketToken.mockImplementation(async (token) => ({
      ...authenticatedUser,
      id: token === 'recipient' ? 'user-2' : 'user-1',
    }));
    await gateway.handleConnection(asSocket(sender));
    await gateway.handleConnection(asSocket(recipient));
    await gateway.handleJoinRoom(asSocket(sender), { roomId: 'room-1' });
    await gateway.handleJoinRoom(asSocket(recipient), { roomId: 'room-1' });
    chatService.postMessage.mockResolvedValue({
      type: 'chat.message',
      roomId: 'room-1',
      message: {
        id: 'message-1',
        sender: { userId: 'user-1', displayName: 'A', rankTier: 'bronze' },
        content: 'hello',
        contentType: 'text',
        createdAt: new Date().toISOString(),
      },
    });
    chatModerationService.listUsersBlockingSender.mockResolvedValue(['user-2']);
    await gateway.handlePostMessage(asSocket(sender), {
      roomId: 'room-1',
      content: 'hello',
    });
    expect(sender.emit).toHaveBeenCalledWith('chat:message', expect.anything());
    expect(serverTo).not.toHaveBeenCalled();
  });

  it('records a report under the authenticated user, not a supplied sender', async () => {
    const socket = createSocket('valid-token');
    authService.getUserFromSocketToken.mockResolvedValue(authenticatedUser);
    await gateway.handleConnection(asSocket(socket));
    await gateway.handleJoinRoom(asSocket(socket), { roomId: 'room-1' });
    await gateway.handleReportMessage(asSocket(socket), {
      roomId: 'room-1',
      messageId: 'message-1',
      reason: 'offensive',
    });
    expect(chatModerationService.reportMessage).toHaveBeenCalledWith({
      reporterId: 'user-1',
      roomId: 'room-1',
      messageId: 'message-1',
      reason: 'offensive',
    });
    expect(socket.emit).toHaveBeenCalledWith('chat:reported', {
      messageId: 'message-1',
    });
  });

  it('sends typing events as the authenticated user and ignores spoofed userId', async () => {
    const socket = createSocket('valid-token');
    socket.data.user = authenticatedUser;

    await gateway.handleTyping(asSocket(socket), {
      roomId: 'room-1',
      userId: 'attacker-user',
    });

    expect(
      accountActionGateService.ensureActiveSocketActor,
    ).toHaveBeenCalledWith(socket, 'send a typing event');
    expect(serverTo).not.toHaveBeenCalled();
  });

  it('rejects a cached socket when account deletion is in progress', async () => {
    const socket = createSocket('valid-token');
    socket.data.user = authenticatedUser;
    accountActionGateService.ensureActiveSocketActor.mockResolvedValue({
      allowed: false,
      errorMessage:
        'Account deletion is in progress. Please finish deleting this account before continuing.',
    });

    await gateway.handlePostMessage(asSocket(socket), {
      roomId: 'room-1',
      content: 'should not be saved',
    });

    expect(chatService.postMessage).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('chat:error', {
      message:
        'Account deletion is in progress. Please finish deleting this account before continuing.',
    });
  });

  it('does not emit typing events for a cached socket rejected by the gate', async () => {
    const socket = createSocket('valid-token');
    socket.data.user = authenticatedUser;
    accountActionGateService.ensureActiveSocketActor.mockResolvedValue({
      allowed: false,
      errorMessage: 'Account deletion is in progress.',
    });

    await gateway.handleTyping(asSocket(socket), { roomId: 'room-1' });

    expect(socket.to).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('chat:error', {
      message: 'Account deletion is in progress.',
    });
  });
});
