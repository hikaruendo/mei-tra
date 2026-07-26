import { act, renderHook, waitFor } from '@testing-library/react';
import { useChatMessages } from '@/hooks/useSocialSocket';
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

  it('keeps a live message when the history response arrives afterward', async () => {
    const listeners = new Map<string, (payload: never) => void>();
    const socket = {
      connected: true,
      emit: jest.fn(),
      on: jest.fn((event: string, handler: (payload: never) => void) => {
        listeners.set(event, handler);
      }),
      off: jest.fn(),
    };

    mockUseSocialSocketContext.mockReturnValue({
      socket: socket as never,
      isConnected: true,
    });

    const { result } = renderHook(() => useChatMessages('room-1'));
    const liveMessage = {
      id: 'message-live',
      sender: {
        userId: 'user-2',
        displayName: 'Player 2',
        rankTier: 'novice',
      },
      content: 'Hello',
      contentType: 'text' as const,
      createdAt: '2026-07-26T00:00:01.000Z',
    };

    act(() => {
      listeners.get('chat:message')?.({
        type: 'chat.message',
        roomId: 'room-1',
        message: liveMessage,
      } as never);
      listeners.get('chat:messages')?.({
        roomId: 'room-1',
        messages: [],
      } as never);
    });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].message.id).toBe('message-live');
    });
  });
});
