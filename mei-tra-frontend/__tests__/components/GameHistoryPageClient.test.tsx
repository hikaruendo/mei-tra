import type React from 'react';
import { render, screen } from '@testing-library/react';
import { GameHistoryPageClient } from '@/components/game/GameHistoryPageClient';

const useGameHistoryMock = jest.fn();

jest.mock('@/hooks/useGameHistory', () => ({
  useGameHistory: (...args: unknown[]) => useGameHistoryMock(...args),
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

jest.mock('@/components/game/GameHistoryDock', () => ({
  GameHistoryDock: ({
    teamNames,
  }: {
    teamNames?: Partial<Record<0 | 1, string>>;
  }) => <div data-testid="history-dock" data-team-one={teamNames?.[1]} />,
}));

jest.mock('next-intl', () => ({
  useTranslations: () => {
    const labels: Record<string, string> = {
      statusCompleted: '対局完了',
      statusInProgress: '進行中',
      noWinner: '未確定',
      teamRed: 'チーム赤',
      teamBlack: 'チーム黒',
      unknownTimeWindow: '記録期間なし',
      reportLabel: '対局レポート',
      title: '対局ログ',
      pageDescription: '対局の詳細です',
      backToProfile: 'プロフィールへ戻る',
      overviewWinner: '勝利',
      overviewRounds: 'ラウンド数',
      overviewWindow: '記録期間',
    };

    return (key: string) => labels[key] ?? key;
  },
}));

describe('GameHistoryPageClient', () => {
  it('uses the host-configured team name for the winning team', () => {
    useGameHistoryMock.mockReturnValue({
      summary: {
        roomId: 'room-1',
        totalEntries: 10,
        byActionType: { game_over: 1 },
        actorSeatIds: ['player-1'],
        playerNames: { 'player-1': 'Player 1' },
        teamNames: { 0: '111', 1: '222' },
        status: 'completed',
        winningTeam: 1,
        lastActionType: 'game_over',
        roundNumbers: [1, 2],
        firstTimestamp: new Date('2026-08-12T00:00:00.000Z'),
        lastTimestamp: new Date('2026-08-12T00:30:00.000Z'),
      },
    });

    render(<GameHistoryPageClient roomId="room-1" />);

    expect(screen.getByText('222')).toBeInTheDocument();
    expect(screen.queryByText('チーム黒')).not.toBeInTheDocument();
    expect(screen.getByTestId('history-dock')).toHaveAttribute(
      'data-team-one',
      '222',
    );
  });
});
