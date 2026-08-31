import {
  GUEST_NAME_MAX_LENGTH,
  normalizeGuestName,
} from '@meitra/game-client/guest-name';

describe('normalizeGuestName', () => {
  it('keeps a name the player typed', () => {
    expect(normalizeGuestName('たろう', 'ゲスト1234')).toBe('たろう');
  });

  it('trims the edges and collapses runs of spaces', () => {
    expect(normalizeGuestName('  ta   ro  ', 'ゲスト1234')).toBe('ta ro');
  });

  // A blank display_name fails the user_profiles `char_length >= 1` check, and
  // handle_new_user swallows that error — leaving an auth user with no profile.
  it('falls back when nothing was typed', () => {
    expect(normalizeGuestName('', 'ゲスト1234')).toBe('ゲスト1234');
    expect(normalizeGuestName('   ', 'ゲスト1234')).toBe('ゲスト1234');
    expect(normalizeGuestName('\n\t', 'ゲスト1234')).toBe('ゲスト1234');
  });

  // Likewise an over-long one fails VARCHAR(100).
  it('clamps a name that is too long', () => {
    const long = 'あ'.repeat(200);
    const result = normalizeGuestName(long, 'ゲスト1234');
    expect(result).toHaveLength(GUEST_NAME_MAX_LENGTH);
    expect(result).toBe('あ'.repeat(GUEST_NAME_MAX_LENGTH));
  });

  it('clamps only after trimming, so padding does not eat the name', () => {
    const padded = `${' '.repeat(50)}たろう${' '.repeat(50)}`;
    expect(normalizeGuestName(padded, 'ゲスト1234')).toBe('たろう');
  });
});
