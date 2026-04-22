import type React from 'react';
import { render, screen } from '@testing-library/react';
import { ProfileRecentMatchesSection } from '@/components/profile/ProfileRecentMatchesSection';

const useProfileGameHistoryMock = jest.fn();

jest.mock('@/hooks/useProfileGameHistory', () => ({
  useProfileGameHistory: (...args: unknown[]) => useProfileGameHistoryMock(...args),
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
}));

jest.mock('next-intl', () => ({
  useLocale: () => 'ja',
  useTranslations: (namespace: string) => {
    if (namespace === 'profile') {
      const labels: Record<string, string> = {
        recentMatchesTitle: '最近の対局',
        recentMatchesDescription: '完了した対局だけを新しい順で表示します。',
        recentMatchesLoading: '対局ログを読み込み中...',
        recentMatchesEmpty: 'まだ対局ログがありません',
        recentMatchesError: '対局ログの読み込みに失敗しました',
        recentMatchesRounds: 'ラウンド数',
        recentMatchesEntries: 'ログ件数',
        recentMatchesWinner: '勝利',
        recentMatchesLastAction: '最新アクション',
        recentMatchesDetails: '詳細を見る',
        recentMatchesNoWinner: '未確定',
        recentMatchesNoAction: 'なし',
      };

      return (key: string) => labels[key] ?? key;
    }

    if (namespace === 'gameHistoryDock') {
      return (key: string, values?: { team?: number }) => {
        if (key === 'teamValue') {
          return `チーム${values?.team}`;
        }

        const actionLabels: Record<string, string> = {
          'actionTypes.game_over': 'ゲーム終了',
        };

        return actionLabels[key] ?? key;
      };
    }

    return (key: string) => key;
  },
}));

describe('ProfileRecentMatchesSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows an empty state when there is no match history', () => {
    useProfileGameHistoryMock.mockReturnValue({
      items: [],
      isLoading: false,
      error: null,
    });

    render(
      <ProfileRecentMatchesSection
        userId="user-1"
        getAccessToken={async () => 'token'}
      />,
    );

    expect(screen.getByText('最近の対局')).toBeInTheDocument();
    expect(screen.getByText('まだ対局ログがありません')).toBeInTheDocument();
  });

  it('renders recent matches with detail links', () => {
    useProfileGameHistoryMock.mockReturnValue({
      items: [
        {
          roomId: 'room-1',
          roomName: 'Alpha room',
          completedAt: new Date('2026-04-16T01:00:00.000Z'),
          roundCount: 4,
          totalEntries: 18,
          winningTeam: 1,
          lastActionType: 'game_over',
        },
      ],
      isLoading: false,
      error: null,
    });

    render(
      <ProfileRecentMatchesSection
        userId="user-1"
        getAccessToken={async () => 'token'}
      />,
    );

    expect(screen.getByText('Alpha room')).toBeInTheDocument();
    expect(screen.getByText('ゲーム終了')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /詳細を見る/ })).toHaveAttribute(
      'href',
      '/game-history/room-1',
    );
  });
});
