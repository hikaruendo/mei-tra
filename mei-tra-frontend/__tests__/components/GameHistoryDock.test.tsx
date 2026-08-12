import type React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { GameHistoryDock } from '@/components/game/GameHistoryDock';

const mockUseGameHistory = jest.fn();

jest.mock('@/hooks/useGameHistory', () => ({
  useGameHistory: () => mockUseGameHistory(),
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
      roundTableRound: 'ラウンド',
      roundTableBlower: '吹き手',
      roundTableBid: '宣言',
      roundTableScore: '得点',
      'actionTypes.card_played': 'カードプレイ',
      teamRed: 'チーム赤',
      teamBlack: 'チーム黒',
      roundInProgress: '進行中',
      participant: 'プレイヤー',
      unknownValue: '不明',
      club: 'クラブ',
      startingHand: 'このラウンドの自分の手札',
      redealtHand: '繰り直し後の自分の手札',
      noStartingHand: '手札ログなし',
    };

    return (
      key: string,
      values?: Record<string, number | string>,
    ) => {
      if (key === 'setCount') {
        return `${values?.count ?? 0}組`;
      }

      if (key === 'summaries.card_played') {
        return `${values?.player} played ${values?.card}`;
      }

      return labels[key] ?? key;
    };
  },
}));

