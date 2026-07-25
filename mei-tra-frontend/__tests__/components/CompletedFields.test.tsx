import { render, screen } from '@testing-library/react';
import { CompletedFields } from '@/components/game/CompletedFields';

describe('CompletedFields', () => {
  it('does not render a completed-field card when there are no completed fields', () => {
    render(<CompletedFields fields={[]} />);

    expect(screen.queryByLabelText('A♠')).not.toBeInTheDocument();
  });

  it('shows each completed card as a compact rank and suit mark', () => {
    render(
      <CompletedFields
        fields={[
          { cards: ['A♠', '10♥'], winnerId: 'player-1', winnerTeam: 0 },
          { cards: ['C-K'], winnerId: 'player-2', winnerTeam: 0 },
        ]}
      />,
    );

    expect(screen.getByLabelText('A♠')).toHaveTextContent('A♠');
    expect(screen.getByLabelText('10♥')).toHaveTextContent('10♥');
    expect(screen.getByLabelText('C-K')).toHaveTextContent('K♣');
  });
});
