import { render, screen } from '@testing-library/react';
import { GameField } from '@/components/game/GameField';
import type { Field, Player } from '@/types/game.types';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/components/game/CardFace', () => ({
  CardFace: ({ card }: { card?: string }) => (
    <div data-testid="card-front">{card}</div>
  ),
}));

const seat = (seatId: string, team: 0 | 1) =>
  ({
    seatId,
    playerId: seatId,
    id: seatId,
    name: seatId,
    hand: [],
    team,
    isPasser: false,
  }) as unknown as Player;

const players = [seat('p1', 0), seat('p2', 1), seat('p3', 0), seat('p4', 1)];

const field = (cards: string[], seatIds: string[]) =>
  ({
    cards,
    playedBySeatIds: seatIds,
    baseCard: cards[0] ?? '',
    baseSuit: '♠',
    dealerSeatId: 'p1',
    isComplete: false,
  }) as unknown as Field;

const renderField = (currentField: Field | null) =>
  render(
    <GameField
      currentField={currentField}
      players={players}
      onBaseSuitSelect={jest.fn()}
      isCurrentPlayer={false}
      currentSeatId="p1"
    />,
  );

const mat = (container: HTMLElement) =>
  container.querySelector('[class*="fieldMat"]');

describe('GameField', () => {
  // The cushion is set on the table for the whole hand, so it has to survive
  // the gap between tricks — the field is emptied every time one completes.
  it('keeps the mat on the table before the first card is played', () => {
    const { container } = renderField(null);

    expect(mat(container)).toBeInTheDocument();
    expect(screen.queryAllByTestId('card-front')).toHaveLength(0);
  });

  it('keeps the mat on the table when a completed trick clears the field', () => {
    const { container } = renderField(field([], []));

    expect(mat(container)).toBeInTheDocument();
    expect(screen.queryAllByTestId('card-front')).toHaveLength(0);
  });

  it('lays the played cards over the mat', () => {
    const { container } = renderField(
      field(['A♠', '10♥', 'K♣', '3♦'], ['p1', 'p2', 'p3', 'p4']),
    );

    expect(mat(container)).toBeInTheDocument();
    expect(
      screen.getAllByTestId('card-front').map((card) => card.textContent),
    ).toEqual(['A♠', '10♥', 'K♣', '3♦']);
  });

  it('hides the mat from assistive tech', () => {
    const { container } = renderField(null);

    expect(mat(container)).toHaveAttribute('aria-hidden', 'true');
  });
});
