// Tests assert the Japanese copy, so pin the locale instead of inheriting the
// machine's. Cases that care about English call setLocale('en') themselves.
// Importing src/i18n here is safe: it has no native dependencies (persistence
// lives in src/i18n/storage, which tests mock individually).
const { setLocale } = require('../src/i18n');

beforeEach(() => {
  setLocale('ja');
});
