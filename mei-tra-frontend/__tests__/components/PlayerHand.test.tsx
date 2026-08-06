import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { PlayerHand } from '@/components/game/PlayerHand';
import type { GameActions, Player } from '@/types/game.types';

jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => {
    const labels: Record<string, Record<string, string>> = {
      playerHand: {
        agari: 'Agari',
        bid: 'Bid:',
        cards: 'cards',
        negri: 'Negri',
        selectNegri: 'Please select your Negri',
        selectNegriWithAgari: 'This card is Agari. Select your Negri.',
      },
      gameInfo: {
        teamRed: 'Red team',
        teamBlack: 'Black team',
      },
      playerStatus: {
        disconnected: 'Disconnected',
        idle: 'Unresponsive',
        replaceWithCom: 'Replace with COM',
      },
      blowControls: {
        tra: 'No Tra',
        daiya: 'Daiya (♦)',
      },
    };

    const translator = (key: string, values?: Record<string, number>) => {
      if (namespace === 'playerHand' && key === 'takenCount') {
        return `${values?.count ?? 0} sets`;
      }

      return labels[namespace]?.[key] ?? key;
    };

    translator.has = (key: string) =>
      namespace === 'playerHand' && key === 'takenCount';

    return translator;
  },
  useLocale: () => 'en',
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
  CardFace: ({
    card,
    faceDown,
  }: {
    card?: string;
    faceDown?: boolean;
  }) => (
    <div data-testid={faceDown ? 'card-back' : 'card-front'}>
      {card}
    </div>
  ),
}));

jest.mock('@/components/game/Card', () => ({
  Card: ({ card }: { card: string }) => <div>{card}</div>,
}));

