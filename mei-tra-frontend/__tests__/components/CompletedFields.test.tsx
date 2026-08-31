import { fireEvent, render, screen } from '@testing-library/react';
import { asSeatId } from '@contracts/ids';
import { CompletedFields } from '@/components/game/CompletedFields';

jest.mock('next-intl', () => ({
  useTranslations: () => {
    const translator = (key: string, values?: Record<string, number>) =>
      `${key}:${values?.index ?? ''}`;
    return translator;
  },
}));

jest.mock('@/components/game/CardFace', () => ({
  CardFace: ({ card, faceDown }: { card?: string; faceDown?: boolean }) => (
    <div data-testid={faceDown ? 'card-back' : 'card-front'}>{card}</div>
  ),
}));

const trick = (cards: string[], winner: string) => ({
  cards,
  winnerSeatId: asSeatId(winner),
  dealerSeatId: asSeatId('player-2'),
  winnerTeam: 0 as const,
});

const firstTrick = trick(['A♠', '10♥', 'C-K', '3♦'], 'player-1');
const secondTrick = trick(['2♠', '4♥', '6♦', '8♣'], 'player-2');

describe('CompletedFields', () => {
  it('does not render a completed-field card when there are no completed fields', () => {
    render(<CompletedFields fields={[]} />);

    expect(screen.queryByLabelText('A♠')).not.toBeInTheDocument();
  });

  it('lays every won trick face down', () => {
    render(<CompletedFields fields={[firstTrick, secondTrick]} />);

    const piles = screen.getAllByRole('button');
    expect(piles).toHaveLength(2);
    piles.forEach((pile) => {
      expect(pile).toHaveAttribute('aria-expanded', 'false');
      expect(pile.className).not.toMatch(/\bopen\b/);
    });
    // Four backs per trick, one for each card in the set.
    expect(screen.getAllByTestId('card-back')).toHaveLength(8);
  });

  it('turns a whole four-card set over when its pile is picked', () => {
    render(<CompletedFields fields={[firstTrick, secondTrick]} />);

    const [first, second] = screen.getAllByRole('button');
    fireEvent.click(first);

    expect(first).toHaveAttribute('aria-expanded', 'true');
    expect(first.className).toMatch(/\bopen\b/);
    // The whole set turns, not one card of it.
    ['A♠', '10♥', 'C-K', '3♦'].forEach((card) => {
      expect(first).toContainElement(screen.getByLabelText(card));
    });

    // Picking one leaves the rest face down.
    expect(second).toHaveAttribute('aria-expanded', 'false');
  });

  it('turns the open pile back over, and only ever opens one', () => {
    render(<CompletedFields fields={[firstTrick, secondTrick]} />);

    const [first, second] = screen.getAllByRole('button');
    fireEvent.click(first);
    fireEvent.click(second);

    expect(first).toHaveAttribute('aria-expanded', 'false');
    expect(second).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(second);
    expect(second).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps the ranks and suits readable once a set is turned over', () => {
    render(<CompletedFields fields={[firstTrick]} />);

    fireEvent.click(screen.getAllByRole('button')[0]);

    expect(screen.getByLabelText('A♠')).toHaveTextContent('A♠');
    expect(screen.getByLabelText('10♥')).toHaveTextContent('10♥');
    expect(screen.getByLabelText('C-K')).toHaveTextContent('K♣');
  });

  it('drops the open pile when the round deals a new set of tricks', () => {
    const view = render(<CompletedFields fields={[firstTrick]} />);
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(screen.getAllByRole('button')[0]).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    // A new round arrives as an empty list, then fills again.
    view.rerender(<CompletedFields fields={[]} />);
    view.rerender(<CompletedFields fields={[secondTrick]} />);

    expect(screen.getAllByRole('button')[0]).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
});
