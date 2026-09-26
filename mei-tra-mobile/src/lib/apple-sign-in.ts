export async function signInWithAppleIdToken(): Promise<{
  error: string | null;
  cancelled?: boolean;
}> {
  return { error: 'Apple sign-in is available only on iOS' };
}
