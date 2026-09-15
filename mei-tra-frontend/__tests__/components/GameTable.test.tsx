import { render, screen } from '@testing-library/react';
import type React from 'react';
import { asSeatId } from '@contracts/ids';
import { GameTable } from '@/components/game/GameTable';
import type { GameActions, Player, TeamScores } from '@/types/game.types';

type MockPlayerHandProps = { player: Player; hasActedInBlow?: boolean };
const mockPlayerHand = jest.fn<void, [MockPlayerHandProps]>();

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
  PlayerHand: (props: MockPlayerHandProps) => {
    mockPlayerHand(props);
    return <div>player hand</div>;
  },
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

const renderGameTable = (
  overrides: Partial<React.ComponentProps<typeof GameTable>> = {},
) =>
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
      currentSeatId="player-1"
      currentRoomId="room-1"
      pointsToWin={5}
      {...overrides}
    />,
  );

describe('GameTable spectator blow controls', () => {
  it('renders only the read-only blow panel for spectators', () => {
    renderGameTable({ isSpectator: true });

    expect(screen.getByText('spectator bid progress')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Declare' })).not.toBeInTheDocument();
  });

  it('keeps declaration controls available to players', () => {
    renderGameTable();

    expect(screen.queryByText('spectator bid progress')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Declare' })).toBeInTheDocument();
  });
});

describe('GameTable broken hand action', () => {
  it('tells each hand whether its player has already bid or passed', () => {
    mockPlayerHand.mockClear();

    renderGameTable({
      players: [
        ...players,
        {
          socketId: 'player-3',
          seatId: 'player-3',
          name: 'Player 3',
          team: 0,
          hand: [],
          isPasser: true,
        },
        {
          socketId: 'player-4',
          seatId: 'player-4',
          name: 'Player 4',
          team: 1,
          hand: [],
        },
      ],
      blowDeclarations: [
        {
          seatId: asSeatId('player-2'),
          trumpType: 'herz',
          numberOfPairs: 6,
          timestamp: 1,
        },
      ],
      blowActionHistory: [
        { type: 'pass', seatId: asSeatId('player-4'), timestamp: 2 },
      ],
    });

    const hasActedBySeat = Object.fromEntries(
      mockPlayerHand.mock.calls.map(([props]) => [
        props.player.seatId,
        props.hasActedInBlow,
      ]),
    );
    expect(hasActedBySeat).toEqual({
      'player-1': false,
      'player-2': true,
      'player-3': true,
      'player-4': true,
    });
  });
});
