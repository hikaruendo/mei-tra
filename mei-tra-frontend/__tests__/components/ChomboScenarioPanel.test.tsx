import { fireEvent, render, screen } from '@testing-library/react';
import { ChomboScenarioPanel } from '@/components/game/ChomboScenarioPanel';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

describe('ChomboScenarioPanel', () => {
  it('offers one scenario for each chombo', () => {
    const onSelect = jest.fn();
    render(<ChomboScenarioPanel onSelect={onSelect} />);

    const scenarios = [
      ['negriForget', 'negri-forget'],
      ['wrongSuit', 'wrong-suit'],
      ['fourJack', 'four-jack'],
      ['lastTanzen', 'last-tanzen'],
      ['failedOpen', 'failed-open'],
    ];

    expect(screen.getAllByRole('button')).toHaveLength(scenarios.length);
    scenarios.forEach(([label, type]) => {
      fireEvent.click(screen.getByText(label));
      expect(onSelect).toHaveBeenLastCalledWith(type);
    });
  });
});
