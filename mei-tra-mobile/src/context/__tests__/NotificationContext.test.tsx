import type { NotificationResponse } from 'expo-notifications';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { NotificationProvider } from '../NotificationContext';

const mockPush = jest.fn();
const mockResumeRoom = jest.fn(async () => undefined);
let mockResponseHandler: ((response: NotificationResponse) => void) | null = null;

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    session: { access_token: 'access-token' },
    getAccessToken: jest.fn(async () => 'access-token'),
  }),
}));

jest.mock('@/context/GameContext', () => ({
  useGame: () => ({ resumeRoom: mockResumeRoom }),
}));

jest.mock('@/lib/notifications', () => ({
  getNotificationRoomId: jest.fn(
    (response: NotificationResponse) =>
      response.notification.request.content.data?.roomId ?? null,
  ),
  registerForPushNotifications: jest.fn(async () => ({ status: 'registered' })),
  setupNotificationHandling: jest.fn(
    (handler: (response: NotificationResponse) => void) => {
      mockResponseHandler = handler;
      return jest.fn();
    },
  ),
}));

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('NotificationProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResponseHandler = null;
  });

  it('resumes the notification room before routing to it', async () => {
    let renderer: ReturnType<typeof TestRenderer.create> | null = null;
    await act(async () => {
      renderer = TestRenderer.create(
        <NotificationProvider>
          <></>
        </NotificationProvider>,
      );
      await flushPromises();
    });

    const response = {
      notification: {
        request: {
          identifier: 'notification-1',
          content: { data: { roomId: 'room-notification' } },
        },
      },
    } as unknown as NotificationResponse;

    act(() => {
      mockResponseHandler?.(response);
    });

    expect(mockResumeRoom).toHaveBeenCalledWith('room-notification');
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/room/[roomId]',
      params: { roomId: 'room-notification' },
    });

    await act(async () => {
      renderer?.unmount();
      await flushPromises();
    });
  });
});
