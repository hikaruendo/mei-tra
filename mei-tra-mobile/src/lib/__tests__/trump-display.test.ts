import { getStrengthOrderLabel } from '@/lib/trump-display';

describe('getStrengthOrderLabel', () => {
  it('returns generic order for null trump', () => {
    expect(getStrengthOrderLabel(null)).toBe(
      'JOKER > A > K > Q > J > 10 > 9 > 8 > 7 > 6 > 5',
    );
  });

  it('returns generic order for tra', () => {
    expect(getStrengthOrderLabel('tra')).toBe(
      'JOKER > A > K > Q > J > 10 > 9 > 8 > 7 > 6 > 5',
    );
  });

  it('includes main and sub jack for herz', () => {
    const label = getStrengthOrderLabel('herz');
    expect(label).toContain('J♥');
    expect(label).toContain('J♦');
    expect(label.indexOf('J♥')).toBeLessThan(label.indexOf('J♦'));
  });

  it('includes main and sub jack for club', () => {
    const label = getStrengthOrderLabel('club');
    expect(label).toContain('J♣');
    expect(label).toContain('J♠');
    expect(label.indexOf('J♣')).toBeLessThan(label.indexOf('J♠'));
  });
});
