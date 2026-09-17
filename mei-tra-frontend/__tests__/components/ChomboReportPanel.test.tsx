import { fireEvent, render, screen } from '@testing-library/react';
import { ChomboReportPanel } from '@/components/game/ChomboReportPanel';
import type { Player } from '@/types/game.types';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const player = (seatId: string, team: 0 | 1, isCOM = false) =>
  ({ seatId, name: seatId, team, hand: [], isCOM }) as unknown as Player;

describe('ChomboReportPanel', () => {
  it('names every violation and reports the selected one', () => {
    const onReport = jest.fn();
    render(
      <ChomboReportPanel
        players={[
          player('me', 0),
          player('partner', 0),
          player('rival', 1),
          player('com', 1, true),
        ]}
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

  it('says why nobody can be reported when the other team is all COM', () => {
    const onReport = jest.fn();
    render(
      <ChomboReportPanel
        players={[
          player('me', 0),
          player('partner', 0),
          player('com-1', 1, true),
          player('com-2', 1, true),
        ]}
        currentSeatId="me"
        onReport={onReport}
      />,
    );

    expect(screen.getByText('noTargets')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'submit' })).not.toBeInTheDocument();
  });

  it('keeps the form usable when an opponent arrives after it opened', () => {
    const onReport = jest.fn();
    const table = [player('me', 0), player('com', 1, true)];
    const { rerender } = render(
      <ChomboReportPanel players={table} currentSeatId="me" onReport={onReport} />,
    );

    rerender(
      <ChomboReportPanel
        players={[...table, player('rival', 1)]}
        currentSeatId="me"
        onReport={onReport}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'submit' }));

    expect(onReport).toHaveBeenCalledWith('rival', 'negri-forget');
  });
});
