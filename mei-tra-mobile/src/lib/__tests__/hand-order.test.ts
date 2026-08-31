import { reorderHand, syncHandOrder } from '@meitra/game-client/hand-order';

describe('syncHandOrder', () => {
  it('keeps the arranged order for cards still held', () => {
    expect(syncHandOrder(['3-1', '10-2', '5-4'], ['5-4', '3-1', '10-2'])).toEqual(
      ['3-1', '10-2', '5-4'],
    );
  });

  it('drops played cards and takes the dealt order when a card arrives', () => {
    expect(syncHandOrder(['3-1', '10-2', '5-4'], ['3-1', '5-4', 'JOKER'])).toEqual(
      ['3-1', '5-4', 'JOKER'],
    );
  });

  it('takes the dealt order when nothing was arranged yet', () => {
    expect(syncHandOrder([], ['5-4', '3-1'])).toEqual(['5-4', '3-1']);
  });

  it('keeps the arranged order when the negri card leaves the hand', () => {
    expect(syncHandOrder(['A♥', '5♠', 'Q♦'], ['A♥', 'Q♦'])).toEqual([
      'A♥',
      'Q♦',
    ]);
  });

  it('takes the suit-sorted order when a re-deal shares cards with the old hand', () => {
    expect(syncHandOrder(['A♥', '5♠'], ['5♠', '10♠', 'A♥'])).toEqual([
      '5♠',
      '10♠',
      'A♥',
    ]);
  });

  it('takes the suit-sorted order when the agari joins the hand', () => {
    expect(syncHandOrder(['7♦', 'A♦'], ['7♦', 'Q♦', 'A♦'])).toEqual([
      '7♦',
      'Q♦',
      'A♦',
    ]);
  });
});

describe('reorderHand', () => {
  const order = ['A', 'B', 'C', 'D'];

  it('moves a card after its target', () => {
    expect(reorderHand(order, 'A', 'C', 'after')).toEqual(['B', 'C', 'A', 'D']);
  });

  it('moves a card before its target', () => {
    expect(reorderHand(order, 'D', 'B', 'before')).toEqual(['A', 'D', 'B', 'C']);
  });

  it('returns null when the order does not change', () => {
    expect(reorderHand(order, 'A', 'B', 'before')).toBeNull();
    expect(reorderHand(order, 'B', 'A', 'after')).toBeNull();
  });

  it('returns null for a card that is not in the hand', () => {
    expect(reorderHand(order, 'A', 'A', 'after')).toBeNull();
    expect(reorderHand(order, 'Z', 'B', 'after')).toBeNull();
    expect(reorderHand(order, 'A', 'Z', 'after')).toBeNull();
  });
});
