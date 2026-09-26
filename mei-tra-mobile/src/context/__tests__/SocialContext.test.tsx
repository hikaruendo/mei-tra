import type { ChatMessage } from '@meitra/contracts/social';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { SocialProvider, useSocial } from '../SocialContext';

const mockHandlers = new Map<string, (payload?: unknown) => void>();
const mockSocket = {
  emit: jest.fn(),
  on: jest.fn((event: string, handler: (payload?: unknown) => void) => {
    mockHandlers.set(event, handler);
  }),
  connect: jest.fn(),
  disconnect: jest.fn(),
  removeAllListeners: jest.fn(),
};

jest.mock('socket.io-client', () => ({ io: () => mockSocket }));
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    session: { access_token: 'access-token' },
    getAccessToken: jest.fn(async () => 'access-token'),
  }),
}));
jest.mock('@/lib/config', () => ({
  config: { backendUrl: 'http://localhost:3001' },
}));

let social: ReturnType<typeof useSocial>;
function Consumer() {
  social = useSocial();
  return null;
}

describe('SocialProvider moderation sync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHandlers.clear();
  });

  it('hides messages after a block on another session and reloads after unblock', async () => {
    let renderer: ReturnType<typeof TestRenderer.create> | null = null;
    await act(async () => {
      renderer = TestRenderer.create(
        <SocialProvider><Consumer /></SocialProvider>,
      );
    });
    act(() => social.joinRoom('room-1'));

    const message: ChatMessage = {
      id: 'message-1',
      sender: { userId: 'blocked-user', displayName: 'Blocked', rankTier: 'bronze' },
      content: 'Hello',
      contentType: 'text',
      createdAt: '2026-09-26T00:00:00Z',
    };
    act(() => mockHandlers.get('chat:messages')?.({ roomId: 'room-1', messages: [message] }));
    expect(social.messages).toHaveLength(1);

    act(() => mockHandlers.get('chat:blocked-users')?.({
      users: [{ userId: 'blocked-user', displayName: 'Blocked' }],
    }));
    expect(social.blockedUserIds).toEqual(['blocked-user']);
    expect(social.messages).toHaveLength(0);

    act(() => mockHandlers.get('chat:message')?.({ roomId: 'room-1', message }));
    expect(social.messages).toHaveLength(0);

    act(() => mockHandlers.get('chat:blocked-users')?.({ users: [] }));
    expect(mockSocket.emit).toHaveBeenLastCalledWith('chat:list-messages', {
      roomId: 'room-1', limit: 50,
    });

    await act(async () => renderer?.unmount());
  });
});
