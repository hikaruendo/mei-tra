import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ChatBlockedUser, ChatMessageEvent } from '@contracts/social';
import { ChatDock } from '@/components/social/ChatDock';

const mockJoinRoom = jest.fn();
const mockLeaveRoom = jest.fn();
const mockSendMessage = jest.fn();
const mockReportMessage = jest.fn();
const mockBlockUser = jest.fn();
const mockUnblockUser = jest.fn();
const mockClearNotice = jest.fn();
let mockIsConnected = true;
let mockMessages: ChatMessageEvent[] = [];
let mockBlockedUsers: ChatBlockedUser[] = [];
let mockNotice: 'reported' | 'blocked' | null = null;

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values?.count ? `${key}:${values.count}` : key,
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'self' } }),
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
    reportMessage: mockReportMessage,
    blockUser: mockBlockUser,
    unblockUser: mockUnblockUser,
  }),
  useChatMessages: () => ({
    messages: mockMessages,
    typingUsers: new Set(),
    blockedUsers: mockBlockedUsers,
    notice: mockNotice,
    clearNotice: mockClearNotice,
  }),
}));

describe('ChatDock', () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
    mockJoinRoom.mockClear();
    mockLeaveRoom.mockClear();
    mockSendMessage.mockClear();
    mockReportMessage.mockClear();
    mockBlockUser.mockClear();
    mockUnblockUser.mockClear();
    mockClearNotice.mockClear();
    mockIsConnected = true;
    mockMessages = [];
    mockBlockedUsers = [];
    mockNotice = null;
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

  it('offers moderation on other players only and sends after confirmation', () => {
    mockMessages = [
      {
        type: 'chat.message', roomId: 'room-1',
        message: {
          id: 'own-message', sender: { userId: 'self', displayName: 'Me', rankTier: 'bronze' },
          content: 'My message', contentType: 'text', createdAt: '2026-09-26T00:00:00Z',
        },
      },
      {
        type: 'chat.message', roomId: 'room-1',
        message: {
          id: 'other-message', sender: { userId: 'other', displayName: 'Other', rankTier: 'bronze' },
          content: 'Other message', contentType: 'text', createdAt: '2026-09-26T00:00:00Z',
        },
      },
    ];
    render(<ChatDock roomId="room-1" />);

    expect(screen.getAllByRole('button', { name: 'report' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'block' })).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'report' }));
    expect(mockReportMessage).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }));
    expect(mockReportMessage).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'report' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'report' })[1]);
    expect(mockReportMessage).toHaveBeenCalledWith('room-1', 'other-message');

    fireEvent.click(screen.getByRole('button', { name: 'block' }));
    expect(mockBlockUser).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole('button', { name: 'block' })[1]);
    expect(mockBlockUser).toHaveBeenCalledWith('other');
  });

  it('shows moderation feedback and lets a blocked user be unblocked', () => {
    mockBlockedUsers = [{ userId: 'other', displayName: 'Other' }];
    mockNotice = 'blocked';
    render(<ChatDock roomId="room-1" />);

    expect(screen.getByRole('status')).toHaveTextContent('blocked');
    expect(screen.getByText('blockedCount:1')).toBeInTheDocument();
    fireEvent.click(screen.getByText('unblockUser'));
    expect(mockUnblockUser).toHaveBeenCalledWith('other');
    expect(mockClearNotice).toHaveBeenCalled();
  });
});
