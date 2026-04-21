import { render, screen } from '@testing-library/react';
import type React from 'react';
import { PlayerHand } from '@/components/game/PlayerHand';
import type { GameActions, Player } from '@/types/game.types';

jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => {
    const labels: Record<string, Record<string, string>> = {
      playerHand: {
        agari: 'Agari',
        cards: 'cards',
        negri: 'Negri',
        selectNegri: 'Please select your Negri',
        selectNegriWithAgari: 'This card is Agari. Select your Negri.',
      },
      playerStatus: {
        disconnected: 'Disconnected',
        idle: 'Unresponsive',
        replaceWithCom: 'Replace with COM',
      },
    };

    return (key: string) => labels[namespace]?.[key] ?? key;
  },
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    fontSizePreference: 'standard',
  }),
}));

jest.mock('@/components/game/PlayerAvatar', () => ({
  PlayerAvatar: ({ player }: { player: Player }) => <div>{player.name}</div>,
}));

jest.mock('@/components/game/CardFace', () => ({
  CardFace: () => <div data-testid="card-face" />,
}));

jest.mock('@/components/game/Card', () => ({
  Card: ({ card }: { card: string }) => <div>{card}</div>,
}));

jest.mock('@/components/game/NegriCard', () => ({
  NegriCard: () => <div>negri card</div>,
}));

jest.mock('@/components/game/CompletedFields', () => ({
  CompletedFields: () => <div>completed fields</div>,
}));

jest.mock('@/components/game/PlayAndCancelBtn', () => ({
  PlayAndCancelBtn: ({ buttonText }: { buttonText: string }) => (
    <button>{buttonText}</button>
  ),
}));

const gameActions: GameActions = {
  selectNegri: jest.fn(),
  playCard: jest.fn(),
  declareBlow: jest.fn(),
  passBlow: jest.fn(),
  selectBaseSuit: jest.fn(),
  revealBrokenHand: jest.fn(),
};

const otherPlayer: Player = {
  socketId: '',
  playerId: 'player-2',
  name: 'Player 2',
  team: 0,
  hand: ['H-A'],
  isCOM: false,
};

const renderPlayerHand = (
  overrides: Partial<React.ComponentProps<typeof PlayerHand>> = {},
) =>
  render(
    <PlayerHand
      player={otherPlayer}
      isCurrentTurn={false}
      negriCard={null}
      negriPlayerId={null}
      gamePhase="play"
      whoseTurn="player-1"
      gameActions={gameActions}
      position="left"
      completedFields={[]}
      currentPlayerId="player-1"
      players={[otherPlayer]}
      currentField={null}
      currentTrump={null}
      isHost
      onReplaceWithCOM={jest.fn()}
      {...overrides}
    />,
  );

describe('PlayerHand', () => {
  it('does not show replace-with-COM only because socketId is empty', () => {
    renderPlayerHand();

    expect(
      screen.queryByRole('button', { name: 'Replace with COM' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Disconnected')).not.toBeInTheDocument();
  });

  it('shows replace-with-COM for an explicitly disconnected player', () => {
    renderPlayerHand({ isDisconnected: true });

    expect(
      screen.getByRole('button', { name: 'Replace with COM' }),
    ).toBeInTheDocument();
  });

  it('shows replace-with-COM for an idle player', () => {
    renderPlayerHand({ isIdle: true });

    expect(screen.getByText('Unresponsive')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Replace with COM' }),
    ).toBeInTheDocument();
  });

  it('shows the Agari card while selecting Negri', () => {
    renderPlayerHand({
      agariCard: 'H-A',
      currentHighestDeclaration: { playerId: 'player-2' },
      currentPlayerId: 'player-2',
      whoseTurn: 'player-2',
      player: {
        ...otherPlayer,
        hand: ['H-A', 'S-2'],
      },
    });

    expect(screen.getAllByText('Agari').length).toBeGreaterThan(0);
    expect(screen.getByText('Please select your Negri')).toBeInTheDocument();
    expect(screen.getByText('H-A')).toBeInTheDocument();
  });
});
