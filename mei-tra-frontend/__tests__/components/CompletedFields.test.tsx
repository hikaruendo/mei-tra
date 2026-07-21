import { render, screen } from '@testing-library/react';
import { CompletedFields } from '@/components/game/CompletedFields';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, number>) => {
    const labels: Record<string, string> = {
      takenLabel: 'Taken',
      takenCount: `${values?.count ?? 0} pairs`,
      unknown: 'Unknown',
    };

    return labels[key] ?? key;
  },
}));

jest.mock('@/components/game/Card', () => ({
  Card: ({ card }: { card: string }) => <span>{card}</span>,
}));

describe('CompletedFields', () => {
  it('shows zero taken pairs when there are no completed fields', () => {
    render(<CompletedFields fields={[]} players={[]} />);

    expect(screen.getByText('Taken')).toBeInTheDocument();
    expect(screen.getByText('0 pairs')).toBeInTheDocument();
  });

  it('shows the current number of taken pairs', () => {
    render(
      <CompletedFields
        fields={[
          { cards: ['A♠'], winnerId: 'player-1', winnerTeam: 0 },
          { cards: ['K♣'], winnerId: 'player-2', winnerTeam: 0 },
        ]}
        players={[
          { playerId: 'player-1', name: 'Player 1' },
          { playerId: 'player-2', name: 'Player 2' },
        ]}
      />,
    );

    expect(screen.getByText('2 pairs')).toBeInTheDocument();
    expect(screen.getByText('Player 1')).toBeInTheDocument();
    expect(screen.getByText('Player 2')).toBeInTheDocument();
  });
});