describe('GameHistoryDock', () => {
  const baseProps = {
    roomId: 'room-123',
    players: [],
  };

  beforeEach(() => {
    mockUseGameHistory.mockReturnValue({
      replay: null,
      summary: null,
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    });
  });

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

  it('shows round headers, the blower name, and red and black team scores', () => {
    mockUseGameHistory.mockReturnValue({
      replay: {
        roomId: 'room-123',
        totalEntries: 3,
        rounds: [
          {
            roundNumber: 1,
            startedAt: new Date('2026-07-26T00:00:00.000Z'),
            endedAt: new Date('2026-07-26T00:03:00.000Z'),
            actionTypes: ['blow_declared', 'play_phase_started', 'round_completed'],
            playerIds: ['player-1'],
            entries: [],
            events: [
              {
                id: 'declaration-1',
                timestamp: new Date('2026-07-26T00:00:00.000Z'),
                actionType: 'blow_declared',
                playerId: 'player-1',
                roundNumber: 1,
                gamePhase: 'blow',
                kind: 'blow',
                summary: '',
                details: {},
                actionData: {
                  playerNames: {
                    'player-1': 'Stored Player',
                  },
                },
                detailItems: [
                  {
                    labelKey: 'highestDeclaration',
                    value: { kind: 'text', text: '6 pair(s) / club' },
                  },
                ],
              },
              {
                id: 'play-1',
                timestamp: new Date('2026-07-26T00:01:00.000Z'),
                actionType: 'play_phase_started',
                playerId: 'player-1',
                roundNumber: 1,
                gamePhase: 'play',
                kind: 'blow',
                summary: '',
                details: {},
                actionData: {},
                detailItems: [
                  {
                    labelKey: 'winner',
                    value: {
                      kind: 'player',
                      playerId: 'com-replacement',
                      playerName: 'COM 4',
                    },
                  },
                ],
              },
              {
                id: 'score-1',
                timestamp: new Date('2026-07-26T00:03:00.000Z'),
                actionType: 'round_completed',
                playerId: null,
                roundNumber: 1,
                gamePhase: 'score',
                kind: 'round',
                summary: '',
                details: {},
                actionData: {},
                detailItems: [
                  {
                    labelKey: 'scores',
                    value: {
                      kind: 'scores',
                      scores: {
                        0: { total: 4 },
                        1: { total: 2 },
                      },
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
      summary: {
        roomId: 'room-123',
        totalEntries: 3,
        byActionType: {},
        playerIds: ['player-1'],
        playerNames: { 'player-1': 'Summary Player' },
        roundNumbers: [1],
        status: 'in_progress',
        winningTeam: null,
        lastActionType: 'round_completed',
        firstTimestamp: new Date('2026-07-26T00:00:00.000Z'),
        lastTimestamp: new Date('2026-07-26T00:03:00.000Z'),
      },
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    });

    render(
      <GameHistoryDock
        {...baseProps}
        gameStarted
        defaultOpen
        players={[{ playerId: 'player-1', name: 'Current Player', team: 0, hand: [], socketId: 'socket-1' }]}
      />,
    );

    expect(screen.getByRole('columnheader', { name: '吹き手' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'ラウンド' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '宣言' })).toBeInTheDocument();
    const roundTable = screen.getByRole('table');
    expect(within(roundTable).getByText('Current Player')).toBeInTheDocument();
    expect(within(roundTable).queryByText('Stored Player')).not.toBeInTheDocument();
    expect(within(roundTable).queryByText('COM 4')).not.toBeInTheDocument();
    expect(within(roundTable).getByText('6組 / クラブ')).toBeInTheDocument();
    expect(within(roundTable).queryByText(/pairs/i)).not.toBeInTheDocument();
    expect(within(roundTable).queryByText('計4')).not.toBeInTheDocument();
    expect(within(roundTable).queryByText('計2')).not.toBeInTheDocument();
    expect(within(roundTable).getByText('チーム赤')).toBeInTheDocument();
    expect(within(roundTable).getByText('チーム黒')).toBeInTheDocument();
  });

  it('keeps replay score labels attached to backend team indexes', () => {
    mockUseGameHistory.mockReturnValue({
      replay: {
        roomId: 'room-123',
        totalEntries: 1,
        rounds: [
          {
            roundNumber: 1,
            startedAt: new Date('2026-07-26T00:00:00.000Z'),
            endedAt: new Date('2026-07-26T00:03:00.000Z'),
            actionTypes: ['round_completed'],
            playerIds: [],
            entries: [],
            events: [
              {
                id: 'score-1',
                timestamp: new Date('2026-07-26T00:03:00.000Z'),
                actionType: 'round_completed',
                playerId: null,
                roundNumber: 1,
                gamePhase: 'score',
                kind: 'round',
                summary: '',
                details: {},
                actionData: {},
                detailItems: [
                  {
                    labelKey: 'scores',
                    value: {
                      kind: 'scores',
                      scores: {
                        0: { total: 1 },
                        1: { total: 4 },
                      },
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
      summary: null,
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    });

    render(<GameHistoryDock {...baseProps} gameStarted defaultOpen />);

    const redScore = screen.getByText('チーム赤').closest('div');
    const blackScore = screen.getByText('チーム黒').closest('div');

    expect(redScore).not.toBeNull();
    expect(blackScore).not.toBeNull();
    expect(within(redScore as HTMLElement).getByText('+1')).toBeInTheDocument();
    expect(within(blackScore as HTMLElement).getByText('+4')).toBeInTheDocument();
  });

  it('shows detailed replay events on the profile history page', () => {
    mockUseGameHistory.mockReturnValue({
      replay: {
        roomId: 'room-123',
        totalEntries: 3,
        rounds: [
          {
            roundNumber: 1,
            startedAt: new Date('2026-07-26T00:00:00.000Z'),
            endedAt: new Date('2026-07-26T00:03:00.000Z'),
            actionTypes: ['play_phase_started', 'card_played', 'round_completed'],
            playerIds: ['player-1'],
            entries: [],
            viewerStartingHand: ['A♠', '9♥'],
            events: [
              {
                id: 'play-started-1',
                timestamp: new Date('2026-07-26T00:01:00.000Z'),
                actionType: 'play_phase_started',
                playerId: 'player-1',
                roundNumber: 1,
                gamePhase: 'play',
                kind: 'blow',
                summary: '',
                details: {},
                actionData: {
                  viewerStartingHand: ['A♠', '9♥'],
                },
                detailItems: [],
              },
              {
                id: 'card-played-1',
                timestamp: new Date('2026-07-26T00:02:00.000Z'),
                actionType: 'card_played',
                playerId: 'player-1',
                roundNumber: 1,
                gamePhase: 'play',
                kind: 'card',
                summary: '',
                details: {},
                actionData: {},
                detailItems: [],
              },
              {
                id: 'score-1',
                timestamp: new Date('2026-07-26T00:03:00.000Z'),
                actionType: 'round_completed',
                playerId: null,
                roundNumber: 1,
                gamePhase: 'score',
                kind: 'round',
                summary: '',
                details: {},
                actionData: {},
                detailItems: [],
              },
            ],
          },
        ],
      },
      summary: {
        roomId: 'room-123',
        totalEntries: 3,
        byActionType: { card_played: 1 },
        playerIds: ['player-1'],
        playerNames: { 'player-1': 'Hikaru' },
        roundNumbers: [1],
        status: 'completed',
        winningTeam: 0,
        lastActionType: 'round_completed',
        firstTimestamp: new Date('2026-07-26T00:00:00.000Z'),
        lastTimestamp: new Date('2026-07-26T00:03:00.000Z'),
      },
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    });

    render(
      <GameHistoryDock
        {...baseProps}
        gameStarted={false}
        variant="page"
        showOverview={false}
      />,
    );

    expect(screen.getByText('カードプレイ')).toBeInTheDocument();
    expect(screen.getByText('Hikaru played 不明')).toBeInTheDocument();
    expect(screen.queryByText('プレイヤー1')).not.toBeInTheDocument();
    expect(
      screen.getByText('このラウンドの自分の手札'),
    ).toBeInTheDocument();
    expect(screen.getByAltText('A♠')).toBeInTheDocument();
    expect(screen.getByAltText('9♥')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows a redealt hand after a broken hand event', () => {
    mockUseGameHistory.mockReturnValue({
      replay: {
        roomId: 'room-123',
        totalEntries: 2,
        rounds: [
          {
            roundNumber: 1,
            startedAt: new Date('2026-07-26T00:00:00.000Z'),
            endedAt: null,
            actionTypes: ['game_started', 'broken_hand_revealed'],
            playerIds: ['player-1'],
            entries: [],
            viewerStartingHand: ['Q♦'],
            events: [
              {
                id: 'game-started-1',
                timestamp: new Date('2026-07-26T00:00:00.000Z'),
                actionType: 'game_started',
                playerId: 'player-1',
                roundNumber: 1,
                gamePhase: 'blow',
                kind: 'game',
                summary: '',
                details: {},
                actionData: {
                  viewerStartingHand: ['A♠'],
                },
                detailItems: [],
              },
              {
                id: 'broken-1',
                timestamp: new Date('2026-07-26T00:01:00.000Z'),
                actionType: 'broken_hand_revealed',
                playerId: 'player-1',
                roundNumber: 1,
                gamePhase: 'blow',
                kind: 'blow',
                summary: '',
                details: {},
                actionData: {
                  viewerStartingHand: ['Q♦'],
                },
                detailItems: [],
              },
            ],
          },
        ],
      },
      summary: null,
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    });

    render(<GameHistoryDock {...baseProps} gameStarted={false} variant="page" />);

    expect(screen.getByAltText('A♠')).toBeInTheDocument();
    expect(screen.getByText('繰り直し後の自分の手札')).toBeInTheDocument();
    expect(screen.getByAltText('Q♦')).toBeInTheDocument();
  });
});