jest.mock('@/components/game/CompletedFields', () => ({
  CompletedFields: () => <div>completed fields</div>,
  TakenCardPreview: ({ card }: { card: string }) => <div>{card}</div>,
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
      gamePhase="play"
      whoseTurn="player-1"
      gameActions={gameActions}
      position="left"
      completedFields={[]}
      currentPlayerId="player-1"
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
    expect(screen.getAllByText('H-A').length).toBeGreaterThan(0);
  });

  it('keeps bottom-player status displays in a dedicated zone above the hand', () => {
    renderPlayerHand({
      position: 'bottom',
      agariCard: 'H-A',
      currentHighestDeclaration: { playerId: 'player-2' },
      currentPlayerId: 'player-2',
      whoseTurn: 'player-2',
      player: {
        ...otherPlayer,
        hand: ['H-A', 'S-2'],
      },
    });

    expect(screen.getByText('Agari').closest('.bottomStatusZone')).toBeInTheDocument();
    expect(screen.getByText('Agari').closest('.declarationContext')).toBeInTheDocument();
    expect(screen.getByText('Agari').closest('.playerInfo')).toHaveClass('hasBottomStatus');
    expect(
      screen.getByText('Please select your Negri').closest('.bottomStatusZone'),
    ).toBeInTheDocument();
  });

  it('shows taken sets and the red team badge in the player info', () => {
    renderPlayerHand({
      position: 'bottom',
      currentPlayerId: 'player-2',
      negriCard: 'H-A',
    });

    expect(screen.getByText('0 sets').closest('.playerInfoBadges')).toBe(
      screen.getByText('Red team').closest('.playerInfoBadges'),
    );
    expect(screen.getByText('Red team')).toHaveClass('teamRedBadge');
    expect(screen.queryByText('Negri')).not.toBeInTheDocument();
  });

  it('uses the translated no-trump label in the declaration badge', () => {
    renderPlayerHand({
      currentHighestDeclaration: {
        playerId: 'player-2',
        trumpType: 'tra',
        numberOfPairs: 6,
      },
    });

    expect(screen.getByText('No Tra')).toHaveClass('declarationSuit');
  });

  it('omits the suit symbol from the declaration badge', () => {
    renderPlayerHand({
      currentHighestDeclaration: {
        playerId: 'player-2',
        trumpType: 'daiya',
        numberOfPairs: 7,
      },
    });

    expect(screen.getByText('Daiya')).toHaveClass('declarationSuit');
    expect(screen.queryByText('Daiya (♦)')).not.toBeInTheDocument();
  });

  it('shows a black team badge for team one', () => {
    renderPlayerHand({
      player: { ...otherPlayer, team: 1 },
    });

    expect(screen.getByText('Black team')).toHaveClass('teamBlackBadge');
  });

  it('reorders the current player hand locally with pointer drag', () => {
    renderPlayerHand({
      currentPlayerId: 'player-2',
      player: {
        ...otherPlayer,
        hand: ['H-A', 'S-2'],
      },
    });

    const cards = screen.getAllByTestId('card-front');
    const targetCard = cards[1].parentElement as HTMLElement;
    Object.defineProperty(targetCard, 'getBoundingClientRect', {
      value: () => ({ left: 100, width: 80 }),
    });
    fireEvent.pointerDown(cards[0], { isPrimary: true });
    fireEvent.pointerMove(targetCard, { clientX: 170 });
    fireEvent.pointerUp(targetCard, { clientX: 170 });

    expect(screen.getAllByTestId('card-front').map((card) => card.textContent)).toEqual([
      'S-2',
      'H-A',
    ]);
  });

  it('shows an insertion marker on the target card while reordering', () => {
    renderPlayerHand({
      currentPlayerId: 'player-2',
      player: {
        ...otherPlayer,
        hand: ['H-A', 'S-2'],
      },
    });

    const cards = screen.getAllByTestId('card-front');
    const targetCard = cards[1].parentElement as HTMLElement;
    Object.defineProperty(targetCard, 'getBoundingClientRect', {
      value: () => ({ left: 100, width: 80 }),
    });
    fireEvent.pointerDown(cards[0], { isPrimary: true });
    fireEvent.pointerMove(targetCard, { clientX: 110 });

    expect(targetCard.className).toMatch(/insertBefore|insertAfter/);
  });

  it('overlays the animated current-turn clock on the player avatar', () => {
    renderPlayerHand({
      currentPlayerId: 'player-2',
      isCurrentTurn: true,
      takenCount: 3,
    });

    expect(screen.getByText('3 sets')).toHaveClass('takenCount');
    expect(screen.getByText('Red team').closest('.playerInfoBadges')).toBe(
      screen.getByText('3 sets').closest('.playerInfoBadges'),
    );
    const turnBadge = screen.getByLabelText('currentTurn');
    expect(turnBadge).toHaveClass('avatarTurnBadge');
    expect(turnBadge.parentElement).toHaveClass('playerAvatar');
    expect(turnBadge.querySelector('.clockHand')).toBeInTheDocument();
    expect(screen.queryByLabelText('3setsTaken')).not.toBeInTheDocument();
  });

  it('shows the selected spectator perspective hand face up', () => {
    renderPlayerHand({
      currentPlayerId: 'player-2',
      isSpectator: true,
      isSpectatorPerspective: true,
    });

    expect(screen.getByTestId('card-front')).toHaveTextContent('H-A');
    expect(screen.queryByTestId('card-back')).not.toBeInTheDocument();
  });

  it('keeps non-perspective spectator hands face down', () => {
    renderPlayerHand({
      currentPlayerId: 'player-1',
      isSpectator: true,
    });

    expect(screen.getByTestId('card-back')).toBeInTheDocument();
    expect(screen.queryByTestId('card-front')).not.toBeInTheDocument();
  });

  it('lets spectators switch perspective from the player info button', () => {
    const onSpectatorPerspectiveChange = jest.fn();
    renderPlayerHand({
      isSpectator: true,
      onSpectatorPerspectiveChange,
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Switch spectator perspective to Player 2',
      }),
    );

    expect(onSpectatorPerspectiveChange).toHaveBeenCalledWith('player-2');
  });
});
