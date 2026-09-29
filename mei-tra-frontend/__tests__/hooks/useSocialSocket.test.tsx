import { act, renderHook, waitFor } from '@testing-library/react';
import type { ChatMessage } from '@contracts/social';
import { useChatMessages, useSocialSocket } from '@/hooks/useSocialSocket';
import { useSocialSocketContext } from '@/contexts/SocialSocketContext';

jest.mock('@/contexts/SocialSocketContext', () => ({
  useSocialSocketContext: jest.fn(),
}));

const mockUseSocialSocketContext =
  useSocialSocketContext as jest.MockedFunction<typeof useSocialSocketContext>;

describe('useChatMessages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads recent messages only after the social socket is connected', async () => {
    const socket = {
      connected: false,
      emit: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
    };

    mockUseSocialSocketContext.mockReturnValue({
      socket: socket as never,
      isConnected: false,
    });

    const { rerender } = renderHook(() => useChatMessages('room-1'));

    expect(socket.emit).not.toHaveBeenCalled();

    socket.connected = true;
    mockUseSocialSocketContext.mockReturnValue({
      socket: socket as never,
      isConnected: true,
    });

    rerender();

    await waitFor(() => {
      expect(socket.emit).toHaveBeenCalledWith('chat:list-messages', {
        roomId: 'room-1',
        limit: 50,
        cursor: undefined,
      });
    });
  });

  it('hides a newly blocked sender on this session and reloads after unblock', () => {
    const handlers = new Map<string, (...args: never[]) => void>();
    const socket = {
      connected: true,
      emit: jest.fn(),
      on: jest.fn((event: string, handler: (...args: never[]) => void) => {
        handlers.set(event, handler);
      }),
      off: jest.fn(),
    };
    mockUseSocialSocketContext.mockReturnValue({
      socket: socket as never,
      isConnected: true,
    });

    const message: ChatMessage = {
      id: 'message-1',
      sender: { userId: 'blocked-user', displayName: 'Blocked', rankTier: 'bronze' },
      content: 'Hello',
      contentType: 'text',
      createdAt: '2026-09-26T00:00:00Z',
    };
    const { result } = renderHook(() => useChatMessages('room-1'));
    act(() => {
      handlers.get('chat:messages')?.({ roomId: 'room-1', messages: [message] } as never);
    });
    expect(result.current.messages).toHaveLength(1);

    act(() => {
      handlers.get('chat:blocked-users')?.({
        users: [{ userId: 'blocked-user', displayName: 'Blocked' }],
      } as never);
    });
    expect(result.current.messages).toHaveLength(0);
    expect(result.current.blockedUsers).toEqual([
      { userId: 'blocked-user', displayName: 'Blocked' },
    ]);
    act(() => {
      handlers.get('chat:message')?.({
        type: 'chat.message', roomId: 'room-1', message,
      } as never);
    });
    expect(result.current.messages).toHaveLength(0);

    act(() => {
      handlers.get('chat:blocked-users')?.({ users: [] } as never);
    });
    expect(socket.emit).toHaveBeenLastCalledWith('chat:list-messages', {
      roomId: 'room-1', limit: 50, cursor: undefined,
    });
    expect(result.current.blockedUsers).toEqual([]);
  });

  it('emits moderation actions and shows server acknowledgements', () => {
    const handlers = new Map<string, (...args: never[]) => void>();
    const socket = {
      connected: true,
      emit: jest.fn(),
      on: jest.fn((event: string, handler: (...args: never[]) => void) => {
        handlers.set(event, handler);
      }),
      off: jest.fn(),
    };
    mockUseSocialSocketContext.mockReturnValue({ socket: socket as never, isConnected: true });

    const { result: actions } = renderHook(() => useSocialSocket());
    const { result: chat } = renderHook(() => useChatMessages('room-1'));
    act(() => {
      actions.current.reportMessage('room-1', 'message-1');
      actions.current.blockUser('other');
      actions.current.unblockUser('other');
    });
    expect(socket.emit).toHaveBeenCalledWith('chat:report-message', {
      roomId: 'room-1', messageId: 'message-1', reason: 'offensive',
    });
    expect(socket.emit).toHaveBeenCalledWith('chat:block-user', { userId: 'other' });
    expect(socket.emit).toHaveBeenCalledWith('chat:unblock-user', { userId: 'other' });

    act(() => handlers.get('chat:reported')?.());
    expect(chat.current.notice).toBe('reported');
    act(() => chat.current.clearNotice());
    expect(chat.current.notice).toBeNull();
    act(() => handlers.get('chat:error')?.({ code: 'CONTENT_REJECTED' } as never));
    expect(chat.current.notice).toBe('filtered');
  });

  it('clears old messages when changing rooms', () => {
    const handlers = new Map<string, (...args: never[]) => void>();
    const socket = {
      connected: true,
      emit: jest.fn(),
      on: jest.fn((event: string, handler: (...args: never[]) => void) => {
        handlers.set(event, handler);
      }),
      off: jest.fn(),
    };
    mockUseSocialSocketContext.mockReturnValue({ socket: socket as never, isConnected: true });

    const { result, rerender } = renderHook(
      ({ roomId }) => useChatMessages(roomId),
      { initialProps: { roomId: 'room-1' } },
    );
    act(() => {
      handlers.get('chat:messages')?.({
        roomId: 'room-1',
        messages: [{
          id: 'message-1', sender: { userId: 'other', displayName: 'Other', rankTier: 'bronze' },
          content: 'Old room', contentType: 'text', createdAt: '2026-09-26T00:00:00Z',
        }],
      } as never);
    });
    expect(result.current.messages).toHaveLength(1);

    rerender({ roomId: 'room-2' });
    expect(result.current.messages).toHaveLength(0);
  });
});
