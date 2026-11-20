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
let mockGateOpen = true;
let mockAuthLoaded = false;
jest.mock('@/components/app/LaunchGate', () => ({
  LaunchGate: (props: { children?: React.ReactNode }) =>
    mockGateOpen ? mockProvider(props) : null,
}));
jest.mock('@/context/AuthContext', () => {
  mockAuthLoaded = true;
  return {
    AuthProvider: (props: { children?: React.ReactNode }) => mockProvider(props),
  };
});
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

beforeEach(() => {
  jest.resetModules();
  mockGateOpen = true;
  mockAuthLoaded = false;
});

it('does not load auth while the launch gate holds the app', () => {
  mockGateOpen = false;
  const { default: Layout } = jest.requireActual<typeof import('../_layout')>('../_layout');

  act(() => {
    TestRenderer.create(<Layout />);
  });

  expect(mockAuthLoaded).toBe(false);
});

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
