import {
  SERVER_ERROR_TRANSLATION_KEYS,
  serverErrorTranslation,
} from '@meitra/game-client/server-errors';

import en from '../en.json';
import ja from '../ja.json';

describe('server error translations', () => {
  it('translates every key the clients can look up', () => {
    const missing = SERVER_ERROR_TRANSLATION_KEYS.filter(
      (key) =>
        !(key in ja.serverErrors) ||
        !(key in en.serverErrors) ||
        !String((ja.serverErrors as Record<string, string>)[key]).trim(),
    );

    expect(missing).toEqual([]);
  });

  it('names the messages the server builds from game state', () => {
    expect(
      serverErrorTranslation('You must play a card of suit ♥.'),
    ).toEqual({ key: 'youMustPlayACardOfSuit', params: { suit: '♥' } });

    expect(
      serverErrorTranslation(
        'You must play the Joker since you have no ♠ cards.',
      ),
    ).toEqual({
      key: 'youMustPlayTheJokerSinceYouHaveNoSuitCards',
      params: { suit: '♠' },
    });

    expect(serverErrorTranslation('Invalid team for seat seat-2')).toEqual({
      key: 'invalidTeamForSeat',
      params: { seatId: 'seat-2' },
    });

    expect(serverErrorTranslation('Seat seat-2 not found')).toEqual({
      key: 'seatNotFound',
      params: { seatId: 'seat-2' },
    });
  });

  it('declares the same placeholders the resolver supplies', () => {
    const placeholders = (value: string) =>
      new Set(Array.from(value.matchAll(/\{(\w+)\}/g), (match) => match[1]));
    const catalogues: Record<string, string>[] = [
      en.serverErrors as Record<string, string>,
      ja.serverErrors as Record<string, string>,
    ];

    for (const message of [
      'You must play a card of suit ♦.',
      'You must play the Joker since you have no ♣ cards.',
      'Invalid team for seat seat-1',
      'Seat seat-1 not found',
    ]) {
      const translation = serverErrorTranslation(message);
      if (!translation) {
        throw new Error(`no translation for ${message}`);
      }

      const names = Object.keys(translation.params ?? {}).sort();
      for (const catalogue of catalogues) {
        const copy = catalogue[translation.key] ?? '';
        expect([...placeholders(copy)].sort()).toEqual(names);
      }
    }
  });
});
