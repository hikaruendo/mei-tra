import type React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { Navigation } from '@/components/layout/Navigation';

const replaceMock = jest.fn();
const setThemePreferenceMock = jest.fn();
const setFontSizePreferenceMock = jest.fn();

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({
    alt,
    priority,
    unoptimized,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & {
    priority?: boolean;
    unoptimized?: boolean;
  }) => {
    void priority;
    void unoptimized;

    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img alt={alt} {...props} />
    );
  },
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    themePreference: 'dark',
    fontSizePreference: 'large',
    setThemePreference: setThemePreferenceMock,
    setFontSizePreference: setFontSizePreferenceMock,
  }),
}));

jest.mock('@/i18n/routing', () => ({
  Link: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  usePathname: () => '/rooms',
  useRouter: () => ({ replace: replaceMock }),
}));

jest.mock('next-intl', () => ({
  useLocale: () => 'ja',
  useTranslations: () => {
    const labels: Record<string, string> = {
      rooms: 'ルーム一覧',
      tutorial: 'ドキュメント',
      discord: 'Discord',
      x: 'X',
      community: 'コミュニティ',
      externalLink: '外部リンク',
      menu: 'メニュー',
      themeLabel: 'テーマ',
      themeSystem: 'システム',
      themeLight: 'ライト',
      themeDark: 'ダーク',
      fontSizeLabel: '文字サイズ',
      fontSizeStandard: '標準',
      fontSizeLarge: '大きめ',
      fontSizeXLarge: '大きい',
      fontSizeXXLarge: '特大',
      unavailableDuringGame: '対局中はこの操作を行えません',
      languageLabel: '言語',
      languageJapanese: '日本語',
      languageEnglish: 'English',
    };

    return (key: string) => labels[key] ?? key;
  },
}));

jest.mock('@/components/profile/UserProfile', () => ({
  UserProfile: ({
    variant,
    isGameInProgress,
  }: {
    variant?: 'default' | 'compact';
    isGameInProgress?: boolean;
  }) => (
    <div
      data-testid={`user-profile-${variant ?? 'default'}`}
      data-game-in-progress={String(isGameInProgress ?? false)}
    >
      profile
    </div>
  ),
}));

describe('Navigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opens the font size menu and updates the selected preset', () => {
    render(<Navigation />);

    fireEvent.click(screen.getByRole('button', { name: '文字サイズ: 大きめ' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /大きい/ }));

    expect(setFontSizePreferenceMock).toHaveBeenCalledWith('xlarge');
    expect(screen.queryByRole('menuitemradio', { name: /特大/ })).not.toBeInTheDocument();
  });

  it('shows the configured font size options', () => {
    render(<Navigation />);

    expect(screen.getAllByRole('button', { name: /文字サイズ:/ })).toHaveLength(4);
    expect(screen.getByRole('button', { name: '文字サイズ: 標準 1.0x' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '文字サイズ: 大きめ 1.5x' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '文字サイズ: 大きい 2.0x' })).toBeInTheDocument();
  });

  it('opens the theme menu and updates the theme', () => {
    render(<Navigation />);

    fireEvent.click(screen.getByRole('button', { name: /テーマ/ }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /ライト/ }));

    expect(setThemePreferenceMock).toHaveBeenCalledWith('light');
  });

  it('switches the locale from the language menu', () => {
    render(<Navigation />);

    fireEvent.click(screen.getByRole('button', { name: /言語/ }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /English/ }));

    expect(replaceMock).toHaveBeenCalledWith('/rooms', { locale: 'en' });
  });

  it('shows social links in the shared navigation', () => {
    render(<Navigation />);

    fireEvent.click(screen.getByRole('button', { name: 'コミュニティ' }));

    const communityMenu = screen.getByRole('menu', { name: 'コミュニティ' });
    expect(within(communityMenu).getByRole('menuitem', { name: /^Discord/ })).toBeInTheDocument();
    expect(within(communityMenu).getByRole('menuitem', { name: /^X/ })).toBeInTheDocument();
  });

  it('blocks game-disrupting navigation while keeping accessibility settings available', () => {
    render(<Navigation gameStarted />);

    for (const link of screen.getAllByText(/^(ルーム一覧|ドキュメント)$/)) {
      expect(link).toHaveAttribute('aria-disabled', 'true');
      expect(link).not.toHaveAttribute('href');
    }
    expect(screen.getByText('Meitra').closest('a')).toBeNull();
    expect(screen.getByTestId('user-profile-compact')).toHaveAttribute('data-game-in-progress', 'true');
    expect(screen.getByTestId('user-profile-default')).toHaveAttribute('data-game-in-progress', 'true');

    fireEvent.click(screen.getByRole('button', { name: /テーマ/ }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /ライト/ }));

    expect(setThemePreferenceMock).toHaveBeenCalledWith('light');
  });
});
