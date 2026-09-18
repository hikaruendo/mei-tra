import { act, fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { asSeatId } from '@contracts/ids';
import { PlayerHand } from '@/components/game/PlayerHand';
import type { Field, GameActions, Player } from '@/types/game.types';

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
  PlayAndCancelBtn: ({
    buttonText,
    setSelectedCard,
    onCancel,
    onClick,
  }: {
    buttonText: string;
    setSelectedCard: (card: string | null) => void;
    onCancel: () => void;
    onClick: () => void;
  }) => (
    <>
      <button onClick={() => {
        onCancel();
        setSelectedCard(null);
      }}>cancel</button>
      <button onClick={onClick}>{buttonText}</button>
    </>
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
  seatId: 'player-2',
  name: 'Player 2',
  team: 0,
  hand: ['H-A'],
  isCOM: false,
};

const buildPlayerHand = (
  overrides: Partial<React.ComponentProps<typeof PlayerHand>> = {},
) => (
  <PlayerHand
    player={otherPlayer}
    isCurrentTurn={false}
    negriCard={null}
    gamePhase="play"
    whoseTurn="player-1"
    gameActions={gameActions}
    position="left"
    completedFields={[]}
    currentSeatId="player-1"
    currentField={null}
    currentTrump={null}
    isHost
    onReplaceWithCOM={jest.fn()}
    {...overrides}
  />
);

const renderPlayerHand = (
  overrides: Partial<React.ComponentProps<typeof PlayerHand>> = {},
) => render(buildPlayerHand(overrides));

const ledField = (baseCard: string): Field => ({
  cards: [baseCard],
  playedBySeatIds: [asSeatId('player-1')],
  baseCard,
  dealerSeatId: asSeatId('player-1'),
  isComplete: false,
});

// '5♠' follows the led suit; 'A♥' does not while a spade is in hand.
const followSuitTurn = {
  position: 'bottom',
  gamePhase: 'play',
  whoseTurn: 'player-2',
  currentSeatId: 'player-2',
  currentField: ledField('9♠'),
  currentTrump: 'tra',
  player: { ...otherPlayer, hand: ['5♠', 'A♥'] },
} as const;

const handCards = () =>
  screen
    .getAllByTestId('card-front')
    .map((card) => card.parentElement as HTMLElement);

describe('PlayerHand', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('deals every card from left to right only while a fresh cue is active', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-27T00:00:00.000Z'));
    const startedAt = Date.now();

    renderPlayerHand({
      currentSeatId: 'player-2',
      player: {
        ...otherPlayer,
        hand: ['H-A', 'S-2'],
      },
      dealAnimationCue: {
        token: 1,
        startedAt,
        seatIds: ['player-2'],
      },
    });

    const cards = screen.getAllByTestId('card-front');
    expect(cards[0].parentElement).toHaveClass('dealingCard');
    expect(cards[0].parentElement).toHaveStyle('--deal-card-delay: 0ms');
    expect(cards[1].parentElement).toHaveStyle('--deal-card-delay: 45ms');

    act(() => {
      jest.advanceTimersByTime(225);
    });
    expect(cards[0].parentElement).not.toHaveClass('dealingCard');

  });

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
      currentHighestDeclaration: { seatId: 'player-2' },
      currentSeatId: 'player-2',
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
      currentHighestDeclaration: { seatId: 'player-2' },
      currentSeatId: 'player-2',
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
      currentSeatId: 'player-2',
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
        seatId: 'player-2',
        trumpType: 'tra',
        numberOfPairs: 6,
      },
    });

    expect(screen.getByText('No Tra')).toHaveClass('declarationSuit');
  });

  it('omits the suit symbol from the declaration badge', () => {
    renderPlayerHand({
      currentHighestDeclaration: {
        seatId: 'player-2',
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
    const onCardSelection = jest.fn();
    const onHandReorder = jest.fn();
    renderPlayerHand({
      currentSeatId: 'player-2',
      player: {
        ...otherPlayer,
        hand: ['H-A', 'S-2'],
      },
      onCardSelection,
      onHandReorder,
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
    expect(onHandReorder).toHaveBeenCalledTimes(1);
    expect(onCardSelection).not.toHaveBeenCalled();

    fireEvent.pointerUp(targetCard, { clientX: 170 });
    expect(onHandReorder).toHaveBeenCalledTimes(1);
  });

  it('does not play a sound when a pointer drop keeps the same order', () => {
    const onHandReorder = jest.fn();
    renderPlayerHand({
      currentSeatId: 'player-2',
      player: {
        ...otherPlayer,
        hand: ['H-A', 'S-2'],
      },
      onHandReorder,
    });

    const cards = screen.getAllByTestId('card-front');
    const targetCard = cards[0].parentElement as HTMLElement;
    Object.defineProperty(targetCard, 'getBoundingClientRect', {
      value: () => ({ left: 100, width: 80 }),
    });
    fireEvent.pointerDown(cards[1], { isPrimary: true });
    fireEvent.pointerMove(targetCard, { clientX: 170 });
    fireEvent.pointerUp(targetCard, { clientX: 170 });

    expect(screen.getAllByTestId('card-front').map((card) => card.textContent)).toEqual([
      'H-A',
      'S-2',
    ]);
    expect(onHandReorder).not.toHaveBeenCalled();
  });

  it('plays once for a successful native drag and ignores the repeated no-op', () => {
    const onHandReorder = jest.fn();
    renderPlayerHand({
      currentSeatId: 'player-2',
      player: {
        ...otherPlayer,
        hand: ['H-A', 'S-2'],
      },
      onHandReorder,
    });

    const dataTransfer = {
      dropEffect: 'move',
      effectAllowed: 'move',
      getData: jest.fn(() => 'H-A'),
      setData: jest.fn(),
    };
    const cards = screen.getAllByTestId('card-front');
    const sourceCard = cards[0].parentElement as HTMLElement;
    const targetCard = cards[1].parentElement as HTMLElement;
    Object.defineProperty(targetCard, 'getBoundingClientRect', {
      value: () => ({ left: 100, width: 80 }),
    });

    fireEvent.dragStart(sourceCard, { dataTransfer });
    fireEvent.dragOver(targetCard, { clientX: 170, dataTransfer });
    fireEvent.drop(targetCard, { clientX: 170, dataTransfer });
    expect(onHandReorder).toHaveBeenCalledTimes(1);

    fireEvent.dragStart(sourceCard, { dataTransfer });
    fireEvent.drop(targetCard, { clientX: 170, dataTransfer });
    expect(onHandReorder).toHaveBeenCalledTimes(1);
  });

  it('plays only when selecting a new card, not when cancelling', () => {
    const onCardSelection = jest.fn();
    const onCancel = jest.fn();
    renderPlayerHand({
      currentSeatId: 'player-2',
      whoseTurn: 'player-2',
      player: {
        ...otherPlayer,
        hand: ['H-A', 'S-2'],
      },
      onCardSelection,
      onCancel,
    });

    const cards = screen.getAllByTestId('card-front');
    fireEvent.click(cards[0].parentElement as HTMLElement);
    expect(onCardSelection).toHaveBeenCalledTimes(1);

    fireEvent.click(cards[1].parentElement as HTMLElement);
    expect(onCardSelection).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole('button', { name: 'cancel' }));
    expect(onCardSelection).toHaveBeenCalledTimes(2);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows an insertion marker on the target card while reordering', () => {
    renderPlayerHand({
      currentSeatId: 'player-2',
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

  it('keeps the insertion marker when the native drag cancels the pointer stream', () => {
    renderPlayerHand({
      currentSeatId: 'player-2',
      player: {
        ...otherPlayer,
        hand: ['H-A', 'S-2', 'D-3'],
      },
    });

    const dataTransfer = {
      dropEffect: 'move',
      effectAllowed: 'move',
      getData: jest.fn(() => 'H-A'),
      setData: jest.fn(),
    };
    const cards = screen.getAllByTestId('card-front');
    const sourceCard = cards[0].parentElement as HTMLElement;
    const secondCard = cards[1].parentElement as HTMLElement;
    const thirdCard = cards[2].parentElement as HTMLElement;

    fireEvent.pointerDown(sourceCard, { isPrimary: true });
    fireEvent.dragStart(sourceCard, { dataTransfer });
    fireEvent.dragOver(secondCard, { clientX: 170, dataTransfer });
    expect(secondCard.className).toMatch(/insertBefore|insertAfter/);

    // Chromium cancels the pointer stream when the native drag takes over.
    fireEvent.pointerCancel(sourceCard);
    expect(secondCard.className).toMatch(/insertBefore|insertAfter/);

    // The drag is still running, and later dragovers keep moving the marker.
    fireEvent.dragOver(thirdCard, { clientX: 250, dataTransfer });
    expect(thirdCard.className).toMatch(/insertBefore|insertAfter/);
    expect(secondCard.className).not.toMatch(/insertBefore|insertAfter/);
  });

  it('takes the dealt order when a card joins an arranged hand', () => {
    const arranged = { ...otherPlayer, hand: ['H-A', 'S-2'] };
    const view = render(
      buildPlayerHand({ currentSeatId: 'player-2', player: arranged }),
    );

    const cards = screen.getAllByTestId('card-front');
    const targetCard = cards[1].parentElement as HTMLElement;
    Object.defineProperty(targetCard, 'getBoundingClientRect', {
      value: () => ({ left: 100, width: 80 }),
    });
    fireEvent.pointerDown(cards[0], { isPrimary: true });
    fireEvent.pointerMove(targetCard, { clientX: 170 });
    fireEvent.pointerUp(targetCard, { clientX: 170 });
    expect(
      screen.getAllByTestId('card-front').map((card) => card.textContent),
    ).toEqual(['S-2', 'H-A']);

    // A re-deal or the agari pickup arrives already sorted by suit, so the
    // arrangement must give way rather than stranding the new card at the end.
    view.rerender(
      buildPlayerHand({
        currentSeatId: 'player-2',
        player: { ...otherPlayer, hand: ['S-2', 'S-5', 'H-A'] },
      }),
    );

    expect(
      screen.getAllByTestId('card-front').map((card) => card.textContent),
    ).toEqual(['S-2', 'S-5', 'H-A']);
  });

  it('cancels an in-flight drag when the hand is dealt again', () => {
    const view = render(
      buildPlayerHand({
        currentSeatId: 'player-2',
        player: { ...otherPlayer, hand: ['H-A', 'S-2'] },
      }),
    );

    const cards = screen.getAllByTestId('card-front');
    const targetCard = cards[1].parentElement as HTMLElement;
    fireEvent.pointerDown(cards[0], { isPrimary: true });
    fireEvent.pointerMove(targetCard, { clientX: 110 });
    expect(targetCard.className).toMatch(/insertBefore|insertAfter/);

    // The re-deal keeps S-2, so a drag left running would still mark it.
    view.rerender(
      buildPlayerHand({
        currentSeatId: 'player-2',
        player: { ...otherPlayer, hand: ['S-2', 'S-5', 'H-A'] },
      }),
    );

    const markers = screen
      .getAllByTestId('card-front')
      .map((card) => card.parentElement?.className ?? '');
    expect(markers).not.toContainEqual(
      expect.stringMatching(/insertBefore|insertAfter/),
    );
    expect(markers).not.toContainEqual(expect.stringMatching(/dragging/));
  });

  it('still clears a cancelled pointer drag when no native drag is running', () => {
    renderPlayerHand({
      currentSeatId: 'player-2',
      player: {
        ...otherPlayer,
        hand: ['H-A', 'S-2'],
      },
    });

    const cards = screen.getAllByTestId('card-front');
    const targetCard = cards[1].parentElement as HTMLElement;

    fireEvent.pointerDown(cards[0], { isPrimary: true });
    fireEvent.pointerMove(targetCard, { clientX: 110 });
    expect(targetCard.className).toMatch(/insertBefore|insertAfter/);

    // A touch drag taken over by scrolling must still reset.
    fireEvent.pointerCancel(cards[0]);
    expect(targetCard.className).not.toMatch(/insertBefore|insertAfter/);
  });

  it('overlays the animated current-turn clock on the player avatar', () => {
    renderPlayerHand({
      currentSeatId: 'player-2',
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
      currentSeatId: 'player-2',
      isSpectator: true,
      isSpectatorPerspective: true,
    });

    expect(screen.getByTestId('card-front')).toHaveTextContent('H-A');
    expect(screen.queryByTestId('card-back')).not.toBeInTheDocument();
  });

  it('keeps non-perspective spectator hands face down', () => {
    renderPlayerHand({
      currentSeatId: 'player-1',
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

  it('reveals a four-jack hand automatically on its blow turn in normal mode', () => {
    const revealBrokenHand = gameActions.revealBrokenHand as jest.Mock;
    revealBrokenHand.mockClear();

    renderPlayerHand({
      player: { ...otherPlayer, seatId: 'player-1', hasRequiredBroken: true },
      position: 'bottom',
      gamePhase: 'blow',
      whoseTurn: 'player-1',
      isCurrentTurn: true,
      currentSeatId: 'player-1',
      gameMode: 'normal',
    });

    expect(revealBrokenHand).toHaveBeenCalledWith('player-1');
  });

  it('leaves a four-jack hand to the player in pro mode', () => {
    const revealBrokenHand = gameActions.revealBrokenHand as jest.Mock;
    revealBrokenHand.mockClear();

    renderPlayerHand({
      player: { ...otherPlayer, seatId: 'player-1', hasRequiredBroken: true },
      position: 'bottom',
      gamePhase: 'blow',
      whoseTurn: 'player-1',
      isCurrentTurn: true,
      currentSeatId: 'player-1',
      gameMode: 'pro',
    });

    expect(revealBrokenHand).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'revealBroken' }));

    expect(revealBrokenHand).toHaveBeenCalledWith('player-1');
  });

  it.each(['normal', 'pro'] as const)(
    'shows the broken hand button only for a broken hand in %s mode',
    (gameMode) => {
      const blowTurn = {
        position: 'bottom',
        gamePhase: 'blow',
        whoseTurn: 'player-1',
        isCurrentTurn: true,
        currentSeatId: 'player-1',
        gameMode,
      } as const;
      const { rerender } = renderPlayerHand({
        ...blowTurn,
        player: { ...otherPlayer, seatId: 'player-1' },
      });

      expect(
        screen.queryByRole('button', { name: 'revealBroken' }),
      ).not.toBeInTheDocument();

      rerender(
        buildPlayerHand({
          ...blowTurn,
          player: { ...otherPlayer, seatId: 'player-1', hasBroken: true },
        }),
      );

      expect(
        screen.getByRole('button', { name: 'revealBroken' }),
      ).toBeInTheDocument();
    },
  );

  it('hides the broken hand button once the player has acted or the blow is over', () => {
    const brokenPlayer: Player = {
      ...otherPlayer,
      seatId: 'player-1',
      hasBroken: true,
    };
    const blowTurn = {
      player: brokenPlayer,
      position: 'bottom',
      gamePhase: 'blow',
      whoseTurn: 'player-1',
      isCurrentTurn: true,
      currentSeatId: 'player-1',
      gameMode: 'pro',
    } as const;
    const { rerender } = renderPlayerHand({
      ...blowTurn,
      hasActedInBlow: true,
    });

    expect(
      screen.queryByRole('button', { name: 'revealBroken' }),
    ).not.toBeInTheDocument();

    rerender(buildPlayerHand({ ...blowTurn, gamePhase: 'play' }));

    expect(
      screen.queryByRole('button', { name: 'revealBroken' }),
    ).not.toBeInTheDocument();
  });

  it('greys out an illegal card in normal mode and refuses to select it', () => {
    const onCardSelection = jest.fn();
    renderPlayerHand({ ...followSuitTurn, gameMode: 'normal', onCardSelection });

    const [legalCard, illegalCard] = handCards();
    expect(illegalCard).toHaveClass('unplayable');
    expect(illegalCard).not.toHaveClass('playable');
    expect(legalCard).toHaveClass('playable');

    fireEvent.click(illegalCard);
    expect(screen.queryByRole('button', { name: 'play' })).not.toBeInTheDocument();
    expect(onCardSelection).not.toHaveBeenCalled();

    fireEvent.click(legalCard);
    expect(screen.getByRole('button', { name: 'play' })).toBeInTheDocument();
    expect(onCardSelection).toHaveBeenCalledTimes(1);
  });

  it('leaves an illegal card selectable in pro mode', () => {
    renderPlayerHand({ ...followSuitTurn, gameMode: 'pro' });

    const [, illegalCard] = handCards();
    expect(illegalCard).toHaveClass('playable');
    expect(illegalCard).not.toHaveClass('unplayable');
    expect(illegalCard.parentElement).toHaveAttribute(
      'aria-roledescription',
      'draggable',
    );
  });

  it('shows no hint about where to drag in pro mode', () => {
    // On its turn, as the bid winner who still owes the Negri.
    renderPlayerHand({
      ...followSuitTurn,
      gameMode: 'pro',
      currentHighestDeclaration: { seatId: 'player-2' },
    });

    expect(screen.queryByText(/[↑↓]/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('negri-drop-target')).not.toBeInTheDocument();
  });

  it('shows a revealed hand as rank and suit marks', () => {
    const player: Player = { ...otherPlayer, hand: ['H-A', 'S-2'] };
    const { rerender } = renderPlayerHand({ player });

    expect(screen.getAllByTestId('card-back')).toHaveLength(2);

    rerender(buildPlayerHand({ player, revealedHand: ['H-A', 'S-2'] }));

    expect(screen.queryAllByTestId('card-back')).toHaveLength(0);
    expect(screen.queryAllByTestId('card-front')).toHaveLength(0);
    expect(screen.getByText('H-A')).toBeInTheDocument();
    expect(screen.getByText('S-2')).toBeInTheDocument();
  });
});

describe('PlayerHand pro mode drag', () => {
  // jsdom has no PointerEvent, and dnd-kit reads the pointer position from it.
  class TestPointerEvent extends MouseEvent {
    readonly isPrimary = true;
    readonly pointerId = 1;
  }
  const originalPointerEvent = window.PointerEvent;

  beforeAll(() => {
    window.PointerEvent = TestPointerEvent as typeof PointerEvent;
  });

  afterAll(() => {
    window.PointerEvent = originalPointerEvent;
  });

  afterEach(() => {
    // jsdom has no hit testing either; each test points at a card itself.
    delete (document as { elementFromPoint?: unknown }).elementFromPoint;
    jest.mocked(gameActions.playCard).mockClear();
    jest.mocked(gameActions.selectNegri).mockClear();
  });

  // jsdom lays nothing out, so the seat info is given a rect by hand. The
  // drags below start at x = 300 and end over it at x = 50.
  const placeSeatInfo = () => {
    const seatInfo = document.querySelector('.playerInfoContainer');
    if (!seatInfo) throw new Error('no seat info');
    Object.defineProperty(seatInfo, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 0, top: 0, width: 100, height: 200 }),
    });
  };

  // The bid winner, off turn, before placing the Negri: a pro Negri does not
  // wait for the turn.
  const negriOpen = {
    gameMode: 'pro',
    whoseTurn: 'player-1',
    currentSeatId: 'player-2',
    currentHighestDeclaration: { seatId: 'player-2' },
    player: { ...otherPlayer, hand: ['H-A', 'S-2', 'D-3'] },
  } as const;

  const pointAt = (element: HTMLElement) => {
    Object.defineProperty(element, 'getBoundingClientRect', {
      value: () => ({ left: 100, width: 80 }),
    });
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: () => element,
    });
  };

  const handOrder = () =>
    screen.getAllByTestId('card-front').map((card) => card.textContent);

  const handContainer = () => handCards()[0].closest('.handContainer');

  const markedCards = () =>
    handCards().filter((card) => /insertBefore|insertAfter/.test(card.className));

  const drag = async (
    card: HTMLElement,
    from: { x: number; y: number },
    to: { x: number; y: number },
    onMoved: () => void = () => {},
  ) => {
    await act(async () => {
      fireEvent.pointerDown(card, { clientX: from.x, clientY: from.y, button: 0 });
      // Clears dnd-kit's activation distance before the real move.
      fireEvent.pointerMove(document, { clientX: from.x + 10, clientY: from.y });
    });
    await act(async () => {
      fireEvent.pointerMove(document, { clientX: to.x, clientY: to.y });
    });
    try {
      onMoved();
    } finally {
      // Always release: a drag left open would carry into the next test.
      await act(async () => {
        fireEvent.pointerUp(document, { clientX: to.x, clientY: to.y });
      });
    }
  };

  it('reorders the hand when a card is dropped sideways on another card', async () => {
    const onHandReorder = jest.fn();
    renderPlayerHand({
      gameMode: 'pro',
      currentSeatId: 'player-2',
      player: { ...otherPlayer, hand: ['H-A', 'S-2', 'D-3'] },
      onHandReorder,
    });
    const [first, , third] = handCards();
    pointAt(third);

    await drag(first, { x: 20, y: 50 }, { x: 170, y: 50 }, () => {
      expect(third.className).toMatch(/insertAfter/);
      // Turns off :hover lift on the cards the held one passes over.
      expect(handContainer()).toHaveClass('holdingCard');
    });

    expect(handContainer()).not.toHaveClass('holdingCard');
    expect(handOrder()).toEqual(['S-2', 'D-3', 'H-A']);
    expect(onHandReorder).toHaveBeenCalledTimes(1);
    // Moved cards remount, so the marker is checked on a fresh query.
    expect(markedCards()).toHaveLength(0);
  });

  it('plays a card dropped upward on its turn without also reordering', async () => {
    const onHandReorder = jest.fn();
    renderPlayerHand({
      gameMode: 'pro',
      whoseTurn: 'player-2',
      currentSeatId: 'player-2',
      player: { ...otherPlayer, hand: ['H-A', 'S-2'] },
      onHandReorder,
    });
    const [first, second] = handCards();
    // Released over another card, so only the play keeps it from reordering.
    pointAt(second);

    await drag(first, { x: 20, y: 200 }, { x: 170, y: 100 }, () => {
      // The release will play, so no marker may promise a reorder.
      expect(markedCards()).toHaveLength(0);
    });

    expect(gameActions.playCard).toHaveBeenCalledWith('H-A');
    expect(onHandReorder).not.toHaveBeenCalled();
    expect(handOrder()).toEqual(['H-A', 'S-2']);
  });

  it('leaves a sent card out of the hand while the server has not answered', () => {
    const props = {
      gameMode: 'pro',
      whoseTurn: 'player-2',
      currentSeatId: 'player-2',
    } as const;
    const { rerender } = renderPlayerHand({
      ...props,
      player: { ...otherPlayer, hand: ['H-A', 'S-2', 'D-3'] },
      pendingHandCard: 'S-2',
    });

    expect(handOrder()).toEqual(['H-A', 'D-3']);

    // The server refused the play: the card is shown in its slot again.
    rerender(buildPlayerHand({
      ...props,
      player: { ...otherPlayer, hand: ['H-A', 'S-2', 'D-3'] },
      pendingHandCard: null,
    }));
    expect(handOrder()).toEqual(['H-A', 'S-2', 'D-3']);
  });

  it('marks a sideways reorder at the same height when the release cannot play', async () => {
    renderPlayerHand({
      gameMode: 'pro',
      whoseTurn: 'player-1',
      currentSeatId: 'player-2',
      player: { ...otherPlayer, hand: ['H-A', 'S-2'] },
    });
    const [first, second] = handCards();
    pointAt(second);

    // Not this player's turn, so the upward release reorders instead.
    await drag(first, { x: 20, y: 200 }, { x: 170, y: 100 }, () => {
      expect(markedCards()).toHaveLength(1);
    });

    expect(gameActions.playCard).not.toHaveBeenCalled();
    expect(handOrder()).toEqual(['S-2', 'H-A']);
  });

  it('drops the held card when the hand is dealt again mid-drag', async () => {
    const onHandReorder = jest.fn();
    const props = {
      gameMode: 'pro',
      currentSeatId: 'player-2',
      onHandReorder,
    } as const;
    const { rerender } = renderPlayerHand({
      ...props,
      player: { ...otherPlayer, hand: ['H-A', 'S-2', 'D-3'] },
    });
    const [first, , third] = handCards();
    pointAt(third);

    await drag(first, { x: 20, y: 50 }, { x: 170, y: 50 }, () => {
      // An all-pass round deals H-A back, so the drag's card is still mounted.
      rerender(buildPlayerHand({
        ...props,
        player: { ...otherPlayer, hand: ['H-A', 'C-4', 'D-5'] },
      }));
      pointAt(handCards()[2]);
      expect(handContainer()).not.toHaveClass('holdingCard');
    });

    expect(onHandReorder).not.toHaveBeenCalled();
    expect(handOrder()).toEqual(['H-A', 'C-4', 'D-5']);
    expect(markedCards()).toHaveLength(0);
  });

  it('places the Negri when a card is let go over the seat info', async () => {
    const onHandReorder = jest.fn();
    renderPlayerHand({ ...negriOpen, onHandReorder });
    placeSeatInfo();
    const [first, second] = handCards();
    // A card under the pointer would otherwise mark a reorder.
    pointAt(first);

    await drag(second, { x: 300, y: 100 }, { x: 50, y: 100 }, () => {
      expect(screen.getByTestId('negri-drop-target')).toBeInTheDocument();
      // The held card is labelled too, as the hand can cover the seat info.
      expect(screen.getByText('Negri')).toBeInTheDocument();
      expect(markedCards()).toHaveLength(0);
    });

    expect(gameActions.selectNegri).toHaveBeenCalledWith('S-2');
    expect(screen.queryByTestId('negri-drop-target')).not.toBeInTheDocument();
    expect(screen.queryByText('Negri')).not.toBeInTheDocument();
    expect(onHandReorder).not.toHaveBeenCalled();
  });

  it('marks nothing while the held card is away from the seat info', async () => {
    renderPlayerHand(negriOpen);
    placeSeatInfo();
    const [first] = handCards();

    await drag(first, { x: 300, y: 100 }, { x: 300, y: 40 }, () => {
      expect(screen.queryByTestId('negri-drop-target')).not.toBeInTheDocument();
      expect(screen.queryByText('Negri')).not.toBeInTheDocument();
    });

    expect(gameActions.selectNegri).not.toHaveBeenCalled();
  });

  it('places no Negri for a card only dragged down', async () => {
    renderPlayerHand(negriOpen);
    placeSeatInfo();
    const [first] = handCards();

    await drag(first, { x: 300, y: 100 }, { x: 300, y: 300 });

    expect(gameActions.selectNegri).not.toHaveBeenCalled();
  });

  it.each([
    ['once the round fields are all played', { completedFieldCount: 10 }],
    ['once the Negri is placed', { negriCard: 'C-9', negriSeatId: 'player-2' }],
    ['for a seat that lost the bid', { currentHighestDeclaration: { seatId: 'player-1' } }],
  ] as const)('takes no Negri over the seat info %s', async (_when, overrides) => {
    renderPlayerHand({ ...negriOpen, ...overrides });
    placeSeatInfo();
    const [first] = handCards();

    await drag(first, { x: 300, y: 100 }, { x: 50, y: 100 }, () => {
      expect(screen.queryByTestId('negri-drop-target')).not.toBeInTheDocument();
    });

    expect(gameActions.selectNegri).not.toHaveBeenCalled();
  });
});
