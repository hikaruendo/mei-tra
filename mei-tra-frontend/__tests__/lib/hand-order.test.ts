import { normalizeHandSortDirection, orientDealtHand, syncHandOrder, reorderHand } from '@meitra/game-client/hand-order';

const hand = ['JOKER', '5♠', '10♠', 'K♠', 'A♠', '6♦', 'A♦', '7♣', 'Q♣', '8♥', 'A♥'];
const left = ['JOKER', 'A♠', 'K♠', '10♠', '5♠', 'A♦', '6♦', 'Q♣', '7♣', 'A♥', '8♥'];

it('defaults missing or invalid preferences to the existing right-strong order', () => {
  for (const value of [undefined, null, 'invalid', 'strong-right']) {
    expect(normalizeHandSortDirection(value)).toBe('strong-right');
  }
  expect(normalizeHandSortDirection('strong-left')).toBe('strong-left');
  expect(orientDealtHand(hand, 'strong-right')).toEqual(hand);
});

it('reverses ranks in all four suits without moving the Joker or mutating the source', () => {
  expect(orientDealtHand(hand, 'strong-left')).toEqual(left);
  expect(hand[1]).toBe('5♠');
  expect(orientDealtHand([], 'strong-left')).toEqual([]);
  expect(orientDealtHand(['JOKER'], 'strong-left')).toEqual(['JOKER']);
});

it('uses the preference for deals and Agari, but preserves manual order after play', () => {
  expect(syncHandOrder([], hand, 'strong-left')).toEqual(left);
  const arranged = reorderHand(left, '5♠', 'JOKER', 'before')!;
  expect(syncHandOrder(arranged, hand, 'strong-left')).toEqual(arranged);
  expect(syncHandOrder(arranged, hand.filter(card => card !== 'A♦'), 'strong-left'))
    .toEqual(arranged.filter(card => card !== 'A♦'));
  const withAgari = [...hand.slice(0, -1), 'K♥', 'A♥'];
  expect(syncHandOrder(arranged, withAgari, 'strong-left')).toEqual([...left.slice(0, -2), 'A♥', 'K♥', '8♥']);
});
