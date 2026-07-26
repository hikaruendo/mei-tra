import { render, screen } from '@testing-library/react';
import { BlowControls } from '@/components/game/BlowControls';
import type { BlowAction, BlowDeclaration, Player } from '@/types/game.types';

jest.mock('next-intl', () => ({
  useTranslations: () => {
    const labels: Record<string, string> = {
      currentTurn: 'Current turn:',
      selectTrump: 'Select Trump',
      selectPairs: 'Select Sets',
      declare: 'Declare',
      pass: 'Pass',
      passed: 'Passed',
      pairs: ' sets',
      slami: 'Slami',
      overCall: ' sets',
      tra: 'No Tra',
      herz: 'Hell',
      daiya: 'Daiya',
      club: 'Club',
      zuppe: 'Zuppe',
    };

    return (key: string) => labels[key] ?? key;
  },
}));

const player: Player = {
  socketId: 'socket-1',
  playerId: 'player-1',
  name: 'Player 1',
  team: 0,
  hand: [],
};

const declaration: BlowDeclaration = {
  playerId: 'player-1',
  trumpType: 'daiya',
  numberOfPairs: 6,
  timestamp: 1,
};

const action: BlowAction = {
  type: 'declare',
  playerId: 'player-1',
  trumpType: 'daiya',
  numberOfPairs: 6,
  timestamp: 1,
};

const renderBlowControls = () =>
  render(
    <BlowControls
      isCurrentPlayer
      whoseTurn="player-1"
      selectedTrump="daiya"
      setSelectedTrump={jest.fn()}
      numberOfPairs={6}
      setNumberOfPairs={jest.fn()}
      declareBlow={jest.fn()}
      passBlow={jest.fn()}
      blowDeclarations={[declaration]}
      blowActionHistory={[action]}
      currentHighestDeclaration={declaration}
      players={[player]}
    />,
  );

describe('BlowControls', () => {
  it('marks selected and history trump labels for suit coloring', () => {
    renderBlowControls();

    expect(screen.getAllByRole('combobox')[0]).toHaveAttribute('data-trump', 'daiya');
    expect(screen.getByRole('option', { name: 'Daiya' })).toHaveAttribute('data-trump', 'daiya');
    const historyTrumpLabel = screen
      .getAllByText('Daiya')
      .find((element) => element.classList.contains('trumpLabel'));

    expect(historyTrumpLabel).toBeDefined();
    expect(historyTrumpLabel as HTMLElement).toBeInTheDocument();
    expect(historyTrumpLabel as HTMLElement).toHaveAttribute('data-trump', 'daiya');
  });
});
