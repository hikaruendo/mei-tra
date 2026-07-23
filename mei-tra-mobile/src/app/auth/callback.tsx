import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { Alert } from 'react-native';

import { completeOAuthCallback } from '@/lib/auth-session';
import { supabase } from '@/lib/supabase';

const getFirstParam = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
};

const hasOAuthCallbackParams = (url: string): boolean =>
  /[#?&](code|access_token|refresh_token|error|error_description)=/.test(url);

const buildCallbackUrl = (
  params: Record<string, string | string[] | undefined>,
): string => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    const firstValue = getFirstParam(value);
    if (firstValue) searchParams.set(key, firstValue);
  });

  const query = searchParams.toString();
  return `meitra://auth/callback${query ? `?${query}` : ''}`;
};

export default function AuthCallbackScreen() {
  const router = useRouter();
  const linkedUrl = Linking.useURL();
  const params = useLocalSearchParams();
  const handledUrlRef = useRef<string | null>(null);
  const callbackUrl = useMemo(() => {
    if (linkedUrl && hasOAuthCallbackParams(linkedUrl)) return linkedUrl;
    return buildCallbackUrl(
      params as Record<string, string | string[] | undefined>,
    );
  }, [linkedUrl, params]);

  useEffect(() => {
    if (handledUrlRef.current === callbackUrl) return;

    handledUrlRef.current = callbackUrl;
    let active = true;

    const routeToSignInWithError = (message: string) => {
      Alert.alert('ログインを完了できませんでした', message);
      router.replace('/sign-in');
    };

    const finish = async () => {
      try {
        const result = await completeOAuthCallback(callbackUrl, supabase.auth);
        if (!active) return;

        if (result.error) {
          routeToSignInWithError(result.error);
          return;
        }

        router.replace('/rooms');
      } catch (callbackError) {
        if (!active) return;

        const message =
          callbackError instanceof Error
            ? callbackError.message
            : 'Googleログインを完了できませんでした';
        routeToSignInWithError(message);
      }
    };

    void finish();

    return () => {
      active = false;
    };
  }, [callbackUrl, router]);

  return null;
}
