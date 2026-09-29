import { signInWithAppleIdToken } from '../apple-sign-in.ios';

const mockSignInAsync = jest.fn();
const mockSignInWithIdToken = jest.fn();
const mockUpdateUser = jest.fn();
const mockFetchPlayerProfileWithRetry = jest.fn();
const mockUpdateProfile = jest.fn();

jest.mock('expo-apple-authentication', () => ({
  AppleAuthenticationScope: { FULL_NAME: 1, EMAIL: 0 },
  signInAsync: (...args: unknown[]) => mockSignInAsync(...args),
}));
jest.mock('expo-crypto', () => ({
  getRandomBytes: () => new Uint8Array([1, 2, 3]),
  digestStringAsync: jest.fn().mockResolvedValue('hashed-nonce'),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));
jest.mock('@/lib/supabase', () => ({
  supabase: { auth: {
    signInWithIdToken: (...args: unknown[]) => mockSignInWithIdToken(...args),
    updateUser: (...args: unknown[]) => mockUpdateUser(...args),
  } },
}));
jest.mock('@/lib/profile-api', () => ({
  fetchPlayerProfileWithRetry: (...args: unknown[]) => mockFetchPlayerProfileWithRetry(...args),
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
}));

describe('native Apple sign-in', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignInWithIdToken.mockResolvedValue({
      data: { user: { id: 'user-1' }, session: { access_token: 'access-token' } },
      error: null,
    });
    mockUpdateUser.mockResolvedValue({ error: null });
    mockFetchPlayerProfileWithRetry.mockResolvedValue({ displayName: 'Player' });
    mockUpdateProfile.mockResolvedValue({ displayName: 'Hikaru Endo' });
  });

  it('passes the raw nonce to Supabase and its digest to Apple', async () => {
    mockSignInAsync.mockResolvedValue({
      identityToken: 'signed-apple-token',
      fullName: { givenName: 'Hikaru', familyName: 'Endo' },
    });
    expect(await signInWithAppleIdToken()).toEqual({ error: null });
    expect(mockSignInAsync).toHaveBeenCalledWith(expect.objectContaining({ nonce: 'hashed-nonce' }));
    expect(mockSignInWithIdToken).toHaveBeenCalledWith({
      provider: 'apple', token: 'signed-apple-token', nonce: '010203',
    });
    expect(mockUpdateUser).toHaveBeenCalledWith({ data: { full_name: 'Hikaru Endo' } });
    expect(mockUpdateProfile).toHaveBeenCalledWith('user-1', 'access-token', {
      displayName: 'Hikaru Endo',
    });
  });

  it('keeps an existing display name when Apple supplies a name', async () => {
    mockSignInAsync.mockResolvedValue({
      identityToken: 'signed-apple-token',
      fullName: { givenName: 'Hikaru', familyName: 'Endo' },
    });
    mockFetchPlayerProfileWithRetry.mockResolvedValue({ displayName: 'Meitra Fan' });

    expect(await signInWithAppleIdToken()).toEqual({ error: null });
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it('keeps the authenticated session when profile saving fails', async () => {
    mockSignInAsync.mockResolvedValue({
      identityToken: 'signed-apple-token',
      fullName: { givenName: 'Hikaru', familyName: 'Endo' },
    });
    mockUpdateProfile.mockRejectedValue(new Error('profile unavailable'));

    expect(await signInWithAppleIdToken()).toEqual({ error: null });
    expect(mockUpdateUser).toHaveBeenCalledWith({ data: { full_name: 'Hikaru Endo' } });
  });

  it('restores the first-login name from auth metadata after a failed profile write', async () => {
    mockSignInAsync
      .mockResolvedValueOnce({
        identityToken: 'first-token',
        fullName: { givenName: 'Hikaru', familyName: 'Endo' },
      })
      .mockResolvedValueOnce({ identityToken: 'second-token', fullName: null });
    mockSignInWithIdToken
      .mockResolvedValueOnce({
        data: { user: { id: 'user-1', user_metadata: {} }, session: { access_token: 'first-access' } },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          user: { id: 'user-1', user_metadata: { full_name: 'Hikaru Endo' } },
          session: { access_token: 'second-access' },
        },
        error: null,
      });
    mockUpdateProfile
      .mockRejectedValueOnce(new Error('profile unavailable'))
      .mockResolvedValueOnce({ displayName: 'Hikaru Endo' });

    expect(await signInWithAppleIdToken()).toEqual({ error: null });
    expect(await signInWithAppleIdToken()).toEqual({ error: null });
    expect(mockUpdateUser).toHaveBeenCalledTimes(1);
    expect(mockUpdateProfile).toHaveBeenLastCalledWith('user-1', 'second-access', {
      displayName: 'Hikaru Endo',
    });
  });

  it('does not replace a chosen profile name with saved Apple metadata', async () => {
    mockSignInAsync.mockResolvedValue({ identityToken: 'signed-apple-token', fullName: null });
    mockSignInWithIdToken.mockResolvedValue({
      data: {
        user: { id: 'user-1', user_metadata: { full_name: 'Hikaru Endo' } },
        session: { access_token: 'access-token' },
      },
      error: null,
    });
    mockFetchPlayerProfileWithRetry.mockResolvedValue({ displayName: 'Meitra Fan' });

    expect(await signInWithAppleIdToken()).toEqual({ error: null });
    expect(mockUpdateUser).not.toHaveBeenCalled();
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it('treats a cancelled Apple sheet as cancellation, not a login', async () => {
    mockSignInAsync.mockRejectedValue({ code: 'ERR_REQUEST_CANCELED' });
    expect(await signInWithAppleIdToken()).toEqual({ error: null, cancelled: true });
    expect(mockSignInWithIdToken).not.toHaveBeenCalled();
  });
});
