import { SERVER_ERROR_TRANSLATION_KEYS } from '@meitra/game-client/server-errors';

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
});
