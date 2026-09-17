import { fireEvent, render, screen } from '@testing-library/react';
import { ChomboReportPanel } from '@/components/game/ChomboReportPanel';
import type { Player } from '@/types/game.types';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const player = (seatId: string, isCOM = false) =>
  ({ seatId, name: seatId, team: 0, hand: [], isCOM }) as unknown as Player;

describe('ChomboReportPanel', () => {
  it('names every violation and reports the selected one', () => {
    const onReport = jest.fn();
    render(
      <ChomboReportPanel
        players={[player('me'), player('rival'), player('com', true)]}
        currentSeatId="me"
        onReport={onReport}
      />,
    );

    expect(
      screen.getAllByRole('option').map((option) => option.textContent),
    ).toEqual([
      'rival',
      'negriForget',
      'wrongSuit',
      'fourJack',
      'lastTanzen',
    ]);

    fireEvent.change(screen.getByLabelText('violation'), {
      target: { value: 'last-tanzen' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'submit' }));

    expect(onReport).toHaveBeenCalledWith('rival', 'last-tanzen');
  });
});
