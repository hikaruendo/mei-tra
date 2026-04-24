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
      languageLabel: '言語',
      languageJapanese: '日本語',
      languageEnglish: 'English',
    };

    return (key: string) => labels[key] ?? key;
  },
}));

jest.mock('@/components/profile/UserProfile', () => ({
  UserProfile: ({ variant }: { variant?: 'default' | 'compact' }) => (
    <div data-testid={`user-profile-${variant ?? 'default'}`}>profile</div>
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

  it('shows three icon buttons for mobile font size selection', () => {
    render(<Navigation />);

    expect(screen.getAllByRole('button', { name: /文字サイズ:/ })).toHaveLength(4);
    expect(screen.getByRole('button', { name: '文字サイズ: 標準 100%' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '文字サイズ: 大きめ 120%' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '文字サイズ: 大きい 150%' })).toBeInTheDocument();
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
});
