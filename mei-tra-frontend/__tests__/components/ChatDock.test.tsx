import { render, waitFor } from '@testing-library/react';
import { ChatDock } from '@/components/social/ChatDock';

const mockJoinRoom = jest.fn();
const mockLeaveRoom = jest.fn();
const mockSendMessage = jest.fn();
let mockIsConnected = true;

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values?.count ? `${key}:${values.count}` : key,
}));

jest.mock('@/components/social/ChatMessage', () => ({
  ChatMessage: () => <div>message</div>,
}));

jest.mock('@/components/social/ChatComposer', () => ({
  ChatComposer: () => <div>composer</div>,
}));

jest.mock('@/hooks/useSocialSocket', () => ({
  useSocialSocket: () => ({
    isConnected: mockIsConnected,
    joinRoom: mockJoinRoom,
    leaveRoom: mockLeaveRoom,
    sendMessage: mockSendMessage,
  }),
  useChatMessages: () => ({
    messages: [],
    typingUsers: new Set(),
  }),
}));

describe('ChatDock', () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
    mockJoinRoom.mockClear();
    mockLeaveRoom.mockClear();
    mockSendMessage.mockClear();
    mockIsConnected = true;
  });

  it('rejoins the room after the social socket reconnects', async () => {
    const { rerender } = render(
      <ChatDock roomId="room-1" gameStarted={false} placement="topbar" />,
    );

    await waitFor(() => expect(mockJoinRoom).toHaveBeenCalledTimes(1));

    mockIsConnected = false;
    rerender(
      <ChatDock roomId="room-1" gameStarted={false} placement="topbar" />,
    );

    mockIsConnected = true;
    rerender(
      <ChatDock roomId="room-1" gameStarted={false} placement="topbar" />,
    );

    await waitFor(() => expect(mockJoinRoom).toHaveBeenCalledTimes(2));
  });
});
