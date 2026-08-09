import type { FieldContract } from '@meitra/contracts/game';

import { isCardPlayable, parseCard } from '@/lib/cards';

const field = (baseCard: string, cards = [baseCard]): FieldContract => ({
  cards,
  playedBy: ['player-1'],
  baseCard,
  dealerId: 'player-1',
  isComplete: false,
});

describe('parseCard', () => {
  it('parses a ten without losing the rank', () => {
    expect(parseCard('10♦')).toEqual({
      rank: '10',
      suit: '♦',
      isRed: true,
    });
  });
});

describe('isCardPlayable', () => {
  it('allows any card when leading the field', () => {
    expect(isCardPlayable(['5♠', 'A♥'], 'A♥', null, 'tra')).toBe(true);
  });

  it('requires following the base suit when possible', () => {
    const currentField = field('9♠');
    expect(
      isCardPlayable(['5♠', 'A♥'], 'A♥', currentField, 'tra'),
    ).toBe(false);
    expect(
      isCardPlayable(['5♠', 'A♥'], '5♠', currentField, 'tra'),
    ).toBe(true);
  });

  it('treats the secondary jack as the trump suit', () => {
    const currentField = field('9♥');
    expect(
      isCardPlayable(['J♦', 'A♠'], 'A♠', currentField, 'herz'),
    ).toBe(false);
    expect(
      isCardPlayable(['J♦', 'A♠'], 'J♦', currentField, 'herz'),
    ).toBe(true);
  });

  it('keeps the secondary jack in its natural suit for Tra', () => {
    const currentField = field('9♦');
    expect(
      isCardPlayable(['J♥', 'A♠'], 'A♠', currentField, 'tra'),
    ).toBe(true);
  });

  it('forces Joker in a two-card Tanzen hand', () => {
    expect(
      isCardPlayable(['JOKER', 'A♠'], 'A♠', field('9♦'), 'daiya'),
    ).toBe(false);
    expect(
      isCardPlayable(['JOKER', 'A♠'], 'JOKER', field('9♦'), 'daiya'),
    ).toBe(true);
  });

  it('forces Joker when trump is led and no trump card is held', () => {
    const currentField = field('9♥');
    expect(
      isCardPlayable(['JOKER', 'A♠', 'K♣'], 'A♠', currentField, 'herz'),
    ).toBe(false);
    expect(
      isCardPlayable(['JOKER', 'A♠', 'K♣'], 'JOKER', currentField, 'herz'),
    ).toBe(true);
  });

  it('uses the selected base suit when Joker leads the field', () => {
    const currentField = {
      ...field('JOKER'),
      baseSuit: '♣',
    };

    expect(
      isCardPlayable(['5♣', 'A♥'], 'A♥', currentField, 'club'),
    ).toBe(false);
    expect(
      isCardPlayable(['5♣', 'A♥'], '5♣', currentField, 'club'),
    ).toBe(true);
  });
});
