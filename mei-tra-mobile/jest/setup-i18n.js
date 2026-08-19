// Tests assert the Japanese copy, so pin the locale instead of inheriting the
// machine's. Cases that care about English call setLocale('en') themselves.
const { setLocale } = require('../src/i18n');

beforeEach(() => {
  setLocale('ja');
});
