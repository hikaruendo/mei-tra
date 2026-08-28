import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import SignInScreen from '../sign-in';

const mockReplace = jest.fn();
const mockSignInWithGoogle = jest.fn();
const mockButtonPressHandlers: (() => void)[] = [];

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
    signInAnonymously: jest.fn(),
  }),
}));

jest.mock('@/context/LocaleContext', () => ({
  useLocale: jest.fn(),
}));

jest.mock('@/components/ui/BrandHeader', () => ({
  BrandHeader: () => null,
}));

jest.mock('@/components/ui/Screen', () => ({
  Screen: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/components/ui/Button', () => {
  return {
    Button: ({ onPress }: { onPress: () => void }) => {
      mockButtonPressHandlers.push(onPress);
      return null;
    },
  };
});

describe('SignInScreen Google OAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockButtonPressHandlers.length = 0;
  });

  it('stays on sign-in when the authentication browser is closed', async () => {
    mockSignInWithGoogle.mockResolvedValue({ error: null, cancelled: true });

    await act(async () => {
      TestRenderer.create(<SignInScreen />);
    });

    const [pressGoogle] = mockButtonPressHandlers;
    expect(pressGoogle).toBeDefined();

    await act(async () => {
      await pressGoogle!();
    });

    expect(mockReplace).not.toHaveBeenCalled();
  });
});
