import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

import { fetchPlayerProfileWithRetry, updateProfile } from '@/lib/profile-api';
import { supabase } from '@/lib/supabase';

export async function signInWithAppleIdToken(): Promise<{
  error: string | null;
  cancelled?: boolean;
}> {
  try {
    const nonce = Array.from(Crypto.getRandomBytes(32), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('');
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      nonce,
    );
    const credential = await AppleAuthentication.signInAsync({
      nonce: hashedNonce,
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      return { error: 'Apple identity token was not returned' };
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce,
    });
    if (error) return { error: error.message };

    // Apple sends the name only on first authorization. The auth event has
    // already established the session; metadata update must not fail login.
    const fullName = [
      credential.fullName?.givenName,
      credential.fullName?.familyName,
    ]
      .filter(Boolean)
      .join(' ');
    if (fullName) {
      // The profile trigger has already run when sign-in returns. Apple only
      // supplies a name once, so populate a default profile without replacing
      // a name the player chose earlier.
      if (data.user && data.session) {
        try {
          const profile = await fetchPlayerProfileWithRetry(data.user.id);
          if (profile.displayName === 'Player') {
            await updateProfile(data.user.id, data.session.access_token, {
              displayName: fullName.slice(0, 100),
            });
          }
        } catch (profileError) {
          console.warn('[AppleSignIn] Failed to save initial profile name:', profileError);
        }
      }
      try {
        await supabase.auth.updateUser({ data: { full_name: fullName } });
      } catch (metadataError) {
        console.warn('[AppleSignIn] Failed to save auth name:', metadataError);
      }
    }

    return { error: null };
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error &&
        error.code === 'ERR_REQUEST_CANCELED') {
      return { error: null, cancelled: true };
    }
    return { error: error instanceof Error ? error.message : 'Apple sign-in failed' };
  }
}
