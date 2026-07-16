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
      edit: 'プロフィールを編集',
      loading: 'プロフィールを読み込み中...',
      loginButton: 'ログイン',
      guestUser: 'ゲストユーザー',
      profileImage: 'プロフィール画像',
      accountInfo: 'アカウント情報',
      loggingOut: 'ログアウト中...',
      logout: 'ログアウト',
      unavailableDuringGame: '対局中はこの操作を行えません',
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
    expect(screen.getByRole('menuitem', { name: /プロフィールを編集/ })).toHaveAttribute('href', '/profile');
    expect(screen.getByRole('menuitem', { name: /ログアウト/ })).toBeInTheDocument();
  });

  it('shows a dedicated profile edit link in the default layout', () => {
    render(<UserProfile />);

    expect(screen.getByRole('link', { name: /プロフィールを編集/ })).toHaveAttribute('href', '/profile');
  });

  it('uses disabled buttons for profile editing and logout during a game', () => {
    render(<UserProfile isGameInProgress />);

    const profileButton = screen.getByRole('button', { name: /プロフィールを編集/ });
    expect(profileButton).toBeDisabled();
    expect(profileButton).toHaveAttribute('title', '対局中はこの操作を行えません');

    const logoutButton = screen.getByRole('button', { name: 'ログアウト' });
    expect(logoutButton).toBeDisabled();
    expect(logoutButton).toHaveAttribute('title', '対局中はこの操作を行えません');
  });

  it('uses a disabled button for profile editing in the compact menu during a game', () => {
    render(<UserProfile variant="compact" isGameInProgress />);

    fireEvent.click(screen.getByRole('button', { name: /プロフィール/ }));

    const profileButton = screen.getByRole('menuitem', { name: 'プロフィールを編集' });
    expect(profileButton).toBeDisabled();
    expect(profileButton).toHaveAttribute('title', '対局中はこの操作を行えません');
  });
});
