import { act, fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { GameTable } from '@/components/game/GameTable';
import { JANKEN_STEP_DURATION_MS as D } from '@meitra/game-client/first-turn-reveal';
import { OPEN_MAX_HAND_SIZE } from '@contracts/game';
import type { GameActions, Player, TeamScores } from '@/types/game.types';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) =>
    values ? `${key}:${Object.values(values).join(',')}` : key,
}));

jest.mock('@/hooks/usePreloadCards', () => ({
  usePreloadCards: jest.fn(),
}));

jest.mock('@/components/game/GameInfo', () => ({
  GameInfo: ({
    actionSlot,
  }: {
    actionSlot?: (onLeaveRequest: () => void) => React.ReactNode;
  }) => <div>{actionSlot?.(() => {})}</div>,
}));

// Stands in for the dock's buttons: the open entry and the chombo panel.
jest.mock('@/components/game/GameDock', () => ({
  GameDock: ({
    onOpenRequest,
    chomboReport,
  }: {
    onOpenRequest?: () => void;
    chomboReport?: React.ReactNode;
  }) => (
    <div>
      {onOpenRequest ? (
        <button type="button" onClick={onOpenRequest}>
          game.openAction
        </button>
      ) : null}
      {chomboReport}
    </div>
  ),
}));

jest.mock('@/components/game/PlayerHand', () => ({
  PlayerHand: ({
    player,
    isCurrentTurn,
    pendingHandCard,
  }: {
    player: Player;
    isCurrentTurn: boolean;
    pendingHandCard?: string | null;
  }) => (
    <div
      data-testid={`seat-${player.seatId}`}
      data-current-turn={isCurrentTurn}
      data-pending-hand-card={pendingHandCard ?? ''}
    >
      {player.name}
    </div>
  ),
}));

jest.mock('@/components/game/GameField', () => ({
  GameField: () => <div>game field</div>,
}));

jest.mock('@/components/game/GameControls', () => ({
  GameControls: ({ renderBlowControls }: { renderBlowControls: () => React.ReactNode }) => (
    <div>{renderBlowControls()}</div>
  ),
}));

jest.mock('@/components/game/BlowControls', () => ({
  BlowControls: () => <button type="button">Declare</button>,
}));

jest.mock('@/components/game/BlowSpectatorPanel', () => ({
  BlowSpectatorPanel: () => <div>spectator</div>,
}));

const players: Player[] = [0, 1, 2, 3].map((idx) => ({
  socketId: `socket-${idx}`,
  seatId: `seat-${idx}`,
  name: `Player ${idx}`,
  team: (idx % 2) as Player['team'],
  hand: [],
}));

const withViewerHand = (cardCount: number) =>
  players.map((player) =>
    player.seatId === 'seat-0'
      ? { ...player, hand: Array.from({ length: cardCount }, (_, index) => String(index + 5) + '♠') }
      : player,
  );

const teamScores: TeamScores = {
  0: { deal: 0, blow: 0, play: 0, total: 0 },
  1: { deal: 0, blow: 0, play: 0, total: 0 },
};

const gameActions = {
  selectNegri: jest.fn(),
  playCard: jest.fn(),
  selectBaseSuit: jest.fn(),
  declareBlow: jest.fn(),
  passBlow: jest.fn(),
  revealBrokenHand: jest.fn(),
  reportChombo: jest.fn(),
  declareOpen: jest.fn(),
} as unknown as GameActions;

function tableElement(overrides: Partial<React.ComponentProps<typeof GameTable>>) {
  return (
    <GameTable
      blowActionHistory={[]}
      blowDeclarations={[]}
      completedFields={[]}
      currentField={null}
      currentHighestDeclaration={null}
      currentRoomId="room-1"
      currentSeatId="seat-0"
      currentTrump={null}
      gameActions={gameActions}
      gamePhase="blow"
      gameMode="normal"
      negriCard={null}
      numberOfPairs={0}
      players={players}
      pointsToWin={17}
      revealedAgari={null}
      selectedTrump={null}
      setNumberOfPairs={jest.fn()}
      setSelectedTrump={jest.fn()}
      teamScores={teamScores}
      whoseTurn={null}
      {...overrides}
    />
  );
}

