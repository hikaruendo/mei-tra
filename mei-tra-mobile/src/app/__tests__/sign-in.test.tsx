import React from 'react';
import { Platform } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import SignInScreen from '../sign-in';

const mockReplace = jest.fn();
const mockSignInWithGoogle = jest.fn();
const mockSignInWithApple = jest.fn();
const mockButtonPressHandlers: (() => void)[] = [];
const mockButtonLabels: React.ReactNode[] = [];
const originalPlatform = Platform.OS;

jest.mock('expo-router', () => ({
  Redirect: () => null,
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    signIn: jest.fn(),
    signUp: jest.fn(),
    signInWithGoogle: mockSignInWithGoogle,
    signInWithApple: mockSignInWithApple,
    signInAnonymously: jest.fn(),
  }),
}));

jest.mock('@/context/LocaleContext', () => ({
  useLocale: jest.fn(),
}));

jest.mock('@/components/ui/BrandHeader', () => ({
  BrandHeader: () => null,
}));

jest.mock('@/components/auth/AppleSignInButton', () => ({
  AppleSignInButton: ({ onPress }: { onPress: () => void }) => {
    mockButtonPressHandlers.push(onPress);
    mockButtonLabels.push('Appleで続ける');
    return null;
  },
}));

jest.mock('@/components/ui/Screen', () => ({
  Screen: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/components/ui/Button', () => {
  return {
    Button: ({ children, onPress }: { children: React.ReactNode; onPress: () => void }) => {
      mockButtonPressHandlers.push(onPress);
      mockButtonLabels.push(children);
      return null;
    },
  };
});

describe('SignInScreen Google OAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockButtonPressHandlers.length = 0;
    mockButtonLabels.length = 0;
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
  });

  it('offers both Google and Apple sign-in on iOS', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });

    await act(async () => {
      TestRenderer.create(<SignInScreen />);
    });

    expect(mockButtonLabels).toContain('Googleで続ける');
    expect(mockButtonLabels).toContain('Appleで続ける');
    expect(mockButtonLabels).toContain('ゲストとして遊ぶ');
  });

  it('keeps Google sign-in on Android and stays put when OAuth is cancelled', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    mockSignInWithGoogle.mockResolvedValue({ error: null, cancelled: true });

    await act(async () => {
      TestRenderer.create(<SignInScreen />);
    });

    const [pressGoogle] = mockButtonPressHandlers;
    expect(pressGoogle).toBeDefined();
    expect(mockButtonLabels).toContain('Googleで続ける');

    await act(async () => {
      await pressGoogle!();
    });

    expect(mockReplace).not.toHaveBeenCalled();
  });
});
