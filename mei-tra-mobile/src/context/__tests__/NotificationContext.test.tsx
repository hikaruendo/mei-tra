import type { NotificationResponse } from 'expo-notifications';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { NotificationProvider } from '../NotificationContext';
import { registerForPushNotifications } from '@/lib/notifications';

const mockPush = jest.fn();
const mockResumeRoom = jest.fn(async () => undefined);
let mockResponseHandler: ((response: NotificationResponse) => void) | null = null;
let mockLifecycleListener:
  | ((
      snapshot: { appState: 'active' | 'background'; isOnline: boolean },
      previous: { appState: 'active' | 'background'; isOnline: boolean },
    ) => void)
  | null = null;

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

jest.mock('@/lib/app-lifecycle', () => ({
  subscribeAppLifecycle: (
    listener: typeof mockLifecycleListener,
  ) => {
    mockLifecycleListener = listener;
    return jest.fn();
  },
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
    mockLifecycleListener = null;
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

    expect(registerForPushNotifications).toHaveBeenCalledWith('access-token', {
      requestPermission: false,
    });

    await act(async () => {
      mockLifecycleListener?.(
        { appState: 'active', isOnline: true },
        { appState: 'background', isOnline: true },
      );
      await flushPromises();
    });
    expect(registerForPushNotifications).toHaveBeenCalledTimes(2);

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