function renderTable(overrides: Partial<React.ComponentProps<typeof GameTable>>) {
  return render(tableElement(overrides));
}

describe('GameTable first-turn reveal', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders no overlay without a reveal', () => {
    renderTable({});
    expect(screen.queryByText('chant')).not.toBeInTheDocument();
  });

  it('plays the janken overlay and crowns the last blower', () => {
    const onDone = jest.fn();
    renderTable({
      firstTurnReveal: {
        roomId: 'room-1',
        seatId: 'seat-2',
        lastBlowSeatId: 'seat-1',
        token: Date.now(),
      },
      onFirstTurnRevealDone: onDone,
    });

    // Chant beat: overlay is up before any hand is thrown.
    expect(screen.getByText('chant')).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(D.chant);
    });
    expect(screen.getByText('ready')).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(D.ready);
    });
    expect(screen.getByText('shu')).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(D.showdown);
    });
    // The winner is announced as 吹き上げ.
    expect(screen.getByText('result:Player 1')).toBeInTheDocument();
    // The first blower's seat carries the turn ring into real play.
    expect(screen.getByTestId('seat-seat-2')).toHaveAttribute(
      'data-current-turn',
      'true',
    );
    expect(screen.getByTestId('seat-seat-0')).toHaveAttribute(
      'data-current-turn',
      'false',
    );

    act(() => {
      jest.advanceTimersByTime(D.result);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe('GameTable pro open control', () => {
  it('shows the open action to a player from either team', () => {
    renderTable({
      gameMode: 'pro',
      gamePhase: 'play',
      currentHighestDeclaration: {
        seatId: 'seat-0',
        team: 0,
        trumpType: 'tra',
        numberOfPairs: 1,
        timestamp: 1,
      },
      players: withViewerHand(1),
    });
    expect(screen.getByRole('button', { name: 'game.openAction' })).toBeInTheDocument();

    renderTable({
      gameMode: 'pro',
      gamePhase: 'play',
      currentHighestDeclaration: {
        seatId: 'seat-1',
        team: 1,
        trumpType: 'tra',
        numberOfPairs: 1,
        timestamp: 1,
      },
      players: withViewerHand(1),
    });
    expect(screen.getAllByRole('button', { name: 'game.openAction' })).toHaveLength(2);
  });

  it('takes the open action away once the viewer has played their last card', () => {
    // The last field of a round is completed on a delay, so an empty hand is a
    // real state here. Nothing is left to open on, and the server rejects it.
    renderTable({
      gameMode: 'pro',
      gamePhase: 'play',
      currentHighestDeclaration: {
        seatId: 'seat-0',
        team: 0,
        trumpType: 'tra',
        numberOfPairs: 1,
        timestamp: 1,
      },
      players: withViewerHand(0),
    });
    expect(screen.queryByRole('button', { name: 'game.openAction' })).not.toBeInTheDocument();
  });

  it('does not show the open action in normal mode', () => {
    renderTable({
      gameMode: 'normal',
      gamePhase: 'play',
      currentHighestDeclaration: {
        seatId: 'seat-0',
        team: 0,
        trumpType: 'tra',
        numberOfPairs: 1,
        timestamp: 1,
      },
    });
    expect(screen.queryByRole('button', { name: 'game.openAction' })).not.toBeInTheDocument();
  });

  it('hides the open action after the server marks the open as declared or resolved', () => {
    renderTable({ gameMode: 'pro', gamePhase: 'play', openDeclared: true });
    expect(screen.queryByRole('button', { name: 'game.openAction' })).not.toBeInTheDocument();
  });

  const openTurn: Partial<React.ComponentProps<typeof GameTable>> = {
    gameMode: 'pro',
    gamePhase: 'play',
    currentHighestDeclaration: {
      seatId: 'seat-0',
      team: 0,
      trumpType: 'tra',
      numberOfPairs: 1,
      timestamp: 1,
    },
    players: withViewerHand(OPEN_MAX_HAND_SIZE),
  };

  it('asks before opening, and opens only once confirmed', () => {
    const declareOpen = jest.mocked(gameActions.declareOpen);
    declareOpen.mockClear();
    renderTable(openTurn);

    fireEvent.click(screen.getByRole('button', { name: 'game.openAction' }));
    expect(screen.getByText('game.openConfirmMessage')).toBeInTheDocument();
    expect(declareOpen).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'cancel' }));
    expect(screen.queryByText('game.openConfirmMessage')).not.toBeInTheDocument();
    expect(declareOpen).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'game.openAction' }));
    fireEvent.click(screen.getByRole('button', { name: 'game.openConfirm' }));
    expect(declareOpen).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('game.openConfirmMessage')).not.toBeInTheDocument();
  });

  it('closes the confirmation when the open is no longer available', () => {
    const { rerender } = renderTable(openTurn);

    fireEvent.click(screen.getByRole('button', { name: 'game.openAction' }));
    expect(screen.getByText('game.openConfirmMessage')).toBeInTheDocument();

    // Another seat opened first.
    rerender(tableElement({ ...openTurn, openDeclared: true }));
    expect(screen.queryByText('game.openConfirmMessage')).not.toBeInTheDocument();

    rerender(tableElement(openTurn));
    expect(screen.queryByText('game.openConfirmMessage')).not.toBeInTheDocument();
  });

  it('offers the open action only once the viewer is down to the open hand size', () => {
    const proPlay: Partial<React.ComponentProps<typeof GameTable>> = {
      gameMode: 'pro',
      gamePhase: 'play',
      currentHighestDeclaration: {
        seatId: 'seat-0',
        team: 0,
        trumpType: 'tra',
        numberOfPairs: 1,
        timestamp: 1,
      },
    };

    const { unmount } = renderTable({ ...proPlay, players: withViewerHand(OPEN_MAX_HAND_SIZE + 1) });
    expect(screen.queryByRole('button', { name: 'game.openAction' })).not.toBeInTheDocument();
    unmount();

    renderTable({ ...proPlay, players: withViewerHand(OPEN_MAX_HAND_SIZE) });
    expect(screen.getByRole('button', { name: 'game.openAction' })).toBeInTheDocument();
  });
});

describe('GameTable pro chombo report', () => {
  const comOpponents = players.map((player) =>
    player.team === 1 ? { ...player, isCOM: true } : player,
  );

  it('gives the dock a report panel during pro play, even with only COM to report', () => {
    renderTable({ gameMode: 'pro', gamePhase: 'play', players: comOpponents });
    expect(screen.getByText('noTargets')).toBeInTheDocument();
  });

  it('gives no report panel outside pro play or to a spectator', () => {
    const { unmount } = renderTable({ gameMode: 'pro', gamePhase: 'blow' });
    expect(screen.queryByLabelText('title')).not.toBeInTheDocument();
    unmount();

    renderTable({ gameMode: 'pro', gamePhase: 'play', isSpectator: true });
    expect(screen.queryByLabelText('title')).not.toBeInTheDocument();
  });
});

describe('GameTable pending hand card', () => {
  it('hides the sent card only from the viewer’s own hand', () => {
    renderTable({ gameMode: 'pro', gamePhase: 'play', pendingHandCard: '5♠' });
    expect(screen.getByTestId('seat-seat-0')).toHaveAttribute('data-pending-hand-card', '5♠');
    expect(screen.getByTestId('seat-seat-1')).toHaveAttribute('data-pending-hand-card', '');
  });
});
