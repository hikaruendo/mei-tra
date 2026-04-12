import type React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { UserProfile } from '@/components/profile/UserProfile';

const signOutMock = jest.fn();

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: '8dea1f1f-1234-5678-9999-abcdef123456',
      email: 'hika.blue91@gmail.com',
      profile: {
        displayName: 'hika.blue91@gmail.com',
        username: '8dea1f1f',
        avatarUrl: null,
      },
    },
    signOut: signOutMock,
    loading: false,
  }),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => {
    const labels: Record<string, string> = {
      title: 'プロフィール',
      loading: 'プロフィールを読み込み中...',
      loginButton: 'ログイン',
      guestUser: 'ゲストユーザー',
      profileImage: 'プロフィール画像',
      accountInfo: 'アカウント情報',
      loggingOut: 'ログアウト中...',
      logout: 'ログアウト',
    };

    return (key: string) => labels[key] ?? key;
  },
}));

jest.mock('@/components/auth/AuthModal', () => ({
  AuthModal: () => null,
}));

describe('UserProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the compact account menu from the avatar trigger', () => {
    render(<UserProfile variant="compact" />);

    fireEvent.click(screen.getByRole('button', { name: /プロフィール/ }));

    expect(screen.getByRole('menu', { name: /アカウント情報/ })).toBeInTheDocument();
    expect(screen.getByText('hika.blue91@gmail.com')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /ログアウト/ })).toBeInTheDocument();
  });
});
