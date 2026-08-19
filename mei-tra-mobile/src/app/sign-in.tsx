import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BrandHeader } from '@/components/ui/BrandHeader';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/context/AuthContext';
import { colors } from '@/theme/colors';
import { t } from '@/i18n';
import { useLocale } from '@/context/LocaleContext';

export default function SignInScreen() {
  // Re-render this screen when the app language changes; t() is a bare
  // function and cannot trigger that on its own.
  useLocale();
  const router = useRouter();
  const {
    user,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    signInAnonymously,
  } = useAuth();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!loading && user) {
    return <Redirect href="/rooms" />;
  }

  if (loading) {
    return (
      <Screen contentStyle={styles.loadingState}>
        <ActivityIndicator color={colors.gold} size="large" />
        <Text accessibilityLiveRegion="polite" style={styles.loadingText}>
          {t('auth.checkingSession')}
        </Text>
      </Screen>
    );
  }

  const handleSubmit = async () => {
    if (submitting || isInvalid) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const result =
        mode === 'signIn'
          ? await signIn(email, password)
          : await signUp(email, password, displayName);

      if (result.error) {
        setError(result.error);
        return;
      }

      if (result.emailConfirmationRequired) {
        setMessage(
          t('auth.confirmEmailSentSignUp'),
        );
        return;
      }

      router.replace('/rooms');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await signInWithGoogle();

      if (result.error) {
        setError(result.error);
        return;
      }

      router.replace('/rooms');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGuest = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const result = await signInAnonymously();

      if (result.error) {
        setError(result.error);
        return;
      }

      router.replace('/rooms');
    } finally {
      setSubmitting(false);
    }
  };

  const isInvalid =
    !email.trim() ||
    password.length < 6 ||
    (mode === 'signUp' && !displayName.trim());

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <BrandHeader subtitle={t('auth.brandTagline')} />

        <View style={styles.card}>
          <Text style={styles.title}>
            {mode === 'signIn' ? t('auth.signIn') : t('auth.signUpTitle')}
          </Text>

          <Button
            variant="secondary"
            onPress={handleGoogle}
            disabled={submitting}
          >
            {t('auth.continueWithGoogle')}
          </Button>

          <Button
            variant="secondary"
            onPress={handleGuest}
            disabled={submitting}
          >
            {t('auth.playAsGuest')}
          </Button>
          <Text style={styles.guestHint}>
            {t('auth.guestHint')}
          </Text>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('auth.or')}</Text>
            <View style={styles.dividerLine} />
          </View>

          {mode === 'signUp' ? (
            <TextInput
            accessibilityLabel={t('auth.displayName')}
            autoCapitalize="none"
            autoCorrect={false}
              onChangeText={setDisplayName}
              placeholder={t('auth.displayName')}
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={displayName}
            />
          ) : null}

          <TextInput
            accessibilityLabel={t('auth.email')}
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder={t('auth.email')}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={email}
          />

          <TextInput
            accessibilityLabel={t('auth.password')}
            autoCapitalize="none"
            autoComplete={
              mode === 'signIn' ? 'current-password' : 'new-password'
            }
            onChangeText={setPassword}
            placeholder={t('auth.passwordMin6')}
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            style={styles.input}
            value={password}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {message ? <Text style={styles.message}>{message}</Text> : null}

          <Button
            disabled={isInvalid}
            loading={submitting}
            onPress={handleSubmit}
          >
            {mode === 'signIn' ? t('auth.signIn') : t('auth.signUpSubmit')}
          </Button>

          <Button
            variant="ghost"
            disabled={submitting}
            onPress={() => {
              setMode((current) =>
                current === 'signIn' ? 'signUp' : 'signIn',
              );
              setError(null);
              setMessage(null);
            }}
          >
            {mode === 'signIn'
              ? t('auth.toSignUp')
              : t('auth.toSignIn')}
          </Button>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    padding: 24,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 16,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: 32,
    padding: 24,
  },
  card: {
    gap: 16,
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
  },
  input: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundElevated,
    color: colors.text,
    paddingHorizontal: 16,
    fontSize: 17,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    color: colors.textMuted,
  },
  guestHint: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  error: {
    // dangerText, not danger: `danger` is a fill colour and only reaches ~2.4:1
    // as text on the felt panel behind this card. See theme/palette.ts.
    color: colors.dangerText,
    fontSize: 15,
  },
  message: {
    color: colors.success,
    fontSize: 15,
  },
});
