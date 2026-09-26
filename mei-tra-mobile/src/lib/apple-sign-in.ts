export async function signInWithAppleIdToken(): Promise<{ error: string }> {
  return { error: 'Apple sign-in is available only on iOS' };
}
