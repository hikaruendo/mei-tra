import {
  SERVER_ERROR_TRANSLATION_KEYS,
  serverErrorKey,
  serverErrorTranslation,
} from '@meitra/game-client/server-errors';
import en from '@/messages/en.json';
import ja from '@/messages/ja.json';

describe('server error translations', () => {
  it('translates every key it can return', () => {
    const missing = SERVER_ERROR_TRANSLATION_KEYS.filter(
      (key) =>
        !(key in ja.serverErrors) ||
        !(key in en.serverErrors) ||
        !String((ja.serverErrors as Record<string, string>)[key]).trim(),
    );

    expect(missing).toEqual([]);
  });

  it('names a message the server sends', () => {
    expect(serverErrorKey("It's not your turn to play")).toBe(
      'itsNotYourTurnToPlay',
    );
  });

  it('names the spectator message whatever the action is', () => {
    expect(serverErrorKey('Spectators cannot play a card')).toBe(
      'spectatorAction',
    );
  });

  it('leaves text it does not know to the server', () => {
    expect(serverErrorKey('Something the server started sending')).toBeNull();
  });

  it('pulls the suit out of the messages built while playing', () => {
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
  });

  it('pulls the seat out of the team change messages', () => {
    expect(serverErrorTranslation('Invalid team for seat seat-3')).toEqual({
      key: 'invalidTeamForSeat',
      params: { seatId: 'seat-3' },
    });

    expect(serverErrorTranslation('Seat seat-3 not found')).toEqual({
      key: 'seatNotFound',
      params: { seatId: 'seat-3' },
    });
  });

  it('names the static messages the play phase sends most', () => {
    expect(
      serverErrorKey('In Tanzen round, you must play the Joker if you have it.'),
    ).toBe('inTanzenRoundYouMustPlayTheJoker');

    expect(
      serverErrorKey('Open is only available with four or fewer cards in hand'),
    ).toBe('openIsOnlyAvailableWithFourOrFewer');
  });

  it('fills every placeholder a pattern produces', () => {
    const placeholders = (value: string) =>
      new Set(Array.from(value.matchAll(/\{(\w+)\}/g), (match) => match[1]));
    const copy = en.serverErrors as Record<string, string>;

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

      expect([...placeholders(copy[translation.key] ?? '')].sort()).toEqual(
        Object.keys(translation.params ?? {}).sort(),
      );
    }
  });
});
