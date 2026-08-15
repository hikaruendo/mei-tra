import { render, screen } from '@testing-library/react';
import type React from 'react';
import { GameTable } from '@/components/game/GameTable';
import type { GameActions, Player, TeamScores } from '@/types/game.types';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/hooks/usePreloadCards', () => ({
  usePreloadCards: jest.fn(),
}));

jest.mock('@/lib/utils/tableOrder', () => ({
  getSeatOrderWithSelfBottom: (players: Player[]) => players,
}));

jest.mock('@/components/game/GameInfo', () => ({
  GameInfo: () => <div>game info</div>,
}));

jest.mock('@/components/game/GameDock', () => ({
  GameDock: () => <div>game dock</div>,
}));

jest.mock('@/components/game/PlayerHand', () => ({
  PlayerHand: () => <div>player hand</div>,
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
  BlowSpectatorPanel: () => <div>spectator bid progress</div>,
}));

const players: Player[] = [
  {
    socketId: 'player-1',
    seatId: 'player-1',
    name: 'Player 1',
    team: 0,
    hand: [],
  },
  {
    socketId: 'player-2',
    seatId: 'player-2',
    name: 'Player 2',
    team: 1,
    hand: [],
  },
];

const teamScores: TeamScores = {
  0: { deal: 0, blow: 0, play: 0, total: 0 },
  1: { deal: 0, blow: 0, play: 0, total: 0 },
};

const gameActions: GameActions = {
  selectNegri: jest.fn(),
  playCard: jest.fn(),
  declareBlow: jest.fn(),
  passBlow: jest.fn(),
  selectBaseSuit: jest.fn(),
  revealBrokenHand: jest.fn(),
};

const renderGameTable = (isSpectator: boolean) =>
  render(
    <GameTable
      whoseTurn="player-1"
      gamePhase="blow"
      currentTrump={null}
      currentField={null}
      players={players}
      negriCard={null}
      completedFields={[]}
      revealedAgari={null}
      gameActions={gameActions}
      blowDeclarations={[]}
      blowActionHistory={[]}
      currentHighestDeclaration={null}
      selectedTrump={null}
      setSelectedTrump={jest.fn()}
      numberOfPairs={0}
      setNumberOfPairs={jest.fn()}
      teamScores={teamScores}
      currentPlayerId="player-1"
      currentRoomId="room-1"
      pointsToWin={5}
      isSpectator={isSpectator}
    />,
  );

describe('GameTable spectator blow controls', () => {
  it('renders only the read-only blow panel for spectators', () => {
    renderGameTable(true);

    expect(screen.getByText('spectator bid progress')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Declare' })).not.toBeInTheDocument();
  });

  it('keeps declaration controls available to players', () => {
    renderGameTable(false);

    expect(screen.queryByText('spectator bid progress')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Declare' })).toBeInTheDocument();
  });
});
