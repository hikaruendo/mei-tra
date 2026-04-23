import { renderHook, waitFor } from '@testing-library/react';
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
});
