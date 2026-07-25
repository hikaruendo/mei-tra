import type React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { GameHistoryDock } from '@/components/game/GameHistoryDock';

jest.mock('@/hooks/useGameHistory', () => ({
  useGameHistory: () => ({
    replay: null,
    summary: null,
    isLoading: false,
    error: null,
    refresh: jest.fn(),
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
}));

jest.mock('next-intl', () => ({
  useTranslations: () => {
    const labels: Record<string, string> = {
      title: '対局ログ',
      waiting: 'まだログはありません',
      openPage: '詳細表示',
      unavailableDuringGame: '対局中はこの操作を行えません',
      refresh: '更新',
      minimize: '閉じる',
      empty: '表示できる対局ログがありません',
    };

    return (key: string) => labels[key] ?? key;
  },
}));

describe('GameHistoryDock', () => {
  const baseProps = {
    roomId: 'room-123',
    players: [],
  };

  it('allows full-history page navigation while a game is in progress', () => {
    render(<GameHistoryDock {...baseProps} gameStarted />);

    fireEvent.click(screen.getByRole('button', { name: '対局ログ' }));

    expect(screen.getByRole('link', { name: '詳細表示' })).toHaveAttribute(
      'href',
      '/game-history/room-123',
    );
  });

  it('allows full-history page navigation while waiting', () => {
    render(<GameHistoryDock {...baseProps} gameStarted={false} />);

    fireEvent.click(screen.getByRole('button', { name: '対局ログ' }));

    expect(screen.getByRole('link', { name: '詳細表示' })).toHaveAttribute(
      'href',
      '/game-history/room-123',
    );
  });
});
