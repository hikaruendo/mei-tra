import { act, render, screen } from '@testing-library/react';
import type React from 'react';
import { GameTable } from '@/components/game/GameTable';
import type { GameActions, Player, TeamScores } from '@/types/game.types';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) =>
    values ? `${key}:${Object.values(values).join(',')}` : key,
}));

jest.mock('@/hooks/usePreloadCards', () => ({
  usePreloadCards: jest.fn(),
}));

jest.mock('@/components/game/GameInfo', () => ({
  GameInfo: () => <div>game info</div>,
}));

jest.mock('@/components/game/GameDock', () => ({
  GameDock: () => <div>game dock</div>,
}));

jest.mock('@/components/game/PlayerHand', () => ({
  PlayerHand: ({
    player,
    isCurrentTurn,
  }: {
    player: Player;
    isCurrentTurn: boolean;
  }) => (
    <div data-testid={`seat-${player.seatId}`} data-current-turn={isCurrentTurn}>
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
} as unknown as GameActions;

function renderTable(overrides: Partial<React.ComponentProps<typeof GameTable>>) {
  return render(
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
    />,
  );
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

  it('plays the janken overlay and lands on the first turn seat', () => {
    const onDone = jest.fn();
    renderTable({
      firstTurnReveal: { roomId: 'room-1', seatId: 'seat-2', token: 1 },
      onFirstTurnRevealDone: onDone,
    });

    // Chant beat: overlay is up before any hand is thrown.
    expect(screen.getByText('chant')).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(900);
    });
    expect(screen.getByText('ready')).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(700);
    });
    expect(screen.getByText('draw')).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(900);
    });
    expect(screen.getByText('shu')).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(800);
    });
    expect(
      screen.getByText('result:Player 2'),
    ).toBeInTheDocument();
    // The losing seat lights up using the existing turn ring.
    expect(screen.getByTestId('seat-seat-2')).toHaveAttribute(
      'data-current-turn',
      'true',
    );
    expect(screen.getByTestId('seat-seat-0')).toHaveAttribute(
      'data-current-turn',
      'false',
    );

    act(() => {
      jest.advanceTimersByTime(900);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
