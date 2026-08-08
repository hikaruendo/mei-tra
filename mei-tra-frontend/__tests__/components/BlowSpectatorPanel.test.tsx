import { render, screen } from '@testing-library/react';
import { BlowSpectatorPanel } from '@/components/game/BlowSpectatorPanel';
import type { BlowAction, BlowDeclaration, Player } from '@/types/game.types';

jest.mock('next-intl', () => ({
  useTranslations: () => {
    const labels: Record<string, string> = {
      currentTurn: 'Current Turn:',
      spectatorProgress: 'Bid Progress',
      viewOnly: 'View only',
      highestBid: 'Highest Bid',
      noBid: 'No bid yet',
      history: 'History',
      noHistory: 'No history yet',
      bid: 'Bid',
      daiya: 'Diamond',
      pass: 'Pass',
      waiting: 'Waiting',
    };

    return (key: string) => labels[key] ?? key;
  },
}));

const players: Player[] = [
  {
    socketId: 'player-1',
    playerId: 'player-1',
    name: 'Player 1',
    team: 0,
    hand: [],
  },
  {
    socketId: 'player-2',
    playerId: 'player-2',
    name: 'Player 2',
    team: 1,
    hand: [],
  },
];

const declarations: BlowDeclaration[] = [
  {
    playerId: 'player-1',
    trumpType: 'daiya',
    numberOfPairs: 7,
    timestamp: 1,
  },
];

const actions: BlowAction[] = [
  {
    type: 'declare',
    playerId: 'player-1',
    trumpType: 'daiya',
    numberOfPairs: 7,
    timestamp: 1,
  },
  {
    type: 'pass',
    playerId: 'player-2',
    timestamp: 2,
  },
];

const renderPanel = (overrides: Partial<React.ComponentProps<typeof BlowSpectatorPanel>> = {}) =>
  render(
    <BlowSpectatorPanel
      whoseTurn="player-2"
      blowDeclarations={declarations}
      blowActionHistory={actions}
      currentHighestDeclaration={declarations[0]}
      players={players}
      {...overrides}
    />,
  );

describe('BlowSpectatorPanel', () => {
  it('shows the current turn, highest bid, and chronological action history', () => {
    renderPanel();

    expect(screen.getByLabelText('Bid Progress')).toBeInTheDocument();
    expect(screen.getByText('Current Turn:').parentElement).toHaveTextContent('Player 2');
    expect(screen.getAllByText('Player 1')).toHaveLength(2);
    expect(screen.getAllByText('Diamond')).toHaveLength(2);
    expect(screen.getByText('Pass')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('puts player names in truncatable spans', () => {
    renderPanel();

    const historyName = screen.getAllByText('Player 1').find((element) =>
      element.className.includes('playerName'),
    );

    expect(historyName).toBeDefined();
    expect(historyName).toHaveAttribute('title', 'Player 1');
  });

  it('updates from a later socket snapshot without exposing controls', () => {
    const { rerender } = renderPanel({
      blowActionHistory: [],
      currentHighestDeclaration: null,
      whoseTurn: 'player-1',
    });

    expect(screen.getByText('No bid yet')).toBeInTheDocument();

    rerender(
      <BlowSpectatorPanel
        whoseTurn="player-2"
        blowDeclarations={declarations}
        blowActionHistory={actions}
        currentHighestDeclaration={declarations[0]}
        players={players}
      />,
    );

    expect(screen.getByText('Pass')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('shows a waiting state before the current blow player is available', () => {
    renderPanel({ whoseTurn: null });

    expect(screen.getByText('Current Turn:').parentElement).toHaveTextContent('Waiting');
  });
});
