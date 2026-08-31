import { completedFieldKey } from '@meitra/game-client/completed-field';
import { dedupeCompletedFields } from '@meitra/game-client/game-event-reducer';
import type { CompletedFieldContract } from '@meitra/contracts/game';
import { asSeatId } from '@meitra/contracts/ids';

const trick = (
  cards: string[],
  winner: string,
  dealer = 'seat-2',
): CompletedFieldContract => ({
  cards,
  winnerSeatId: asSeatId(winner),
  dealerSeatId: asSeatId(dealer),
  winnerTeam: 0,
});

describe('completedFieldKey', () => {
  it('gives the same trick the same key however many times it arrives', () => {
    const field = trick(['A♠', '10♥', 'K♣', '3♦'], 'seat-1');

    expect(completedFieldKey(field)).toBe(completedFieldKey({ ...field }));
  });

  it('separates tricks that differ in any part of their identity', () => {
    const base = trick(['A♠', '10♥', 'K♣', '3♦'], 'seat-1');
    const keys = new Set([
      completedFieldKey(base),
      completedFieldKey({ ...base, winnerSeatId: asSeatId('seat-3') }),
      completedFieldKey({ ...base, winnerTeam: 1 }),
      completedFieldKey({ ...base, dealerSeatId: asSeatId('seat-4') }),
      completedFieldKey({ ...base, cards: ['A♠', '10♥', 'K♣', '4♦'] }),
    ]);

    expect(keys.size).toBe(5);
  });

  it('does not merge two tricks that only share their card order position', () => {
    const first = trick(['A♠', '10♥', 'K♣', '3♦'], 'seat-1');
    const second = trick(['2♠', '4♥', '6♦', '8♣'], 'seat-2');

    expect(completedFieldKey(first)).not.toBe(completedFieldKey(second));
  });

  // The socket can deliver the same trick twice, and the reveal state keys off
  // the pile the player opened. Both have to agree on what "the same trick"
  // means, which is why they share this one function.
  it('is the same identity the reducer dedupes on', () => {
    const field = trick(['A♠', '10♥', 'K♣', '3♦'], 'seat-1');
    const other = trick(['2♠', '4♥', '6♦', '8♣'], 'seat-2');

    const deduped = dedupeCompletedFields([field, { ...field }, other]);

    expect(deduped).toHaveLength(2);
    expect(deduped.map(completedFieldKey)).toEqual([
      completedFieldKey(field),
      completedFieldKey(other),
    ]);
  });
});
