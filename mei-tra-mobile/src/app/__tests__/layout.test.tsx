import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import RootLayout from '../_layout';

const mockStack = jest.fn(({ children }: { children?: React.ReactNode }) => children);
const mockScreen = jest.fn((_props: unknown) => null);
const mockProvider = ({ children }: { children?: React.ReactNode }) => children;

jest.mock('expo-router', () => ({
  Stack: Object.assign(
    (props: { children?: React.ReactNode }) => mockStack(props),
    { Screen: (props: unknown) => mockScreen(props) },
  ),
}));
jest.mock('@react-navigation/native', () => ({
  DarkTheme: { colors: {} },
  ThemeProvider: (props: { children?: React.ReactNode }) => mockProvider(props),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: (props: { children?: React.ReactNode }) => mockProvider(props),
}));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('@/context/AuthContext', () => ({
  AuthProvider: (props: { children?: React.ReactNode }) => mockProvider(props),
}));
jest.mock('@/context/GameContext', () => ({
  GameProvider: (props: { children?: React.ReactNode }) => mockProvider(props),
}));
jest.mock('@/context/LocaleContext', () => ({
  LocaleProvider: (props: { children?: React.ReactNode }) => mockProvider(props),
}));
jest.mock('@/context/NotificationContext', () => ({
  NotificationProvider: (props: { children?: React.ReactNode }) => mockProvider(props),
}));
jest.mock('@/context/SocialContext', () => ({
  SocialProvider: (props: { children?: React.ReactNode }) => mockProvider(props),
}));

it('disables native back swipes in the room without disabling them across the app', () => {
  act(() => {
    TestRenderer.create(<RootLayout />);
  });

  expect(mockScreen).toHaveBeenCalledWith({
    name: 'room/[roomId]',
    options: { gestureEnabled: false },
  });
  expect(mockStack).toHaveBeenCalledWith(
    expect.objectContaining({
      screenOptions: expect.not.objectContaining({ gestureEnabled: false }),
    }),
  );
});
