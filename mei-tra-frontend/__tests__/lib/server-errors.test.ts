import {
  SERVER_ERROR_TRANSLATION_KEYS,
  serverErrorKey,
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
});
